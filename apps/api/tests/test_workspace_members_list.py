import pytest

from conftest import add_member, create_team_workspace, list_members, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_members_list_succeeds_for_member_and_404_for_non_member(api_client, signup_user) -> None:
    owner = await signup_user("members-owner")
    member = await signup_user("members-member")
    outsider = await signup_user("members-outsider")
    workspace = await create_team_workspace(api_client, owner)
    add_response = await add_member(api_client, owner, workspace["id"], member, "viewer")
    assert add_response.status_code == 201, add_response.text

    members = await list_members(api_client, member, workspace["id"])
    assert {item["email"] for item in members} == {owner.email, member.email}

    outsider_response = await api_client.get(
        f"/workspaces/{workspace['id']}/members", headers=outsider.auth_header
    )
    assert outsider_response.status_code == 404
