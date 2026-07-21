import pytest
from sqlalchemy import text

from app.schemas.extractions import FailureReason
from app.services import ai_providers
from conftest import (
    add_member,
    create_expense,
    create_team_workspace,
    default_category_id,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nvalid-pdf"


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


async def _upload_file(api_client, user, workspace_id: str) -> dict:
    response = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=user.auth_header,
        files={"file": ("receipt.pdf", PDF_BYTES, "application/octet-stream")},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _trigger(api_client, user, workspace_id: str, file_id: str):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files/{file_id}/extractions",
        headers=user.auth_header,
    )


async def _extraction_count(db_connection, file_id: str) -> int:
    result = await db_connection.execute(
        text("select count(*) from public.ai_extractions where file_id = :file_id"),
        {"file_id": file_id},
    )
    return int(result.scalar_one())


def _stub_get_object(monkeypatch, content: bytes = PDF_BYTES) -> None:
    async def get_object(key: str) -> bytes:
        return content

    monkeypatch.setattr("app.services.storage.get_object", get_object)


def _stub_extract_receipt(monkeypatch, outcome) -> list:
    calls: list = []

    async def extract_receipt(provider, api_key, file_bytes, content_type, category_names=None):
        calls.append((provider, api_key, file_bytes, content_type))
        return outcome

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)
    return calls


async def test_trigger_happy_path_returns_ready_for_review_with_draft(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-trigger-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)
    groceries_id = await default_category_id(db_connection, workspace_id, "Groceries")

    _stub_get_object(monkeypatch)
    outcome = ai_providers.ExtractedFields(
        amount_minor=4250,
        currency="SAR",
        occurred_on="2026-07-01",
        vendor_name="Panda Hypermarket",
        suggested_category="Groceries",
    )
    calls = _stub_extract_receipt(monkeypatch, outcome)

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "ready_for_review"
    assert payload["draft"] == {
        "amount_minor": 4250,
        "extracted_currency": "SAR",
        "occurred_on": "2026-07-01",
        "vendor_name": "Panda Hypermarket",
        "suggested_category": "Groceries",
        "suggested_category_id": groceries_id,
    }
    assert payload["failure_reason"] is None
    assert payload["expense_id"] is None
    assert payload["can_edit"] is True
    assert payload["can_discard"] is True
    assert len(calls) == 1
    assert calls[0][1] == OPENAI_KEY

    assert await _extraction_count(db_connection, file["id"]) == 1


async def test_trigger_with_provider_failure_returns_failed_status(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-trigger-failed-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)

    _stub_get_object(monkeypatch)
    _stub_extract_receipt(
        monkeypatch, ai_providers.ExtractionFailure(failure_reason=FailureReason.INVALID_KEY)
    )

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["failure_reason"] == "invalid_key"
    assert payload["draft"] is None

    assert await _extraction_count(db_connection, file["id"]) == 1


async def test_trigger_without_byok_returns_409_and_creates_no_row(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-trigger-no-byok-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    file = await _upload_file(api_client, owner, workspace_id)

    calls = _stub_extract_receipt(monkeypatch, ai_providers.ExtractedFields())

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "ai_not_configured"
    assert calls == []
    assert await _extraction_count(db_connection, file["id"]) == 0


async def test_trigger_blocked_by_existing_active_extraction(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-trigger-dup-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)

    _stub_get_object(monkeypatch)
    _stub_extract_receipt(monkeypatch, ai_providers.ExtractedFields(amount_minor=100))

    first = await _trigger(api_client, owner, workspace_id, file["id"])
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "ready_for_review"

    second = await _trigger(api_client, owner, workspace_id, file["id"])
    assert second.status_code == 409, second.text
    assert second.json()["error"]["code"] == "extraction_in_progress"
    assert await _extraction_count(db_connection, file["id"]) == 1


async def test_trigger_blocked_when_file_already_linked_to_expense(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-trigger-linked-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)

    expense_response = await create_expense(api_client, owner, workspace_id)
    assert expense_response.status_code == 201, expense_response.text
    expense_id = expense_response.json()["id"]

    link_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file['id']}/link",
        headers=owner.auth_header,
        json={"expense_id": expense_id},
    )
    assert link_response.status_code == 200, link_response.text

    calls = _stub_extract_receipt(monkeypatch, ai_providers.ExtractedFields())

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "extraction_in_progress"
    assert calls == []
    assert await _extraction_count(db_connection, file["id"]) == 0


async def test_trigger_rejects_viewer_role(api_client, signup_user, monkeypatch) -> None:
    owner = await signup_user("extract-trigger-viewer-owner")
    viewer = await signup_user("extract-trigger-viewer-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)

    calls = _stub_extract_receipt(monkeypatch, ai_providers.ExtractedFields())

    response = await _trigger(api_client, viewer, workspace_id, file["id"])
    assert response.status_code == 403, response.text
    assert response.json()["error"]["code"] == "forbidden"
    assert calls == []
