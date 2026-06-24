import pytest

from conftest import get_workspaces, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_workspaces_requires_token(api_client) -> None:
    response = await api_client.get("/workspaces")
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "unauthenticated", "message": "Sign in to continue."}
    }


async def test_workspaces_lists_personal_workspace_for_signed_in_user(api_client, signup_user) -> None:
    user = await signup_user()

    workspaces = await get_workspaces(api_client, user)

    assert len(workspaces) == 1
    assert workspaces[0]["type"] == "personal"
    assert workspaces[0]["role"] == "owner"
