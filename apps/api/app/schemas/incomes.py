from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.currency import SupportedCurrency


RecordStatus = Literal["confirmed", "deleted"]
Currency = SupportedCurrency


class Income(BaseModel):
    id: UUID
    amount_minor: int
    currency: Currency = "SAR"
    occurred_on: date
    description: str | None = None
    status: RecordStatus
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncomesListResponse(BaseModel):
    incomes: list[Income]


class IncomeCreateRequest(BaseModel):
    amount_minor: int
    occurred_on: date
    description: str | None = None

    model_config = ConfigDict(extra="forbid")


class IncomeUpdateRequest(BaseModel):
    amount_minor: int | None = None
    occurred_on: date | None = None
    description: str | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def require_update_field(self) -> "IncomeUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one field is required.")
        return self
