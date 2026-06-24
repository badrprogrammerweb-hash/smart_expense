import pytest

from conftest import (
    add_member,
    create_team_workspace,
    member_for_email,
    personal_workspace_id,
    requires_supabase,
    set_role,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_member_leave_personal_workspace_and_last_owner_rules(api_client, signup_user) -> None:
    owner = await signup_user("leave-owner")
    member = await signup_user("leave-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    member_leave = await api_client.delete(
        f"/workspaces/{workspace_id}/members/me", headers=member.auth_header
    )
    assert member_leave.status_code == 204

    owner_leave_blocked = await api_client.delete(
        f"/workspaces/{workspace_id}/members/me", headers=owner.auth_header
    )
    assert owner_leave_blocked.status_code == 409
    assert owner_leave_blocked.json()["error"]["code"] == "last_owner_protected"

    co_owner = await signup_user("leave-co-owner")
    assert (await add_member(api_client, owner, workspace_id, co_owner, "member")).status_code == 201
    co_owner_member = await member_for_email(api_client, owner, workspace_id, co_owner.email)
    assert (await set_role(api_client, owner, workspace_id, co_owner_member["user_id"], "owner")).status_code == 200

    owner_leave = await api_client.delete(
        f"/workspaces/{workspace_id}/members/me", headers=owner.auth_header
    )
    assert owner_leave.status_code == 204

    personal_id = await personal_workspace_id(api_client, co_owner)
    personal_leave = await api_client.delete(
        f"/workspaces/{personal_id}/members/me", headers=co_owner.auth_header
    )
    assert personal_leave.status_code == 403
