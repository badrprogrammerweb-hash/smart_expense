from datetime import date

import pytest
from sqlalchemy import text

from app.services import ai_providers
from conftest import add_member, create_expense, create_team_workspace, requires_supabase, set_role


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nhistory"


async def _history_rows(db_connection, workspace_id: str, **filters):
    clauses = ["workspace_id = :workspace_id"]
    params = {"workspace_id": workspace_id}
    for key, value in filters.items():
        clauses.append(f"{key} = :{key}")
        params[key] = value

    result = await db_connection.execute(
        text(
            f"""
            select event_type, actor_user_id, entity_table, entity_id, summary, created_at
            from public.activity_history
            where {" and ".join(clauses)}
            order by created_at asc, id asc
            """
        ),
        params,
    )
    return list(result)


async def _single_history_event(db_connection, workspace_id: str, event_type: str, **filters):
    rows = await _history_rows(db_connection, workspace_id, event_type=event_type, **filters)
    assert len(rows) == 1, [row.event_type for row in rows]
    return rows[0]


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


def _stub_storage(monkeypatch) -> None:
    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def get_object(key: str) -> bytes:
        return PDF_BYTES

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.get_object", get_object)


def _stub_extraction(monkeypatch) -> None:
    async def extract_receipt(provider, api_key, file_bytes, content_type, category_names=None):
        return ai_providers.ExtractedFields(
            amount_minor=12345,
            currency="SAR",
            occurred_on="2026-07-04",
            vendor_name="History Market",
            suggested_category="Groceries",
        )

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)


async def _upload_file(api_client, user, workspace_id: str, filename: str = "history.pdf") -> dict:
    response = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=user.auth_header,
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_activity_history_triggers_record_tracked_events_once_with_actor(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("history-trigger-owner")
    member = await signup_user("history-trigger-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    expense_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 15000,
            "occurred_on": "2026-07-05",
            "merchant_name": "History Market",
        },
    )
    assert expense_response.status_code == 201, expense_response.text
    expense_id = expense_response.json()["id"]
    created = await _single_history_event(
        db_connection, workspace_id, "expense_created", entity_id=expense_id
    )
    assert str(created.actor_user_id) == owner.user_id
    assert created.entity_table == "expenses"
    assert created.summary["amount_minor"] == 15000

    update_response = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=owner.auth_header,
        json={"merchant_name": "Updated Market"},
    )
    assert update_response.status_code == 200, update_response.text
    await _single_history_event(db_connection, workspace_id, "expense_updated", entity_id=expense_id)

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text
    await _single_history_event(db_connection, workspace_id, "expense_deleted", entity_id=expense_id)

    noop_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 9000, "occurred_on": "2026-07-06"},
    )
    assert noop_response.status_code == 201, noop_response.text
    noop_id = noop_response.json()["id"]
    before_noop = await _history_rows(db_connection, workspace_id, entity_id=noop_id)
    await db_connection.execute(
        text("update public.expenses set updated_at = now() where id = :expense_id"),
        {"expense_id": noop_id},
    )
    after_noop = await _history_rows(db_connection, workspace_id, entity_id=noop_id)
    assert [row.event_type for row in after_noop] == [row.event_type for row in before_noop]

    _stub_storage(monkeypatch)
    file = await _upload_file(api_client, owner, workspace_id)
    await _single_history_event(db_connection, workspace_id, "file_uploaded", entity_id=file["id"])

    await _configure_ai(api_client, owner, workspace_id)
    _stub_extraction(monkeypatch)
    extraction_file = await _upload_file(api_client, owner, workspace_id, "ai-history.pdf")
    trigger_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{extraction_file['id']}/extractions",
        headers=owner.auth_header,
    )
    assert trigger_response.status_code == 200, trigger_response.text
    extraction = trigger_response.json()
    await _single_history_event(
        db_connection, workspace_id, "extraction_started", entity_id=extraction["id"]
    )
    await _single_history_event(
        db_connection, workspace_id, "extraction_completed", entity_id=extraction["id"]
    )

    confirm_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/confirm",
        headers=owner.auth_header,
        json={"amount_minor": 12345, "occurred_on": "2026-07-04"},
    )
    assert confirm_response.status_code == 200, confirm_response.text
    await _single_history_event(
        db_connection, workspace_id, "ai_draft_confirmed", entity_id=extraction["id"]
    )

    role_response = await set_role(api_client, owner, workspace_id, member.user_id, "admin")
    assert role_response.status_code == 200, role_response.text
    role_event = await _single_history_event(db_connection, workspace_id, "role_changed")
    assert role_event.summary["old_role"] == "member"
    assert role_event.summary["new_role"] == "admin"

    settings_response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"auto_delete_after_extraction": True},
    )
    assert settings_response.status_code == 200, settings_response.text
    setting_event = await _single_history_event(
        db_connection,
        workspace_id,
        "setting_changed",
        entity_id=workspace_id,
        entity_table="workspaces",
    )
    assert setting_event.entity_table == "workspaces"
    assert setting_event.summary["setting"] == "auto_delete_after_extraction"
