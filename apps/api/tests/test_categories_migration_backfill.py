"""Regression coverage for the one-time existing-workspace backfill in
supabase/migrations/20260722000000_hierarchical_categories.sql Part 8
(data-model.md "Existing-workspace backfill", research.md Decision 8).

The backfill already ran once, irreversibly, against every workspace that
existed at migration time. To keep this coverage portable (a fresh CI
database has no such pre-existing data at all — every workspace it ever
creates already goes through the post-migration `seed_default_categories()`
trigger), this test does not depend on incidental historical data. Instead
it simulates the exact pre-migration shape within a single test workspace
and re-runs the same idempotent backfill SQL statements (scoped to that one
workspace) to prove the logic is correct and safe to run against real
legacy data.
"""

import pytest
from sqlalchemy import text

from app.db import get_engine
from conftest import (
    create_expense,
    create_team_workspace,
    list_expenses,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


BACKFILL_STAMP_SQL = """
update public.categories c
set is_system = true,
    translation_key = m.slug
from (values
    ('restaurants', 'restaurants'),
    ('groceries', 'groceries'),
    ('fuel', 'fuel'),
    ('transportation', 'transportation'),
    ('rent', 'rent'),
    ('utilities', 'utilities'),
    ('internet & mobile', 'internet_mobile'),
    ('health', 'health'),
    ('education', 'education'),
    ('family', 'family'),
    ('shopping', 'shopping'),
    ('entertainment', 'entertainment'),
    ('travel', 'travel'),
    ('subscriptions', 'subscriptions'),
    ('other', 'other')
) as m(name_lc, slug)
where lower(c.name) = m.name_lc
    and c.category_type = 'expense'
    and c.parent_id is null
    and c.translation_key is null
    and c.workspace_id = :workspace_id
"""

BACKFILL_EXPENSE_SUBS_SQL = """
insert into public.categories (workspace_id, category_type, parent_id, name, translation_key, is_system, sort_order)
select p.workspace_id, 'expense', p.id, v.name, p.translation_key || '.' || v.sub_slug, true, v.sort_order
from public.categories p
join (values
    ('restaurants', 'Dining Out', 'dining_out', 0),
    ('restaurants', 'Cafes & Coffee', 'cafes_coffee', 1),
    ('restaurants', 'Delivery', 'delivery', 2),
    ('groceries', 'Supermarket', 'supermarket', 0),
    ('groceries', 'Bulk & Wholesale', 'bulk_wholesale', 1),
    ('transportation', 'Public Transit', 'public_transit', 0),
    ('transportation', 'Ride-Hailing', 'ride_hailing', 1),
    ('transportation', 'Parking & Tolls', 'parking_tolls', 2),
    ('transportation', 'Vehicle Maintenance', 'vehicle_maintenance', 3),
    ('utilities', 'Electricity', 'electricity', 0),
    ('utilities', 'Water', 'water', 1),
    ('utilities', 'Gas', 'gas', 2),
    ('internet_mobile', 'Internet', 'internet', 0),
    ('internet_mobile', 'Mobile Plan', 'mobile_plan', 1),
    ('health', 'Doctor Visits', 'doctor_visits', 0),
    ('health', 'Pharmacy', 'pharmacy', 1),
    ('health', 'Insurance', 'insurance', 2),
    ('education', 'Tuition', 'tuition', 0),
    ('education', 'Books & Supplies', 'books_supplies', 1),
    ('education', 'Courses', 'courses', 2),
    ('family', 'Childcare', 'childcare', 0),
    ('family', 'Household Help', 'household_help', 1),
    ('shopping', 'Clothing', 'clothing', 0),
    ('shopping', 'Electronics', 'electronics', 1),
    ('shopping', 'Home Goods', 'home_goods', 2),
    ('entertainment', 'Movies & Events', 'movies_events', 0),
    ('entertainment', 'Hobbies', 'hobbies', 1),
    ('entertainment', 'Games & Apps', 'games_apps', 2),
    ('travel', 'Flights', 'flights', 0),
    ('travel', 'Hotels', 'hotels', 1),
    ('travel', 'Activities', 'activities', 2),
    ('subscriptions', 'Streaming', 'streaming', 0),
    ('subscriptions', 'Software', 'software', 1),
    ('subscriptions', 'Memberships', 'memberships', 2)
) as v(parent_slug, name, sub_slug, sort_order)
    on p.translation_key = v.parent_slug
where p.is_system = true
    and p.parent_id is null
    and p.category_type = 'expense'
    and p.workspace_id = :workspace_id
on conflict do nothing
"""

BACKFILL_INCOME_MAIN_SQL = """
insert into public.categories (workspace_id, category_type, name, translation_key, is_system, sort_order)
select :workspace_id, 'income', v.name, v.slug, true, v.sort_order
from (values
    ('Salary', 'salary', 0),
    ('Business Income', 'business_income', 1),
    ('Gifts', 'gifts', 2),
    ('Investment Returns', 'investment_returns', 3),
    ('Other Income', 'other_income', 4)
) as v(name, slug, sort_order)
on conflict do nothing
"""

BACKFILL_INCOME_SUB_SQL = """
insert into public.categories (workspace_id, category_type, parent_id, name, translation_key, is_system, sort_order)
select p.workspace_id, 'income', p.id, v.name, p.translation_key || '.' || v.sub_slug, true, v.sort_order
from public.categories p
join (values
    ('salary', 'Primary Job', 'primary_job', 0),
    ('salary', 'Bonus & Commission', 'bonus_commission', 1),
    ('business_income', 'Sales Revenue', 'sales_revenue', 0),
    ('business_income', 'Services Revenue', 'services_revenue', 1),
    ('investment_returns', 'Dividends', 'dividends', 0),
    ('investment_returns', 'Interest', 'interest', 1)
) as v(parent_slug, name, sub_slug, sort_order)
    on p.translation_key = v.parent_slug
where p.category_type = 'income'
    and p.parent_id is null
    and p.workspace_id = :workspace_id
on conflict do nothing
"""

DEFAULT_EXPENSE_NAMES = [
    "Restaurants", "Groceries", "Fuel", "Transportation", "Rent",
    "Utilities", "Internet & Mobile", "Health", "Education", "Family",
    "Shopping", "Entertainment", "Travel", "Subscriptions", "Other",
]

EXPECTED_EXPENSE_SUBCATEGORY_NAMES = {
    "Dining Out", "Cafes & Coffee", "Delivery",
    "Supermarket", "Bulk & Wholesale",
    "Public Transit", "Ride-Hailing", "Parking & Tolls", "Vehicle Maintenance",
    "Electricity", "Water", "Gas",
    "Internet", "Mobile Plan",
    "Doctor Visits", "Pharmacy", "Insurance",
    "Tuition", "Books & Supplies", "Courses",
    "Childcare", "Household Help",
    "Clothing", "Electronics", "Home Goods",
    "Movies & Events", "Hobbies", "Games & Apps",
    "Flights", "Hotels", "Activities",
    "Streaming", "Software", "Memberships",
}

EXPECTED_INCOME_MAIN_NAMES = {
    "Salary", "Business Income", "Gifts", "Investment Returns", "Other Income",
}

EXPECTED_INCOME_SUB_NAMES = {
    "Primary Job", "Bonus & Commission",
    "Sales Revenue", "Services Revenue",
    "Dividends", "Interest",
}


async def _execute(sql: str, params: dict) -> None:
    # A short-lived, self-committing connection — separate from any
    # ambient test transaction — so writes are immediately visible to the
    # running application's own (separate) database connection when it
    # handles the `api_client` HTTP calls below.
    engine = get_engine()
    async with engine.begin() as connection:
        await connection.execute(text(sql), params)


async def _fetch_all(sql: str, params: dict) -> list:
    engine = get_engine()
    async with engine.begin() as connection:
        result = await connection.execute(text(sql), params)
        return result.all()


async def _fetch_scalar(sql: str, params: dict):
    engine = get_engine()
    async with engine.begin() as connection:
        result = await connection.execute(text(sql), params)
        return result.scalar_one()


async def _reset_workspace_to_legacy_shape(workspace_id: str) -> None:
    # Simulate exactly the pre-Phase-13 flat shape: 15 expense main
    # categories, no subcategories, no income tree, no system/translation
    # metadata — as if this workspace had never seen this migration.
    await _execute(
        "delete from public.categories "
        "where workspace_id = :workspace_id and parent_id is not null",
        {"workspace_id": workspace_id},
    )
    await _execute(
        "delete from public.categories where workspace_id = :workspace_id",
        {"workspace_id": workspace_id},
    )
    for index, name in enumerate(DEFAULT_EXPENSE_NAMES):
        await _execute(
            """
            insert into public.categories (workspace_id, category_type, name, sort_order)
            values (:workspace_id, 'expense', :name, :sort_order)
            """,
            {"workspace_id": workspace_id, "name": name, "sort_order": index},
        )


async def test_backfill_stamps_legacy_categories_and_adds_expanded_catalog(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    await _reset_workspace_to_legacy_shape(workspace_id)

    # A category already renamed by a user before this migration ran must
    # NOT be mistakenly re-tagged as system-provided (spec Edge Cases: safe
    # under-tagging rather than guessing).
    await _execute(
        "update public.categories set name = 'Petrol' "
        "where workspace_id = :workspace_id and name = 'Fuel'",
        {"workspace_id": workspace_id},
    )

    # A category already archived by a user before this migration ran must
    # still be recognized and stamped (research.md Decision 8: identity
    # matching is independent of archived state).
    await _execute(
        "update public.categories set is_archived = true "
        "where workspace_id = :workspace_id and name = 'Restaurants'",
        {"workspace_id": workspace_id},
    )

    groceries_id = str(
        await _fetch_scalar(
            "select id from public.categories "
            "where workspace_id = :workspace_id and name = 'Groceries'",
            {"workspace_id": workspace_id},
        )
    )

    expense_response = await create_expense(
        api_client, owner, workspace_id, {"category_id": groceries_id}
    )
    assert expense_response.status_code == 201, expense_response.text
    expense_id = expense_response.json()["id"]

    # Re-run the exact one-time backfill logic from
    # supabase/migrations/20260722000000_hierarchical_categories.sql Part 8,
    # scoped to this one workspace.
    for statement in (
        BACKFILL_STAMP_SQL,
        BACKFILL_EXPENSE_SUBS_SQL,
        BACKFILL_INCOME_MAIN_SQL,
        BACKFILL_INCOME_SUB_SQL,
    ):
        await _execute(statement, {"workspace_id": workspace_id})

    rows = await _fetch_all(
        """
        select id, name, category_type, parent_id, is_system, translation_key, is_archived
        from public.categories
        where workspace_id = :workspace_id
        """,
        {"workspace_id": workspace_id},
    )
    assert len(rows) == 15 + len(EXPECTED_EXPENSE_SUBCATEGORY_NAMES) + 5 + len(EXPECTED_INCOME_SUB_NAMES)

    by_name = {row.name: row for row in rows}

    groceries = by_name["Groceries"]
    assert groceries.is_system is True
    assert groceries.translation_key == "groceries"

    restaurants = by_name["Restaurants"]
    assert restaurants.is_system is True
    assert restaurants.translation_key == "restaurants"
    assert restaurants.is_archived is True

    petrol = by_name["Petrol"]
    assert petrol.is_system is False
    assert petrol.translation_key is None

    supermarket = by_name["Supermarket"]
    assert supermarket.parent_id == groceries.id
    assert supermarket.translation_key == "groceries.supermarket"

    expense_subcategory_names = {
        row.name for row in rows if row.category_type == "expense" and row.parent_id is not None
    }
    assert expense_subcategory_names == EXPECTED_EXPENSE_SUBCATEGORY_NAMES

    income_main_names = {
        row.name for row in rows if row.category_type == "income" and row.parent_id is None
    }
    assert income_main_names == EXPECTED_INCOME_MAIN_NAMES

    income_sub_names = {
        row.name for row in rows if row.category_type == "income" and row.parent_id is not None
    }
    assert income_sub_names == EXPECTED_INCOME_SUB_NAMES

    expenses = await list_expenses(api_client, owner, workspace_id)
    persisted_expense = next(expense for expense in expenses if expense["id"] == expense_id)
    assert persisted_expense["category_id"] == groceries_id
