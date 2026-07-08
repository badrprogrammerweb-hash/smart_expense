from datetime import date
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.dashboard import CategoryBreakdownItem, FinancialSummary, RecentRecord


class ReportPreset(StrEnum):
    CURRENT_MONTH = "current_month"
    PREVIOUS_MONTH = "previous_month"
    CUSTOM = "custom"


class TrendGranularity(StrEnum):
    DAY = "day"
    MONTH = "month"


class TrendDirection(StrEnum):
    UP = "up"
    DOWN = "down"
    FLAT = "flat"


class ReportPeriod(BaseModel):
    preset: ReportPreset | None = None
    start: date
    end: date


class TrendPoint(BaseModel):
    bucket: date
    granularity: TrendGranularity
    income_minor: int
    expense_minor: int
    remaining_minor: int
    currency: str = "SAR"


class MerchantTotal(BaseModel):
    merchant_name: str
    total_minor: int
    count: int
    currency: str = "SAR"


class TeamActivityItem(BaseModel):
    user_id: UUID
    display_name: str | None = None
    records_created: int


class TopCategorySummary(BaseModel):
    category_id: UUID | None = None
    category_name: str
    total_minor: int
    currency: str = "SAR"


class SpendingSummary(BaseModel):
    total_income_minor: int
    total_expenses_minor: int
    remaining_balance_minor: int
    top_category: TopCategorySummary | None = None
    trend_direction: TrendDirection = TrendDirection.FLAT
    currency: str = "SAR"


class ReportData(BaseModel):
    workspace_id: UUID
    period: ReportPeriod
    summary: FinancialSummary
    category_breakdown: list[CategoryBreakdownItem]
    spending_trend: list[TrendPoint]
    top_merchants: list[MerchantTotal]
    recent_records: list[RecentRecord]
    team_activity: list[TeamActivityItem]
    pending_review_count: int
    spending_summary: SpendingSummary

    model_config = ConfigDict(from_attributes=True)
