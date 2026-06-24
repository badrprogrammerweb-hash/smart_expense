import pytest
from sqlalchemy import text

from app.db import get_engine
from conftest import ensure_personal_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_signup_bootstrap_creates_profile_personal_workspace_and_owner_membership(
    api_client, signup_user
) -> None:
    user = await signup_user()

    async with get_engine().begin() as db_connection:
        await ensure_personal_workspace(db_connection, user)
        await ensure_personal_workspace(db_connection, user)

        profile_count = (
            await db_connection.execute(
                text("select count(*)::int from public.user_profiles where id = :user_id"),
                {"user_id": user.user_id},
            )
        ).scalar_one()
        personal_count = (
            await db_connection.execute(
                text(
                    """
                    select count(*)::int
                    from public.workspaces
                    where created_by = :user_id
                      and type = 'personal'
                    """
                ),
                {"user_id": user.user_id},
            )
        ).scalar_one()
        owner_count = (
            await db_connection.execute(
                text(
                    """
                    select count(*)::int
                    from public.workspace_memberships wm
                    join public.workspaces w on w.id = wm.workspace_id
                    where wm.user_id = :user_id
                      and wm.role = 'owner'
                      and w.type = 'personal'
                    """
                ),
                {"user_id": user.user_id},
            )
        ).scalar_one()

        assert profile_count == 1
        assert personal_count == 1
        assert owner_count == 1

    response = await api_client.get("/workspaces", headers=user.auth_header)
    assert response.status_code == 200, response.text
    workspaces = response.json()["workspaces"]
    assert len([workspace for workspace in workspaces if workspace["type"] == "personal"]) == 1
