"""Account deletion through the Supabase Auth Admin API.

Deleting a user from Auth (the Dashboard's Authentication -> Users screen, and
the Admin API this exercises) cascades into `public.user_profiles` and from
there through the whole workspace graph. Two guards written for the ordinary
application paths used to fire during that cascade and made *every* account
undeletable -- see supabase/migrations/20260818000000_auth_user_deletion_teardown.sql.

These tests pin the resulting semantics from the outside: the teardown must
succeed for an account that owns only its own data, and must refuse rather than
destroy a team workspace other people are still members of.
"""

import os

import httpx
import pytest
from sqlalchemy import text

from conftest import (
    add_member,
    create_team_workspace,
    create_expense,
    personal_workspace_id,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def admin_delete_user(user_id: str) -> httpx.Response:
    """Delete a user exactly the way the Supabase Dashboard does."""

    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    async with httpx.AsyncClient(base_url=supabase_url, timeout=30, trust_env=False) as client:
        return await client.delete(
            f"/auth/v1/admin/users/{user_id}",
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        )


async def _count(connection, sql: str, **params) -> int:
    result = await connection.execute(text(sql), params)
    return int(result.scalar_one())


async def test_deleting_account_tears_down_its_own_workspace(
    api_client, db_connection, signup_user
) -> None:
    user = await signup_user("delete-solo")
    workspace_id = await personal_workspace_id(api_client, user)

    response = await admin_delete_user(user.user_id)
    assert response.status_code == 200, response.text

    assert await _count(
        db_connection, "select count(*) from auth.users where id = :id", id=user.user_id
    ) == 0
    assert await _count(
        db_connection, "select count(*) from public.user_profiles where id = :id", id=user.user_id
    ) == 0
    assert await _count(
        db_connection, "select count(*) from public.workspaces where id = :id", id=workspace_id
    ) == 0
    # Categories are seeded per workspace and must go with it rather than
    # tripping the standalone `category_has_references` guard.
    assert await _count(
        db_connection,
        "select count(*) from public.categories where workspace_id = :id",
        id=workspace_id,
    ) == 0
    assert await _count(
        db_connection,
        "select count(*) from public.workspace_memberships where user_id = :id",
        id=user.user_id,
    ) == 0


async def test_deleting_account_is_refused_while_a_shared_team_workspace_remains(
    api_client, db_connection, signup_user
) -> None:
    owner = await signup_user("delete-owner")
    member = await signup_user("delete-teammate")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await create_expense(api_client, member, workspace_id)).status_code == 201

    response = await admin_delete_user(owner.user_id)
    assert response.status_code != 200, (
        "Deleting the creator of a shared team workspace must be refused: the "
        "`workspaces.created_by` cascade would otherwise destroy the workspace "
        "together with every other member's records."
    )

    # Nothing may have been destroyed by the attempt.
    assert await _count(
        db_connection, "select count(*) from auth.users where id = :id", id=owner.user_id
    ) == 1
    assert await _count(
        db_connection, "select count(*) from public.workspaces where id = :id", id=workspace_id
    ) == 1
    assert await _count(
        db_connection,
        "select count(*) from public.expenses where workspace_id = :id",
        id=workspace_id,
    ) == 1
    assert await _count(
        db_connection,
        "select count(*) from public.workspace_memberships where workspace_id = :id",
        id=workspace_id,
    ) == 2


async def test_deleting_a_plain_member_leaves_the_shared_workspace_intact(
    api_client, db_connection, signup_user
) -> None:
    owner = await signup_user("delete-host")
    member = await signup_user("delete-guest")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    response = await admin_delete_user(member.user_id)
    assert response.status_code == 200, response.text

    assert await _count(
        db_connection, "select count(*) from public.workspaces where id = :id", id=workspace_id
    ) == 1
    assert await _count(
        db_connection, "select count(*) from auth.users where id = :id", id=owner.user_id
    ) == 1
    assert await _count(
        db_connection,
        "select count(*) from public.workspace_memberships where workspace_id = :id",
        id=workspace_id,
    ) == 1
    # The workspace survives, so its history must still record the departure --
    # the teardown guard added to `record_activity()` must not suppress this.
    assert await _count(
        db_connection,
        """
        select count(*) from public.activity_history
         where workspace_id = :id and event_type = 'member_removed'
        """,
        id=workspace_id,
    ) == 1


async def test_last_owner_invariant_still_applies_to_a_surviving_workspace(
    api_client, signup_user
) -> None:
    """The teardown escape must not weaken the guard on the ordinary path."""

    owner = await signup_user("delete-invariant")
    workspace_id = (await create_team_workspace(api_client, owner))["id"]

    blocked = await api_client.delete(
        f"/workspaces/{workspace_id}/members/me", headers=owner.auth_header
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "last_owner_protected"
