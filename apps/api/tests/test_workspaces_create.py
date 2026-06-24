import pytest

from conftest import requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_create_team_workspace_returns_owner_role(api_client, signup_user) -> None:
    owner = await signup_user("team-owner")

    response = await api_client.post(
        "/workspaces", headers=owner.auth_header, json={"name": "Family Budget"}
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["type"] == "team"
    assert payload["name"] == "Family Budget"
    assert payload["role"] == "owner"
