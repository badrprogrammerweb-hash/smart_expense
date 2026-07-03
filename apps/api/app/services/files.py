"""Service helpers for receipt and invoice file metadata operations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import database_unavailable_exception
from app.schemas.files import FileListResponse, FileMetadata, SignedUrlResponse
from app.services import storage


MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
SUPPORTED_CONTENT_TYPES = frozenset(
    {"image/png", "image/jpeg", "image/webp", "application/pdf"}
)

FileValidationCode = Literal["empty_file", "file_too_large", "unsupported_file_type"]


@dataclass(frozen=True)
class ValidatedFile:
    content_type: str
    size_bytes: int


class FileValidationError(ValueError):
    def __init__(self, code: FileValidationCode, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def error(status_code: int, code: str, message: str, **extra: object) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, **extra},
    )


def not_found() -> HTTPException:
    return error(status.HTTP_404_NOT_FOUND, "not_found", "Workspace not found.")


def forbidden() -> HTTPException:
    return error(status.HTTP_403_FORBIDDEN, "forbidden", "You do not have permission to do that.")


def cross_workspace_link() -> HTTPException:
    return error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "cross_workspace_link",
        "File and expense must belong to the same workspace.",
    )


def storage_unavailable() -> HTTPException:
    return error(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "storage_unavailable",
        "File storage is temporarily unavailable.",
    )


def file_deleted() -> HTTPException:
    return error(
        status.HTTP_410_GONE,
        "file_deleted",
        "This file has been deleted.",
    )


def sniff_content_type(content: bytes) -> str | None:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content[0:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    return None


def validate_file_content(content: bytes) -> ValidatedFile:
    size_bytes = len(content)
    if size_bytes == 0:
        raise FileValidationError("empty_file", "Upload a file that is not empty.", 422)
    if size_bytes > MAX_FILE_SIZE_BYTES:
        raise FileValidationError(
            "file_too_large",
            f"Files must be {MAX_FILE_SIZE_BYTES} bytes or smaller.",
            413,
        )

    content_type = sniff_content_type(content)
    if content_type not in SUPPORTED_CONTENT_TYPES:
        raise FileValidationError(
            "unsupported_file_type",
            "Upload a PNG, JPEG, WebP, or PDF file.",
            415,
        )

    return ValidatedFile(content_type=content_type, size_bytes=size_bytes)


def _file_metadata_from_row(row) -> FileMetadata:
    return FileMetadata(
        id=row.id,
        original_filename=row.original_filename,
        content_type=row.content_type,
        size_bytes=row.size_bytes,
        expense_id=row.expense_id,
        uploaded_by=row.uploaded_by,
        status=row.status,
        created_at=row.created_at,
        deleted_at=getattr(row, "deleted_at", None),
        deleted_by=getattr(row, "deleted_by", None),
    )


async def workspace_role(session: AsyncSession, workspace_id: UUID, user_id: UUID) -> str:
    result = await session.execute(
        text(
            """
            select wm.role
            from public.workspaces w
            join public.workspace_memberships wm
              on wm.workspace_id = w.id
             and wm.user_id = :user_id
            where w.id = :workspace_id
            """
        ),
        {"workspace_id": str(workspace_id), "user_id": str(user_id)},
    )
    row = result.first()
    if row is None:
        raise not_found()
    return str(row.role)


UPLOAD_ROLES = frozenset({"owner", "admin", "member"})
LINK_ROLES = UPLOAD_ROLES


async def require_upload_permission(
    session: AsyncSession, workspace_id: UUID, user_id: UUID
) -> str:
    """Authorize an upload before any request body is consumed.

    Raises 404 when the caller is not a member of the workspace and 403 when
    their role may not upload (Viewer). Returns the caller's role otherwise.
    """
    role = await workspace_role(session, workspace_id, user_id)
    if role not in UPLOAD_ROLES:
        raise forbidden()
    return role


async def _validate_expense_link(
    session: AsyncSession, workspace_id: UUID, expense_id: UUID | None
) -> None:
    if expense_id is None:
        return

    result = await session.execute(
        text(
            """
            select id
            from public.expenses
            where workspace_id = :workspace_id
              and id = :expense_id
              and status = 'confirmed'
            """
        ),
        {"workspace_id": str(workspace_id), "expense_id": str(expense_id)},
    )
    if result.first() is None:
        raise cross_workspace_link()


def _display_filename(original_filename: str) -> str:
    filename = original_filename.strip() or "upload"
    return filename[:255]


def _validation_http_error(exc: FileValidationError) -> HTTPException:
    extra = {"limit_bytes": MAX_FILE_SIZE_BYTES} if exc.code == "file_too_large" else {}
    return error(exc.status_code, exc.code, str(exc), **extra)


async def upload_file(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    original_filename: str,
    content: bytes,
    expense_id: UUID | None = None,
) -> FileMetadata:
    await require_upload_permission(session, workspace_id, user_id)

    try:
        validated = validate_file_content(content)
    except FileValidationError as exc:
        raise _validation_http_error(exc) from exc

    await _validate_expense_link(session, workspace_id, expense_id)

    file_id = uuid4()
    storage_path = f"{workspace_id}/{file_id}"
    try:
        await storage.put_object(storage_path, content, validated.content_type)
    except storage.StorageError as exc:
        raise storage_unavailable() from exc

    try:
        result = await session.execute(
            text(
                """
                insert into public.files(
                    id, workspace_id, uploaded_by, expense_id, original_filename,
                    content_type, size_bytes, storage_path
                )
                values (
                    :id, :workspace_id, :uploaded_by, :expense_id, :original_filename,
                    :content_type, :size_bytes, :storage_path
                )
                returning id, original_filename, content_type, size_bytes, expense_id,
                          uploaded_by, status, created_at, deleted_at, deleted_by
                """
            ),
            {
                "id": str(file_id),
                "workspace_id": str(workspace_id),
                "uploaded_by": str(user_id),
                "expense_id": str(expense_id) if expense_id else None,
                "original_filename": _display_filename(original_filename),
                "content_type": validated.content_type,
                "size_bytes": validated.size_bytes,
                "storage_path": storage_path,
            },
        )
    except DBAPIError as exc:
        try:
            await storage.remove_object(storage_path)
        except storage.StorageError:
            pass
        message = str(exc).lower()
        if "expense_not_in_workspace" in message:
            raise cross_workspace_link() from exc
        raise database_unavailable_exception(exc) from exc

    row = result.first()
    if row is None:
        raise not_found()
    return _file_metadata_from_row(row)


async def _file_row(session: AsyncSession, workspace_id: UUID, file_id: UUID):
    try:
        result = await session.execute(
            text(
                """
                select id, original_filename, content_type, size_bytes, expense_id,
                       uploaded_by, status, created_at, deleted_at, deleted_by,
                       storage_path
                from public.files
                where workspace_id = :workspace_id
                  and id = :file_id
                """
            ),
            {"workspace_id": str(workspace_id), "file_id": str(file_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    row = result.first()
    if row is None:
        raise not_found()
    return row


async def list_files(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> FileListResponse:
    await workspace_role(session, workspace_id, user_id)

    try:
        result = await session.execute(
            text(
                """
                select id, original_filename, content_type, size_bytes, expense_id,
                       uploaded_by, status, created_at, deleted_at, deleted_by
                from public.files
                where workspace_id = :workspace_id
                  and status = 'active'
                order by created_at desc, id desc
                """
            ),
            {"workspace_id": str(workspace_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    return FileListResponse(files=[_file_metadata_from_row(row) for row in result])


async def get_file_metadata(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    file_id: UUID,
) -> FileMetadata:
    await workspace_role(session, workspace_id, user_id)
    return _file_metadata_from_row(await _file_row(session, workspace_id, file_id))


async def get_download_url(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    file_id: UUID,
) -> SignedUrlResponse:
    await workspace_role(session, workspace_id, user_id)
    row = await _file_row(session, workspace_id, file_id)
    if row.status == "deleted":
        raise file_deleted()

    ttl = storage.DEFAULT_SIGNED_URL_TTL_SECONDS
    try:
        signed_url = await storage.sign_url(row.storage_path, ttl)
    except storage.StorageError as exc:
        raise storage_unavailable() from exc

    expires_in = max(1, min(signed_url.expires_in, ttl))
    return SignedUrlResponse(url=signed_url.url, expires_in=expires_in)


async def link_file_to_expense(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    file_id: UUID,
    expense_id: UUID,
) -> FileMetadata:
    role = await workspace_role(session, workspace_id, user_id)
    row = await _file_row(session, workspace_id, file_id)
    if role not in LINK_ROLES:
        raise forbidden()
    if row.status == "deleted":
        raise file_deleted()

    await _validate_expense_link(session, workspace_id, expense_id)

    try:
        result = await session.execute(
            text(
                """
                update public.files
                set expense_id = :expense_id
                where workspace_id = :workspace_id
                  and id = :file_id
                  and status = 'active'
                returning id, original_filename, content_type, size_bytes, expense_id,
                          uploaded_by, status, created_at, deleted_at, deleted_by
                """
            ),
            {
                "workspace_id": str(workspace_id),
                "file_id": str(file_id),
                "expense_id": str(expense_id),
            },
        )
    except DBAPIError as exc:
        message = str(exc).lower()
        if "expense_not_in_workspace" in message:
            raise cross_workspace_link() from exc
        raise database_unavailable_exception(exc) from exc

    updated = result.first()
    if updated is None:
        raise not_found()
    return _file_metadata_from_row(updated)


async def detach_file_from_expense(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    file_id: UUID,
) -> FileMetadata:
    role = await workspace_role(session, workspace_id, user_id)
    row = await _file_row(session, workspace_id, file_id)
    if role not in LINK_ROLES:
        raise forbidden()
    if row.status == "deleted":
        raise file_deleted()

    try:
        result = await session.execute(
            text(
                """
                update public.files
                set expense_id = null
                where workspace_id = :workspace_id
                  and id = :file_id
                  and status = 'active'
                returning id, original_filename, content_type, size_bytes, expense_id,
                          uploaded_by, status, created_at, deleted_at, deleted_by
                """
            ),
            {"workspace_id": str(workspace_id), "file_id": str(file_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    updated = result.first()
    if updated is None:
        raise not_found()
    return _file_metadata_from_row(updated)
