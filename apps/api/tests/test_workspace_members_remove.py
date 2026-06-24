import pytest

from conftest import add_member, create_team_workspace, member_for_email, remove_member, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_member_remove_matrix_and_removed_user_loses_access(api_client, signup_user) -> None:
    owner = await signup_user("remove-owner")
    admin = await signup_user("remove-admin")
    member = await signup_user("remove-member")
    viewer = await signup_user("remove-viewer")
    target = await signup_user("remove-target")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, target, "member")).status_code == 201

    target_member = await member_for_email(api_client, owner, workspace_id, target.email)
    assert (await remove_member(api_client, member, workspace_id, target_member["user_id"])).status_code == 403
    assert (await remove_member(api_client, viewer, workspace_id, target_member["user_id"])).status_code == 403
    assert (await remove_member(api_client, admin, workspace_id, target_member["user_id"])).status_code == 204

    removed_access = await api_client.get(f"/workspaces/{workspace_id}", headers=target.auth_header)
    assert removed_access.status_code == 404

    owner_member = await member_for_email(api_client, owner, workspace_id, owner.email)
    last_owner_response = await remove_member(api_client, owner, workspace_id, owner_member["user_id"])
    assert last_owner_response.status_code == 409
    assert last_owner_response.json()["error"]["code"] == "last_owner_protected"
