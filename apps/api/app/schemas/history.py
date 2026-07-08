from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ActivityEventType(StrEnum):
    INCOME_CREATED = "income_created"
    INCOME_UPDATED = "income_updated"
    INCOME_DELETED = "income_deleted"
    EXPENSE_CREATED = "expense_created"
    EXPENSE_UPDATED = "expense_updated"
    EXPENSE_DELETED = "expense_deleted"
    CATEGORY_CREATED = "category_created"
    CATEGORY_UPDATED = "category_updated"
    CATEGORY_ARCHIVED = "category_archived"
    FILE_UPLOADED = "file_uploaded"
    FILE_DELETED = "file_deleted"
    EXTRACTION_STARTED = "extraction_started"
    EXTRACTION_COMPLETED = "extraction_completed"
    EXTRACTION_FAILED = "extraction_failed"
    AI_DRAFT_CONFIRMED = "ai_draft_confirmed"
    MEMBER_ADDED = "member_added"
    MEMBER_REMOVED = "member_removed"
    ROLE_CHANGED = "role_changed"
    SETTING_CHANGED = "setting_changed"


class ActivityHistoryItem(BaseModel):
    id: UUID
    event_type: ActivityEventType
    actor_user_id: UUID | None = None
    actor_display_name: str | None = None
    entity_table: str
    entity_id: UUID | None = None
    summary: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HistoryPage(BaseModel):
    items: list[ActivityHistoryItem]
    next_before: datetime | None = None
