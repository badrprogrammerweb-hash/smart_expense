import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from conftest import create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_direct_income_insert_must_match_workspace_currency(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("currency-trigger-income-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    await db_connection.execute(
        text("update public.workspaces set currency = 'USD' where id = :workspace_id"),
        {"workspace_id": workspace_id},
    )

    with pytest.raises(DBAPIError, match="record currency must match the workspace currency"):
        await db_connection.execute(
            text(
                """
                insert into public.incomes(
                    workspace_id, created_by, amount_minor, currency, occurred_on
                )
                values (:workspace_id, :created_by, 1000, 'SAR', '2026-07-20')
                """
            ),
            {"workspace_id": workspace_id, "created_by": owner.user_id},
        )


async def test_direct_expense_insert_must_match_workspace_currency(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("currency-trigger-expense-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    await db_connection.execute(
        text("update public.workspaces set currency = 'EUR' where id = :workspace_id"),
        {"workspace_id": workspace_id},
    )

    with pytest.raises(DBAPIError, match="record currency must match the workspace currency"):
        await db_connection.execute(
            text(
                """
                insert into public.expenses(
                    workspace_id, created_by, amount_minor, currency, occurred_on
                )
                values (:workspace_id, :created_by, 1000, 'SAR', '2026-07-20')
                """
            ),
            {"workspace_id": workspace_id, "created_by": owner.user_id},
        )
