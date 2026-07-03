"""Schemas for receipt and invoice file metadata APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


FileContentType = Literal["image/png", "image/jpeg", "image/webp", "application/pdf"]
FileStatus = Literal["active", "deleted"]
FileErrorCode = Literal[
    "unauthenticated",
    "forbidden",
    "not_found",
    "file_deleted",
    "file_too_large",
    "unsupported_file_type",
    "empty_file",
    "cross_workspace_link",
]


class FileMetadata(BaseModel):
    id: UUID
    original_filename: str
    content_type: FileContentType
    size_bytes: int
    expense_id: UUID | None = None
    uploaded_by: UUID
    status: FileStatus
    created_at: datetime
    deleted_at: datetime | None = None
    deleted_by: UUID | None = None

    model_config = ConfigDict(from_attributes=True)


class FileListResponse(BaseModel):
    files: list[FileMetadata]


class LinkRequest(BaseModel):
    expense_id: UUID

    model_config = ConfigDict(extra="forbid")


class SignedUrlResponse(BaseModel):
    url: str
    expires_in: int = Field(ge=1, le=300)


class FileErrorPayload(BaseModel):
    code: FileErrorCode
    message: str


class FileTooLargeErrorPayload(FileErrorPayload):
    code: Literal["file_too_large"] = "file_too_large"
    limit_bytes: int = Field(default=10485760)
