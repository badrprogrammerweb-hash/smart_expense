from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import text

from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def _insert_history_rows(db_connection, workspace_id: str, actor_user_id: str) -> list[str]:
    now = datetime.now(timezone.utc)
    event_ids = [str(uuid4()), str(uuid4()), str(uuid4())]
    rows = [
        (event_ids[0], "expense_created", now - timedelta(seconds=1), 1000),
        (event_ids[1], "income_created", now - timedelta(seconds=2), 2000),
        (event_ids[2], "setting_changed", now - timedelta(seconds=3), 3000),
    ]
    for event_id, event_type, created_at, amount in rows:
        await db_connection.execute(
            text(
                """
                insert into public.activity_history (
                    id, workspace_id, event_type, actor_user_id,
                    entity_table, entity_id, summary, created_at
                )
                values (
                    :id, :workspace_id, :event_type, :actor_user_id,
                    'expenses',
                    gen_random_uuid(),
                    jsonb_build_object('amount_minor', cast(:amount as bigint)),
                    :created_at
                )
                """
            ),
            {
                "id": event_id,
                "workspace_id": workspace_id,
                "event_type": event_type,
                "actor_user_id": actor_user_id,
                "amount": amount,
                "created_at": created_at,
            },
        )
    await db_connection.commit()
    return event_ids


async def test_history_access_pagination_and_isolation(api_client, signup_user, db_connection) -> None:
    owner = await signup_user("history-access-owner")
    admin = await signup_user("history-access-admin")
    member = await signup_user("history-access-member")
    viewer = await signup_user("history-access-viewer")
    outsider = await signup_user("history-access-outsider")
    other_owner = await signup_user("history-access-other-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    other_workspace = await create_team_workspace(api_client, other_owner)

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    await db_connection.execute(
        text("delete from public.activity_history where workspace_id = :workspace_id"),
        {"workspace_id": workspace_id},
    )
    event_ids = await _insert_history_rows(db_connection, workspace_id, owner.user_id)

    owner_page = await api_client.get(
        f"/workspaces/{workspace_id}/history?limit=2",
        headers=owner.auth_header,
    )
    assert owner_page.status_code == 200, owner_page.text
    owner_payload = owner_page.json()
    assert [item["id"] for item in owner_payload["items"]] == event_ids[:2]
    assert owner_payload["next_before"] is not None
    assert owner_payload["items"][0]["actor_display_name"] is not None

    next_page = await api_client.get(
        f"/workspaces/{workspace_id}/history?limit=2&before={owner_payload['next_before']}",
        headers=owner.auth_header,
    )
    assert next_page.status_code == 200, next_page.text
    assert [item["id"] for item in next_page.json()["items"]] == [event_ids[2]]
    assert next_page.json()["next_before"] is None

    admin_page = await api_client.get(
        f"/workspaces/{workspace_id}/history",
        headers=admin.auth_header,
    )
    assert admin_page.status_code == 200, admin_page.text

    for user in (member, viewer):
        response = await api_client.get(
            f"/workspaces/{workspace_id}/history",
            headers=user.auth_header,
        )
        assert response.status_code == 403, response.text
        assert response.json()["error"]["code"] == "not_authorized"

    outsider_response = await api_client.get(
        f"/workspaces/{workspace_id}/history",
        headers=outsider.auth_header,
    )
    assert outsider_response.status_code == 404

    cross_workspace = await api_client.get(
        f"/workspaces/{other_workspace['id']}/history",
        headers=owner.auth_header,
    )
    assert cross_workspace.status_code == 404

    unauthenticated = await api_client.get(f"/workspaces/{workspace_id}/history")
    assert unauthenticated.status_code == 401
