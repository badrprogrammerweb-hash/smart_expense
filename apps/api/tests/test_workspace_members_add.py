import pytest

from conftest import (
    add_member,
    create_team_workspace,
    get_workspaces,
    member_for_email,
    requires_supabase,
    set_role,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_add_member_role_matrix_and_errors(api_client, signup_user) -> None:
    owner = await signup_user("add-owner")
    admin = await signup_user("add-admin")
    member = await signup_user("add-member")
    viewer = await signup_user("add-viewer")
    duplicate = await signup_user("add-duplicate")
    outsider = await signup_user("add-outsider")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201
    assert (await add_member(api_client, admin, workspace_id, duplicate, "viewer")).status_code == 201

    assert (await add_member(api_client, member, workspace_id, outsider, "viewer")).status_code == 403
    assert (await add_member(api_client, viewer, workspace_id, outsider, "viewer")).status_code == 403

    unknown_response = await api_client.post(
        f"/workspaces/{workspace_id}/members",
        headers=owner.auth_header,
        json={"email": "missing@example.com", "role": "viewer"},
    )
    assert unknown_response.status_code == 404
    assert unknown_response.json()["error"]["code"] == "user_not_found"

    duplicate_response = await add_member(api_client, owner, workspace_id, duplicate, "admin")
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["error"]["code"] == "already_a_member"
    assert (await member_for_email(api_client, owner, workspace_id, duplicate.email))["role"] == "viewer"

    owner_role_response = await add_member(api_client, owner, workspace_id, outsider, "owner")
    assert owner_role_response.status_code == 422
    assert owner_role_response.json()["error"]["code"] == "invalid_role"

    for index in range(5):
        extra = await signup_user(f"add-extra-{index}")
        assert (await add_member(api_client, owner, workspace_id, extra, "viewer")).status_code == 201

    limit_user = await signup_user("add-limit")
    limit_response = await add_member(api_client, owner, workspace_id, limit_user, "viewer")
    assert limit_response.status_code == 409
    assert limit_response.json()["error"]["code"] == "member_limit_reached"

    outsider_workspaces = await get_workspaces(api_client, outsider)
    assert workspace_id not in {workspace["id"] for workspace in outsider_workspaces}
