import pytest

from conftest import personal_workspace_id, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_non_member_workspace_detail_returns_same_404_shape_as_missing_workspace(
    api_client, signup_user
) -> None:
    user_a = await signup_user("isolation-a")
    user_b = await signup_user("isolation-b")
    workspace_id = await personal_workspace_id(api_client, user_a)

    forbidden_response = await api_client.get(
        f"/workspaces/{workspace_id}", headers=user_b.auth_header
    )
    missing_response = await api_client.get(
        "/workspaces/00000000-0000-0000-0000-000000000000",
        headers=user_b.auth_header,
    )

    assert forbidden_response.status_code == 404
    assert forbidden_response.json() == missing_response.json()
