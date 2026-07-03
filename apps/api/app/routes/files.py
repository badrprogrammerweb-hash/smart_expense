"""Routes for receipt and invoice file operations."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import get_rls_session
from app.schemas.files import FileListResponse, FileMetadata, SignedUrlResponse
from app.services.files import (
    MAX_FILE_SIZE_BYTES,
    get_download_url,
    get_file_metadata,
    list_files,
    require_upload_permission,
    upload_file,
)


router = APIRouter(prefix="/workspaces/{workspace_id}/files", tags=["files"])

# Allow the 10 MB file plus multipart framing overhead (boundaries, part
# headers, the filename, and the optional expense_id field).
MAX_MULTIPART_BODY_BYTES = MAX_FILE_SIZE_BYTES + (64 * 1024)


@dataclass(frozen=True)
class ParsedUpload:
    filename: str
    content: bytes
    expense_id: UUID | None


def _request_error(status_code: int, code: str, message: str, **extra: object) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, **extra},
    )


def _file_too_large() -> HTTPException:
    return _request_error(
        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        "file_too_large",
        f"Files must be {MAX_FILE_SIZE_BYTES} bytes or smaller.",
        limit_bytes=MAX_FILE_SIZE_BYTES,
    )


def _invalid_multipart() -> HTTPException:
    return _request_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "invalid_request",
        "Upload request must include a multipart file field.",
    )


def _content_length(request: Request) -> int | None:
    raw_value = request.headers.get("content-length")
    if raw_value is None:
        return None
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise _invalid_multipart() from exc
    if value < 0:
        raise _invalid_multipart()
    return value


def _reject_oversized_body(request: Request) -> None:
    """Reject an over-cap upload from the Content-Length header alone, before
    reading the body. `request.form(max_part_size=...)` enforces the same cap
    while streaming for chunked requests that omit Content-Length."""
    content_length = _content_length(request)
    if content_length is not None and content_length > MAX_MULTIPART_BODY_BYTES:
        raise _file_too_large()


def _parse_expense_id(raw_value: str) -> UUID | None:
    raw_value = raw_value.strip()
    if not raw_value:
        return None
    try:
        return UUID(raw_value)
    except ValueError as exc:
        raise _request_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_request",
            "expense_id must be a valid identifier.",
        ) from exc


async def _parse_upload(request: Request) -> ParsedUpload:
    content_type = request.headers.get("content-type") or ""
    if not content_type.lower().startswith("multipart/form-data"):
        raise _invalid_multipart()

    try:
        async with request.form(max_part_size=MAX_MULTIPART_BODY_BYTES) as form:
            file_field = form.get("file")
            if not isinstance(file_field, UploadFile):
                raise _invalid_multipart()

            content = await file_field.read()
            filename = file_field.filename or "upload"

            raw_expense_id = form.get("expense_id")
            expense_id = (
                _parse_expense_id(raw_expense_id) if isinstance(raw_expense_id, str) else None
            )
    except MultiPartException as exc:
        # python-multipart raises this when a part exceeds max_part_size or the
        # body is malformed; treat an over-cap part as "too large".
        if "part" in str(exc).lower() and "size" in str(exc).lower():
            raise _file_too_large() from exc
        raise _invalid_multipart() from exc

    return ParsedUpload(filename=filename, content=content, expense_id=expense_id)


def _not_implemented() -> HTTPException:
    return _request_error(
        status.HTTP_501_NOT_IMPLEMENTED,
        "not_implemented",
        "This file operation is not available yet.",
    )


@router.post("", response_model=FileMetadata, status_code=status.HTTP_201_CREATED)
async def upload_workspace_file(
    workspace_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> FileMetadata:
    # Authorize before consuming the request body so an unauthorized caller
    # cannot make the server buffer/parse a large upload just to be rejected.
    await require_upload_permission(session, workspace_id, current_user.user_id)

    _reject_oversized_body(request)
    parsed = await _parse_upload(request)
    return await upload_file(
        session,
        workspace_id,
        current_user.user_id,
        parsed.filename,
        parsed.content,
        parsed.expense_id,
    )


@router.get("", response_model=FileListResponse)
async def list_workspace_files(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> FileListResponse:
    return await list_files(session, workspace_id, current_user.user_id)


@router.get("/{file_id}", response_model=FileMetadata)
async def get_workspace_file(
    workspace_id: UUID,
    file_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> FileMetadata:
    return await get_file_metadata(session, workspace_id, current_user.user_id, file_id)


@router.get("/{file_id}/download-url", response_model=SignedUrlResponse)
async def get_workspace_file_download_url(
    workspace_id: UUID,
    file_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> SignedUrlResponse:
    return await get_download_url(session, workspace_id, current_user.user_id, file_id)


@router.delete("/{file_id}", response_model=FileMetadata)
async def delete_workspace_file(
    workspace_id: UUID,
    file_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> FileMetadata:
    await get_file_metadata(session, workspace_id, current_user.user_id, file_id)
    raise _not_implemented()
