from uuid import uuid4

import pytest
from sqlalchemy import text

from conftest import create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_activity_history_is_forward_only_without_backfill(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("history-forward-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    preexisting_expense_id = str(uuid4())

    await db_connection.execute(text("alter table public.expenses disable trigger expenses_record_activity"))
    try:
        await db_connection.execute(
            text(
                """
                insert into public.expenses (
                    id, workspace_id, created_by, amount_minor, occurred_on, merchant_name
                )
                values (
                    :id, :workspace_id, :created_by, 4200, '2026-07-08', 'Before History'
                )
                """
            ),
            {
                "id": preexisting_expense_id,
                "workspace_id": workspace_id,
                "created_by": owner.user_id,
            },
        )
    finally:
        await db_connection.execute(text("alter table public.expenses enable trigger expenses_record_activity"))

    result = await db_connection.execute(
        text(
            """
            select count(*)::int
            from public.activity_history
            where workspace_id = :workspace_id
              and entity_id = :entity_id
            """
        ),
        {"workspace_id": workspace_id, "entity_id": preexisting_expense_id},
    )
    assert result.scalar_one() == 0

