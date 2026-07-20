from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.currency import SupportedCurrency
from app.schemas.files import FileMetadata


RecordStatus = Literal["confirmed", "deleted"]
Currency = SupportedCurrency


class Expense(BaseModel):
    id: UUID
    amount_minor: int
    currency: Currency
    occurred_on: date
    category_id: UUID | None = None
    description: str | None = None
    merchant_name: str | None = None
    status: RecordStatus
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    files: list[FileMetadata] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ExpensesListResponse(BaseModel):
    expenses: list[Expense]


class ExpenseCreateRequest(BaseModel):
    amount_minor: int
    occurred_on: date
    category_id: UUID | None = None
    description: str | None = None
    merchant_name: str | None = None

    model_config = ConfigDict(extra="forbid")


class ExpenseUpdateRequest(BaseModel):
    amount_minor: int | None = None
    occurred_on: date | None = None
    category_id: UUID | None = None
    description: str | None = None
    merchant_name: str | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def require_update_field(self) -> "ExpenseUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one field is required.")
        return self
