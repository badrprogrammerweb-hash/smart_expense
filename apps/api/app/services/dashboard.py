import calendar
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import text

from app.schemas.dashboard import CategoryBreakdownItem, RecentRecord, SubcategoryBreakdownItem
from app.schemas.currency import SupportedCurrency


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


async def get_workspace_currency(workspace_id: UUID, conn) -> SupportedCurrency:
    result = await conn.execute(
        text("select currency from public.workspaces where id = :workspace_id"),
        {"workspace_id": str(workspace_id)},
    )
    return result.scalar_one()


async def get_category_breakdown(
    workspace_id: UUID, period_start: date, period_end: date, conn, *, table: str = "expenses"
) -> list[CategoryBreakdownItem]:
    result = await conn.execute(
        text(
            f"""
            select
                coalesce(c.parent_id, c.id) as category_id,
                coalesce(parent_c.name, c.name, 'Uncategorized') as category_name,
                sum(r.amount_minor) as total_minor,
                r.currency
            from public.{table} r
            left join public.categories c on c.id = r.category_id
            left join public.categories parent_c on parent_c.id = c.parent_id
            where r.workspace_id = :workspace_id
              and r.status = 'confirmed'
              and r.occurred_on between :period_start and :period_end
            group by coalesce(c.parent_id, c.id), coalesce(parent_c.name, c.name, 'Uncategorized'), r.currency
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
            currency=row.currency,
        )
        for row in result
    ]


async def get_main_category(workspace_id: UUID, main_category_id: UUID, conn):
    result = await conn.execute(
        text(
            """
            select id, name, category_type
            from public.categories
            where id = :main_category_id
              and workspace_id = :workspace_id
              and parent_id is null
            """
        ),
        {"main_category_id": str(main_category_id), "workspace_id": str(workspace_id)},
    )
    return result.first()


async def get_subcategory_breakdown(
    workspace_id: UUID,
    main_category_id: UUID,
    period_start: date,
    period_end: date,
    conn,
    *,
    table: str = "expenses",
) -> list[SubcategoryBreakdownItem]:
    result = await conn.execute(
        text(
            f"""
            select
                case when c.id = :main_category_id then null else c.id end as subcategory_id,
                case when c.id = :main_category_id then 'No subcategory' else c.name end as subcategory_name,
                sum(r.amount_minor) as total_minor,
                r.currency
            from public.{table} r
            join public.categories c on c.id = r.category_id
            where r.workspace_id = :workspace_id
              and r.status = 'confirmed'
              and r.occurred_on between :period_start and :period_end
              and (c.id = :main_category_id or c.parent_id = :main_category_id)
            group by
                case when c.id = :main_category_id then null else c.id end,
                case when c.id = :main_category_id then 'No subcategory' else c.name end,
                r.currency
            order by total_minor desc
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "main_category_id": str(main_category_id),
            "period_start": period_start,
            "period_end": period_end,
        },
    )
    return [
        SubcategoryBreakdownItem(
            subcategory_id=row.subcategory_id,
            subcategory_name=row.subcategory_name,
            total_minor=int(row.total_minor),
            currency=row.currency,
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
    result = await conn.execute(
        text(
            """
            select count(*)
            from public.ai_extractions
            where workspace_id = :workspace_id
              and status = 'ready_for_review'
            """
        ),
        {"workspace_id": str(workspace_id)},
    )
    return int(result.scalar_one())
