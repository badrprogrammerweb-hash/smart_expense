import calendar
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import text

from app.schemas.dashboard import CategoryBreakdownItem, RecentRecord


def get_current_period() -> tuple[date, date]:
    tz_utc3 = timezone(timedelta(hours=3))
    now_local = datetime.now(tz_utc3)
    period_start = now_local.date().replace(day=1)
    last_day = calendar.monthrange(period_start.year, period_start.month)[1]
    period_end = period_start.replace(day=last_day)
    return period_start, period_end


async def get_income_total(
    workspace_id: UUID, period_start: date, period_end: date, conn
) -> int:
    result = await conn.execute(
        text(
            """
            select coalesce(sum(amount_minor), 0) as total_income_minor
            from public.incomes
            where workspace_id = :workspace_id
              and status = 'confirmed'
              and occurred_on between :period_start and :period_end
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "period_start": period_start,
            "period_end": period_end,
        },
    )
    return int(result.scalar_one())


async def get_expense_total(
    workspace_id: UUID, period_start: date, period_end: date, conn
) -> int:
    result = await conn.execute(
        text(
            """
            select coalesce(sum(amount_minor), 0) as total_expenses_minor
            from public.expenses
            where workspace_id = :workspace_id
              and status = 'confirmed'
              and occurred_on between :period_start and :period_end
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "period_start": period_start,
            "period_end": period_end,
        },
    )
    return int(result.scalar_one())


async def get_category_breakdown(
    workspace_id: UUID, period_start: date, period_end: date, conn
) -> list[CategoryBreakdownItem]:
    result = await conn.execute(
        text(
            """
            select
                e.category_id,
                coalesce(c.name, 'Uncategorized') as category_name,
                sum(e.amount_minor) as total_minor
            from public.expenses e
            left join public.categories c on c.id = e.category_id
            where e.workspace_id = :workspace_id
              and e.status = 'confirmed'
              and e.occurred_on between :period_start and :period_end
            group by e.category_id, c.name
            order by total_minor desc
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "period_start": period_start,
            "period_end": period_end,
        },
    )
    return [
        CategoryBreakdownItem(
            category_id=row.category_id,
            category_name=row.category_name,
            total_minor=int(row.total_minor),
        )
        for row in result
    ]


async def get_recent_records(
    workspace_id: UUID, period_start: date, period_end: date, recent_limit: int, conn
) -> list[RecentRecord]:
    result = await conn.execute(
        text(
            """
            select type, id, amount_minor, currency, occurred_on, description,
                   merchant_name, category_id
            from (
                select 'income' as type,
                       id, amount_minor, currency, occurred_on, description,
                       cast(null as text) as merchant_name,
                       cast(null as uuid) as category_id,
                       created_at
                from public.incomes
                where workspace_id = :workspace_id
                  and status = 'confirmed'
                  and occurred_on between :period_start and :period_end

                union all

                select 'expense' as type,
                       id, amount_minor, currency, occurred_on, description,
                       merchant_name,
                       category_id,
                       created_at
                from public.expenses
                where workspace_id = :workspace_id
                  and status = 'confirmed'
                  and occurred_on between :period_start and :period_end
            ) records
            order by occurred_on desc, created_at desc
            limit :recent_limit
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "period_start": period_start,
            "period_end": period_end,
            "recent_limit": recent_limit,
        },
    )
    return [
        RecentRecord(
            type=row.type,
            id=row.id,
            amount_minor=row.amount_minor,
            currency=row.currency,
            occurred_on=row.occurred_on,
            description=row.description,
            merchant_name=row.merchant_name,
            category_id=row.category_id,
        )
        for row in result
    ]


async def get_pending_ai_count(workspace_id: UUID, conn) -> int:
    return 0
