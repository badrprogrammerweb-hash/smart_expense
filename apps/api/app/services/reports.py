from __future__ import annotations

import calendar
from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import DBAPIError

from app.db import database_unavailable_exception
from app.schemas.dashboard import FinancialSummary
from app.schemas.reports import ReportData, ReportPeriod, ReportPreset, SpendingSummary
from app.services import dashboard


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _invalid_period(message: str = "Select a valid reporting period.") -> HTTPException:
    return _error(status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_period", message)


def _range_too_large() -> HTTPException:
    return _error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "range_too_large",
        "Custom report ranges cannot span more than 366 days.",
    )


def _previous_month(period_start: date) -> tuple[date, date]:
    year = period_start.year
    month = period_start.month - 1
    if month == 0:
        year -= 1
        month = 12

    start = date(year, month, 1)
    end = start.replace(day=calendar.monthrange(year, month)[1])
    return start, end


def _validate_range(period_start: date, period_end: date) -> None:
    if period_end < period_start:
        raise _invalid_period("Report end date must be on or after the start date.")

    if (period_end - period_start).days + 1 > 366:
        raise _range_too_large()


def resolve_report_period(
    period: ReportPreset = ReportPreset.CURRENT_MONTH,
    start: date | None = None,
    end: date | None = None,
) -> ReportPeriod:
    if period == ReportPreset.CURRENT_MONTH:
        period_start, period_end = dashboard.get_current_period()
    elif period == ReportPreset.PREVIOUS_MONTH:
        current_start, _ = dashboard.get_current_period()
        period_start, period_end = _previous_month(current_start)
    elif period == ReportPreset.CUSTOM:
        if start is None or end is None:
            raise _invalid_period("Custom reports require start and end dates.")
        period_start = start
        period_end = end
    else:
        raise _invalid_period()

    _validate_range(period_start, period_end)
    return ReportPeriod(preset=period, start=period_start, end=period_end)


def previous_comparable_period(period: ReportPeriod) -> tuple[date, date]:
    span = period.end - period.start
    previous_end = period.start - timedelta(days=1)
    previous_start = previous_end - span
    return previous_start, previous_end


async def get_report_data(
    workspace_id: UUID,
    report_period: ReportPeriod,
    session,
    recent_limit: int = 5,
) -> ReportData:
    try:
        income_total = await dashboard.get_income_total(
            workspace_id, report_period.start, report_period.end, session
        )
        expense_total = await dashboard.get_expense_total(
            workspace_id, report_period.start, report_period.end, session
        )
        category_breakdown = await dashboard.get_category_breakdown(
            workspace_id, report_period.start, report_period.end, session
        )
        recent_records = await dashboard.get_recent_records(
            workspace_id, report_period.start, report_period.end, recent_limit, session
        )
        pending_review_count = await dashboard.get_pending_ai_count(workspace_id, session)
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    summary = FinancialSummary(
        total_income_minor=income_total,
        total_expenses_minor=expense_total,
        remaining_balance_minor=income_total - expense_total,
    )

    return ReportData(
        workspace_id=workspace_id,
        period=report_period,
        summary=summary,
        category_breakdown=category_breakdown,
        spending_trend=[],
        top_merchants=[],
        recent_records=recent_records,
        team_activity=[],
        pending_review_count=pending_review_count,
        spending_summary=SpendingSummary(
            total_income_minor=income_total,
            total_expenses_minor=expense_total,
            remaining_balance_minor=income_total - expense_total,
            top_category=None,
        ),
    )
