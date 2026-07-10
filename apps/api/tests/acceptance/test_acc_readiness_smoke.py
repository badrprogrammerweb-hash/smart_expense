import pytest

from conftest import AI_STUB_KEY, create_income, period_date, requires_supabase


pytestmark = [pytest.mark.asyncio, pytest.mark.acceptance, requires_supabase]


PDF_BYTES = b"%PDF-1.7\nacceptance-readiness-smoke"


async def _dashboard(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard?recent_limit=50",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _report(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/reports?recent_limit=50",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": AI_STUB_KEY},
    )
    assert response.status_code == 200, response.text


def _stub_storage(monkeypatch) -> None:
    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def get_object(key: str) -> bytes:
        return PDF_BYTES

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.get_object", get_object)


async def test_confirmed_only_reconciliation_smoke_create_confirm_report_equals_dashboard(
    api_client,
    acceptance_world,
    monkeypatch,
) -> None:
    owner = acceptance_world.workspace_a.owner
    workspace_id = acceptance_world.workspace_a.id
    category_id = acceptance_world.workspace_a.category_ids["groceries"]
    baseline_summary = (await _dashboard(api_client, owner, workspace_id))["summary"]

    income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 11111,
            "occurred_on": period_date(18),
            "description": "Readiness smoke income",
        },
    )
    assert income_response.status_code == 201, income_response.text

    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)

    upload_response = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=owner.auth_header,
        files={"file": ("readiness-smoke.pdf", PDF_BYTES, "application/pdf")},
    )
    assert upload_response.status_code == 201, upload_response.text
    file_id = upload_response.json()["id"]

    extraction_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file_id}/extractions",
        headers=owner.auth_header,
    )
    assert extraction_response.status_code == 200, extraction_response.text
    extraction = extraction_response.json()
    assert extraction["status"] == "ready_for_review"
    assert extraction["draft"]["amount_minor"] == 4250

    confirm_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/confirm",
        headers=owner.auth_header,
        json={
            "amount_minor": extraction["draft"]["amount_minor"],
            "occurred_on": period_date(19),
            "category_id": category_id,
            "merchant_name": extraction["draft"]["vendor_name"],
            "description": "Readiness smoke confirmed receipt",
        },
    )
    assert confirm_response.status_code == 200, confirm_response.text
    confirmed = confirm_response.json()
    assert confirmed["status"] == "confirmed"
    assert confirmed["expense_id"] is not None

    dashboard = await _dashboard(api_client, owner, workspace_id)
    report = await _report(api_client, owner, workspace_id)

    assert report["summary"] == dashboard["summary"]
    expected_summary = {
        "total_income_minor": baseline_summary["total_income_minor"] + 11111,
        "total_expenses_minor": baseline_summary["total_expenses_minor"] + 4250,
        "remaining_balance_minor": baseline_summary["remaining_balance_minor"] + 11111 - 4250,
    }
    for key, value in expected_summary.items():
        assert dashboard["summary"][key] == value
    assert dashboard["summary"]["currency"] == "SAR"
