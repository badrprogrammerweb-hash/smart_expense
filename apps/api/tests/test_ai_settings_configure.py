import pytest
from sqlalchemy import text

from conftest import create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
GEMINI_KEY = "AIzaSyTEST-0000000000000000000000abcd"


async def _put_ai_settings(api_client, caller, workspace_id: str, body: dict):
    return await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=caller.auth_header,
        json=body,
    )


async def _settings_count(db_connection, workspace_id: str) -> int:
    result = await db_connection.execute(
        text(
            """
            select count(*)::int
            from public.workspace_ai_settings
            where workspace_id = :workspace_id
            """
        ),
        {"workspace_id": workspace_id},
    )
    return int(result.scalar_one())


async def test_owner_configures_openai_and_gemini_keys(api_client, signup_user) -> None:
    owner = await signup_user("ai-config-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    initial = await api_client.get(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
    )
    assert initial.status_code == 200, initial.text
    assert initial.json() == {
        "configured": False,
        "provider": None,
        "masked_hint": None,
        "updated_at": None,
        "updated_by": None,
        "updated_by_name": None,
    }

    openai_response = await _put_ai_settings(
        api_client,
        owner,
        workspace_id,
        {"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert openai_response.status_code == 200, openai_response.text
    openai_payload = openai_response.json()
    assert openai_payload["configured"] is True
    assert openai_payload["provider"] == "openai"
    assert openai_payload["masked_hint"].endswith("abcd")
    assert OPENAI_KEY not in openai_response.text

    gemini_response = await _put_ai_settings(
        api_client,
        owner,
        workspace_id,
        {"provider": "gemini", "api_key": GEMINI_KEY},
    )
    assert gemini_response.status_code == 200, gemini_response.text
    gemini_payload = gemini_response.json()
    assert gemini_payload["configured"] is True
    assert gemini_payload["provider"] == "gemini"
    assert gemini_payload["masked_hint"].endswith("abcd")
    assert GEMINI_KEY not in gemini_response.text


async def test_invalid_keys_and_invalid_request_store_nothing(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("ai-config-invalid-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    invalid_key_cases = [
        {"provider": "openai", "api_key": ""},
        {"provider": "openai", "api_key": "   "},
        {"provider": "openai", "api_key": "not-an-openai-key"},
        {"provider": "gemini", "api_key": "AIza-too-short"},
        {"provider": "gemini", "api_key": f" {GEMINI_KEY}"},
    ]
    for body in invalid_key_cases:
        response = await _put_ai_settings(api_client, owner, workspace_id, body)

        assert response.status_code == 422, response.text
        assert response.json()["error"]["code"] == "invalid_key_format"
        assert await _settings_count(db_connection, workspace_id) == 0

    invalid_request_cases = [
        {"api_key": OPENAI_KEY},
        {"provider": "anthropic", "api_key": OPENAI_KEY},
        {"provider": "openai"},
    ]
    for body in invalid_request_cases:
        response = await _put_ai_settings(api_client, owner, workspace_id, body)

        assert response.status_code == 422, response.text
        assert response.json()["error"]["code"] == "invalid_request"
        assert await _settings_count(db_connection, workspace_id) == 0
