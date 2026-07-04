import asyncio

import pytest
from sqlalchemy import text

from conftest import create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
OPENAI_ROTATED_KEY = "sk-test-1111111111111111wxyz"
GEMINI_KEY = "AIzaSyTEST-2222222222222222222222lmno"


async def _put(api_client, caller, workspace_id: str, provider: str, api_key: str):
    return await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=caller.auth_header,
        json={"provider": provider, "api_key": api_key},
    )


async def _row(db_connection, workspace_id: str):
    return (
        await db_connection.execute(
            text(
                """
                select provider, key_last4, vault_secret_id, updated_at
                from public.workspace_ai_settings
                where workspace_id = :workspace_id
                """
            ),
            {"workspace_id": workspace_id},
        )
    ).one()


async def _decrypted_secret(db_connection, secret_id: str) -> str | None:
    return (
        await db_connection.execute(
            text(
                """
                select decrypted_secret
                from vault.decrypted_secrets
                where id = :secret_id
                """
            ),
            {"secret_id": secret_id},
        )
    ).scalar_one_or_none()


async def _settings_count(db_connection, workspace_id: str) -> int:
    return int(
        (
            await db_connection.execute(
                text(
                    """
                    select count(*)::int
                    from public.workspace_ai_settings
                    where workspace_id = :workspace_id
                    """
                ),
                {"workspace_id": workspace_id},
            )
        ).scalar_one()
    )


async def test_rotate_switch_and_invalid_replacement_preserve_single_config(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("ai-replace-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    initial = await _put(api_client, owner, workspace_id, "openai", OPENAI_KEY)
    assert initial.status_code == 200, initial.text
    initial_row = await _row(db_connection, workspace_id)
    initial_secret_id = str(initial_row.vault_secret_id)
    assert initial_row.provider == "openai"
    assert initial_row.key_last4 == "abcd"
    assert await _decrypted_secret(db_connection, initial_secret_id) == OPENAI_KEY

    await asyncio.sleep(0.01)
    rotated = await _put(api_client, owner, workspace_id, "openai", OPENAI_ROTATED_KEY)
    assert rotated.status_code == 200, rotated.text
    rotated_row = await _row(db_connection, workspace_id)
    assert rotated_row.provider == "openai"
    assert rotated_row.key_last4 == "wxyz"
    assert str(rotated_row.vault_secret_id) == initial_secret_id
    assert rotated_row.updated_at >= initial_row.updated_at
    assert await _settings_count(db_connection, workspace_id) == 1
    assert await _decrypted_secret(db_connection, initial_secret_id) == OPENAI_ROTATED_KEY
    assert await _decrypted_secret(db_connection, initial_secret_id) != OPENAI_KEY

    switched = await _put(api_client, owner, workspace_id, "gemini", GEMINI_KEY)
    assert switched.status_code == 200, switched.text
    switched_row = await _row(db_connection, workspace_id)
    assert switched_row.provider == "gemini"
    assert switched_row.key_last4 == "lmno"
    assert str(switched_row.vault_secret_id) == initial_secret_id
    assert await _settings_count(db_connection, workspace_id) == 1
    assert await _decrypted_secret(db_connection, initial_secret_id) == GEMINI_KEY
    assert await _decrypted_secret(db_connection, initial_secret_id) != OPENAI_ROTATED_KEY

    invalid = await _put(api_client, owner, workspace_id, "openai", "bad-key")
    assert invalid.status_code == 422, invalid.text
    assert invalid.json()["error"]["code"] == "invalid_key_format"
    unchanged_row = await _row(db_connection, workspace_id)
    assert unchanged_row.provider == "gemini"
    assert unchanged_row.key_last4 == "lmno"
    assert str(unchanged_row.vault_secret_id) == initial_secret_id
    assert await _decrypted_secret(db_connection, initial_secret_id) == GEMINI_KEY
