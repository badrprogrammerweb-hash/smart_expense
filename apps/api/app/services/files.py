"""Service helpers for receipt and invoice file metadata operations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


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
