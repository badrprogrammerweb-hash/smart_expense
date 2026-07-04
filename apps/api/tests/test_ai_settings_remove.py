import pytest
from sqlalchemy import text

from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"


async def _put(api_client, caller, workspace_id: str):
    return await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=caller.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )


async def _delete(api_client, caller, workspace_id: str):
    return await api_client.delete(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=caller.auth_header,
    )


async def _row_count(db_connection, table: str, where_sql: str, params: dict) -> int:
    return int(
        (
            await db_connection.execute(
                text(f"select count(*)::int from {table} where {where_sql}"),
                params,
            )
        ).scalar_one()
    )


async def test_owner_remove_deletes_row_and_vault_secret_and_nonowners_are_denied(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("ai-remove-owner")
    admin = await signup_user("ai-remove-admin")
    member = await signup_user("ai-remove-member")
    viewer = await signup_user("ai-remove-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    configure = await _put(api_client, owner, workspace_id)
    assert configure.status_code == 200, configure.text
    secret_id = str(
        (
            await db_connection.execute(
                text(
                    """
                    select vault_secret_id
                    from public.workspace_ai_settings
                    where workspace_id = :workspace_id
                    """
                ),
                {"workspace_id": workspace_id},
            )
        ).scalar_one()
    )

    remove = await _delete(api_client, owner, workspace_id)
    assert remove.status_code == 200, remove.text
    assert remove.json() == {
        "configured": False,
        "provider": None,
        "masked_hint": None,
        "updated_at": None,
        "updated_by": None,
        "updated_by_name": None,
    }
    assert (
        await _row_count(
            db_connection,
            "public.workspace_ai_settings",
            "workspace_id = :workspace_id",
            {"workspace_id": workspace_id},
        )
        == 0
    )
    assert (
        await _row_count(
            db_connection,
            "vault.secrets",
            "id = :secret_id",
            {"secret_id": secret_id},
        )
        == 0
    )

    remove_again = await _delete(api_client, owner, workspace_id)
    assert remove_again.status_code == 200, remove_again.text
    assert remove_again.json()["configured"] is False

    configure_again = await _put(api_client, owner, workspace_id)
    assert configure_again.status_code == 200, configure_again.text
    for caller in (admin, member, viewer):
        response = await _delete(api_client, caller, workspace_id)

        assert response.status_code == 403, response.text
        assert response.json()["error"]["code"] == "forbidden"
