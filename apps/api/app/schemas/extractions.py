"""Schemas for AI extraction and review APIs."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.ai_settings import AiProvider


class ExtractionStatus(StrEnum):
    PROCESSING = "processing"
    READY_FOR_REVIEW = "ready_for_review"
    FAILED = "failed"
    CONFIRMED = "confirmed"
    DISCARDED = "discarded"


class FailureReason(StrEnum):
    INVALID_KEY = "invalid_key"
    RATE_LIMITED = "rate_limited"
    TIMEOUT = "timeout"
    UNREADABLE_FILE = "unreadable_file"
    MALFORMED_RESPONSE = "malformed_response"
    PROVIDER_ERROR = "provider_error"


class ExtractionDraft(BaseModel):
    amount_minor: int | None = None
    extracted_currency: str | None = None
    occurred_on: date | None = None
    vendor_name: str | None = None
    suggested_category: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ExtractionRead(BaseModel):
    id: UUID
    workspace_id: UUID
    file_id: UUID
    provider: AiProvider
    status: ExtractionStatus
    draft: ExtractionDraft | None = None
    failure_reason: FailureReason | None = None
    triggered_by: UUID
    triggered_at: datetime
    confirmed_by: UUID | None = None
    confirmed_at: datetime | None = None
    discarded_by: UUID | None = None
    discarded_at: datetime | None = None
    expense_id: UUID | None = None
    can_edit: bool
    can_discard: bool

    model_config = ConfigDict(from_attributes=True)


class ConfirmExtractionRequest(BaseModel):
    amount_minor: int
    occurred_on: date
    category_id: UUID | None = None
    merchant_name: str | None = None
    description: str | None = None

    model_config = ConfigDict(extra="forbid")
