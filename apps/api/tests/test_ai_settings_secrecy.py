import logging

import pytest
from sqlalchemy import text

from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"


def _assert_key_not_exposed(raw_key: str, body: str) -> None:
    assert raw_key not in body
    assert raw_key[:-4] not in body
    assert raw_key[:8] not in body


async def test_raw_key_never_appears_in_responses_logs_or_app_table(
    api_client, signup_user, db_connection, caplog
) -> None:
    caplog.set_level(logging.WARNING)
    owner = await signup_user("ai-secret-owner")
    admin = await signup_user("ai-secret-admin")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201

    put_response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert put_response.status_code == 200, put_response.text
    assert put_response.json()["masked_hint"].endswith("abcd")
    _assert_key_not_exposed(OPENAI_KEY, put_response.text)

    get_response = await api_client.get(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
    )
    assert get_response.status_code == 200, get_response.text
    _assert_key_not_exposed(OPENAI_KEY, get_response.text)

    forced_error = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=admin.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert forced_error.status_code == 403, forced_error.text
    _assert_key_not_exposed(OPENAI_KEY, forced_error.text)

    captured_logs = "\n".join(record.getMessage() for record in caplog.records)
    assert OPENAI_KEY not in captured_logs
    assert OPENAI_KEY[:-4] not in captured_logs

    row = (
        await db_connection.execute(
            text(
                """
                select key_last4, vault_secret_id
                from public.workspace_ai_settings
                where workspace_id = :workspace_id
                """
            ),
            {"workspace_id": workspace_id},
        )
    ).one()
    assert row.key_last4 == "abcd"

    columns = {
        record.column_name
        for record in await db_connection.execute(
            text(
                """
                select column_name
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'workspace_ai_settings'
                """
            )
        )
    }
    assert "api_key" not in columns
    assert "key" not in columns
    assert "key_last4" in columns

    decrypted = (
        await db_connection.execute(
            text(
                """
                select decrypted_secret
                from vault.decrypted_secrets
                where id = :secret_id
                """
            ),
            {"secret_id": str(row.vault_secret_id)},
        )
    ).scalar_one()
    assert decrypted == OPENAI_KEY
