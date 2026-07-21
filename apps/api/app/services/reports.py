from __future__ import annotations

import calendar
from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db import database_unavailable_exception
from app.schemas.dashboard import FinancialSummary
from app.schemas.currency import SupportedCurrency
from app.schemas.reports import (
    MerchantTotal,
    ReportData,
    ReportPeriod,
    ReportPreset,
    SpendingSummary,
    SubcategoryDrilldownResponse,
    TeamActivityItem,
    TopCategorySummary,
    TrendDirection,
    TrendGranularity,
    TrendPoint,
)
from app.services import dashboard


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _invalid_period(message: str = "Select a valid reporting period.") -> HTTPException:
    return _error(status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_period", message)


def _not_found() -> HTTPException:
    return _error(status.HTTP_404_NOT_FOUND, "not_found", "Category not found.")


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


async def get_spending_trend(
    workspace_id: UUID,
    period_start: date,
    period_end: date,
    conn,
    currency: SupportedCurrency,
) -> list[TrendPoint]:
    span_days = (period_end - period_start).days + 1
    granularity = TrendGranularity.DAY if span_days <= 31 else TrendGranularity.MONTH
    bucket_expression = (
        "occurred_on"
        if granularity == TrendGranularity.DAY
        else "date_trunc('month', occurred_on::timestamp)::date"
    )

    result = await conn.execute(
        text(
            f"""
            select
                bucket,
                coalesce(sum(income_minor), 0) as income_minor,
                coalesce(sum(expense_minor), 0) as expense_minor
            from (
                select
                    {bucket_expression} as bucket,
                    amount_minor as income_minor,
                    0::bigint as expense_minor
                from public.incomes
                where workspace_id = :workspace_id
                  and status = 'confirmed'
                  and occurred_on between :period_start and :period_end

                union all

                select
                    {bucket_expression} as bucket,
                    0::bigint as income_minor,
                    amount_minor as expense_minor
                from public.expenses
                where workspace_id = :workspace_id
                  and status = 'confirmed'
                  and occurred_on between :period_start and :period_end
            ) records
            group by bucket
            order by bucket asc
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "period_start": period_start,
            "period_end": period_end,
        },
    )

    points: list[TrendPoint] = []
    for row in result:
        income_minor = int(row.income_minor or 0)
        expense_minor = int(row.expense_minor or 0)
        points.append(
            TrendPoint(
                bucket=row.bucket,
                granularity=granularity,
                income_minor=income_minor,
                expense_minor=expense_minor,
                remaining_minor=income_minor - expense_minor,
                currency=currency,
            )
        )
    return points


async def get_top_merchants(
    workspace_id: UUID,
    period_start: date,
    period_end: date,
    conn,
    currency: SupportedCurrency,
    limit: int = 5,
) -> list[MerchantTotal]:
    result = await conn.execute(
        text(
            """
            select
                btrim(merchant_name) as merchant_name,
                sum(amount_minor) as total_minor,
                count(*) as record_count
            from public.expenses
            where workspace_id = :workspace_id
              and status = 'confirmed'
              and occurred_on between :period_start and :period_end
              and merchant_name is not null
              and btrim(merchant_name) <> ''
            group by btrim(merchant_name)
            order by total_minor desc, merchant_name asc
            limit :limit
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "period_start": period_start,
            "period_end": period_end,
            "limit": limit,
        },
    )

    return [
        MerchantTotal(
            merchant_name=row.merchant_name,
            total_minor=int(row.total_minor),
            count=int(row.record_count),
            currency=currency,
        )
        for row in result
    ]


async def get_team_activity(
    workspace_id: UUID,
    period_start: date,
    period_end: date,
    conn,
) -> list[TeamActivityItem]:
    result = await conn.execute(
        text(
            """
            select
                records.created_by as user_id,
                coalesce(nullif(up.display_name, ''), up.email) as display_name,
                count(*)::int as records_created
            from (
                select created_by
                from public.incomes
                where workspace_id = :workspace_id
                  and status = 'confirmed'
                  and (created_at at time zone 'Asia/Riyadh')::date between :period_start and :period_end

                union all

                select created_by
                from public.expenses
                where workspace_id = :workspace_id
                  and status = 'confirmed'
                  and (created_at at time zone 'Asia/Riyadh')::date between :period_start and :period_end
            ) records
            left join public.user_profiles up on up.id = records.created_by
            group by records.created_by, up.display_name, up.email
            order by records_created desc, display_name asc
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "period_start": period_start,
            "period_end": period_end,
        },
    )

    return [
        TeamActivityItem(
            user_id=row.user_id,
            display_name=row.display_name,
            records_created=int(row.records_created),
        )
        for row in result
    ]


def _trend_direction(current_expenses: int, previous_expenses: int) -> TrendDirection:
    if current_expenses > previous_expenses:
        return TrendDirection.UP
    if current_expenses < previous_expenses:
        return TrendDirection.DOWN
    return TrendDirection.FLAT


def _spending_summary(
    income_total: int,
    expense_total: int,
    previous_expense_total: int,
    category_breakdown,
    currency: SupportedCurrency,
) -> SpendingSummary:
    top_category = None
    if category_breakdown:
        first_category = category_breakdown[0]
        top_category = TopCategorySummary(
            category_id=first_category.category_id,
            category_name=first_category.category_name,
            total_minor=first_category.total_minor,
            currency=first_category.currency,
        )

    return SpendingSummary(
        total_income_minor=income_total,
        total_expenses_minor=expense_total,
        remaining_balance_minor=income_total - expense_total,
        top_category=top_category,
        trend_direction=_trend_direction(expense_total, previous_expense_total),
        currency=currency,
    )


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
        currency = await dashboard.get_workspace_currency(workspace_id, session)
        category_breakdown = await dashboard.get_category_breakdown(
            workspace_id, report_period.start, report_period.end, session
        )
        income_category_breakdown = await dashboard.get_category_breakdown(
            workspace_id, report_period.start, report_period.end, session, table="incomes"
        )
        spending_trend = await get_spending_trend(
            workspace_id, report_period.start, report_period.end, session, currency
        )
        top_merchants = await get_top_merchants(
            workspace_id, report_period.start, report_period.end, session, currency
        )
        team_activity = await get_team_activity(
            workspace_id, report_period.start, report_period.end, session
        )
        recent_records = await dashboard.get_recent_records(
            workspace_id, report_period.start, report_period.end, recent_limit, session
        )
        pending_review_count = await dashboard.get_pending_ai_count(workspace_id, session)
        previous_start, previous_end = previous_comparable_period(report_period)
        previous_expense_total = await dashboard.get_expense_total(
            workspace_id, previous_start, previous_end, session
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    summary = FinancialSummary(
        total_income_minor=income_total,
        total_expenses_minor=expense_total,
        remaining_balance_minor=income_total - expense_total,
        currency=currency,
    )

    return ReportData(
        workspace_id=workspace_id,
        period=report_period,
        summary=summary,
        category_breakdown=category_breakdown,
        income_category_breakdown=income_category_breakdown,
        spending_trend=spending_trend,
        top_merchants=top_merchants,
        recent_records=recent_records,
        team_activity=team_activity,
        pending_review_count=pending_review_count,
        spending_summary=_spending_summary(
            income_total, expense_total, previous_expense_total, category_breakdown, currency
        ),
    )


async def get_subcategory_drilldown(
    workspace_id: UUID,
    main_category_id: UUID,
    report_period: ReportPeriod,
    session,
) -> SubcategoryDrilldownResponse:
    try:
        main_category = await dashboard.get_main_category(workspace_id, main_category_id, session)
        if main_category is None:
            raise _not_found()

        table = "incomes" if main_category.category_type == "income" else "expenses"
        subcategory_breakdown = await dashboard.get_subcategory_breakdown(
            workspace_id,
            main_category_id,
            report_period.start,
            report_period.end,
            session,
            table=table,
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    return SubcategoryDrilldownResponse(
        main_category_id=main_category.id,
        main_category_name=main_category.name,
        subcategory_breakdown=subcategory_breakdown,
    )
