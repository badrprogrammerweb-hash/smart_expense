import pytest
from sqlalchemy import text

from app.services import ai_providers
from conftest import create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nnon-sar-confirm"


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
    async def extract_receipt(provider, api_key, file_bytes, content_type):
        return ai_providers.ExtractedFields(
            amount_minor=4250,
            currency="USD",
            occurred_on="2026-07-01",
            vendor_name="Panda Hypermarket",
            suggested_category="Groceries",
        )

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)


async def test_confirm_extraction_in_non_sar_workspace_uses_workspace_currency(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-confirm-currency-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    update_response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"currency": "USD"},
    )
    assert update_response.status_code == 200, update_response.text

    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)
    _stub_extraction(monkeypatch)

    file_response = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=owner.auth_header,
        files={"file": ("receipt.pdf", PDF_BYTES, "application/pdf")},
    )
    assert file_response.status_code == 201, file_response.text
    file = file_response.json()

    trigger_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file['id']}/extractions",
        headers=owner.auth_header,
    )
    assert trigger_response.status_code == 200, trigger_response.text
    extraction = trigger_response.json()
    assert extraction["status"] == "ready_for_review"

    confirm_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/confirm",
        headers=owner.auth_header,
        json={
            "amount_minor": 4250,
            "occurred_on": "2026-07-01",
            "category_id": None,
            "merchant_name": "Panda Hypermarket",
            "description": None,
        },
    )
    assert confirm_response.status_code == 200, confirm_response.text
    expense_id = confirm_response.json()["expense_id"]

    row = await db_connection.execute(
        text("select currency from public.expenses where id = :expense_id"),
        {"expense_id": expense_id},
    )
    assert row.scalar_one() == "USD"
