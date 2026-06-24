import pytest

from conftest import add_member, create_team_workspace, member_for_email, requires_supabase, set_role


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_member_role_update_matrix(api_client, signup_user) -> None:
    owner = await signup_user("role-owner")
    admin = await signup_user("role-admin")
    member = await signup_user("role-member")
    viewer = await signup_user("role-viewer")
    target = await signup_user("role-target")
    co_owner = await signup_user("role-co-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, target, "viewer")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, co_owner, "member")).status_code == 201

    target_member = await member_for_email(api_client, owner, workspace_id, target.email)
    co_owner_member = await member_for_email(api_client, owner, workspace_id, co_owner.email)

    assert (await set_role(api_client, owner, workspace_id, co_owner_member["user_id"], "owner")).status_code == 200
    assert (await set_role(api_client, owner, workspace_id, target_member["user_id"], "admin")).status_code == 200
    assert (await set_role(api_client, admin, workspace_id, target_member["user_id"], "member")).status_code == 200
    assert (await set_role(api_client, admin, workspace_id, target_member["user_id"], "owner")).status_code == 403
    assert (await set_role(api_client, admin, workspace_id, co_owner_member["user_id"], "viewer")).status_code == 403
    assert (await set_role(api_client, member, workspace_id, target_member["user_id"], "viewer")).status_code == 403
    assert (await set_role(api_client, viewer, workspace_id, target_member["user_id"], "viewer")).status_code == 403

    invalid_response = await set_role(api_client, owner, workspace_id, target_member["user_id"], "superadmin")
    assert invalid_response.status_code == 422
    assert invalid_response.json()["error"]["code"] == "invalid_role"
