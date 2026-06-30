from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


Currency = Literal["SAR"]
RecordType = Literal["income", "expense"]


class FinancialSummary(BaseModel):
    total_income_minor: int
    total_expenses_minor: int
    remaining_balance_minor: int
    currency: Currency = "SAR"


class CategoryBreakdownItem(BaseModel):
    category_id: UUID | None = None
    category_name: str
    total_minor: int
    currency: Currency = "SAR"


class RecentRecord(BaseModel):
    type: RecordType
    id: UUID
    amount_minor: int
    currency: Currency = "SAR"
    occurred_on: date
    description: str | None = None
    merchant_name: str | None = None
    category_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)


class DashboardPeriod(BaseModel):
    start: date
    end: date


class DashboardData(BaseModel):
    workspace_id: UUID
    period: DashboardPeriod
    summary: FinancialSummary
    category_breakdown: list[CategoryBreakdownItem]
    recent_records: list[RecentRecord]
    pending_ai_count: int
