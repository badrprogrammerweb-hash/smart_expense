import pytest

from conftest import (
    create_category,
    create_expense,
    create_income,
    create_team_workspace,
    period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nmanual-first"


async def _configure(api_client, owner, workspace_id: str):
    return await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )


async def _dashboard(api_client, owner, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard?recent_limit=5",
        headers=owner.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _run_manual_flow(api_client, owner, workspace_id: str) -> dict:
    category = await create_category(api_client, owner, workspace_id)
    income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 125000, "occurred_on": period_date(1), "description": "Salary"},
    )
    expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 25000,
            "occurred_on": period_date(2),
            "description": "Groceries",
            "category_id": category.json()["id"],
        },
    )
    upload = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=owner.auth_header,
        files={"file": ("receipt.pdf", PDF_BYTES, "application/pdf")},
    )
    assert category.status_code == 201, category.text
    assert income.status_code == 201, income.text
    assert expense.status_code == 201, expense.text
    assert upload.status_code == 201, upload.text

    dashboard = await _dashboard(api_client, owner, workspace_id)
    assert dashboard["summary"] == {
        "total_income_minor": 125000,
        "total_expenses_minor": 25000,
        "remaining_balance_minor": 100000,
        "currency": "SAR",
    }
    assert dashboard["pending_ai_count"] == 0
    return dashboard


async def test_manual_workflows_and_totals_are_identical_without_and_with_byok(
    api_client, signup_user, monkeypatch
) -> None:
    owner = await signup_user("ai-manual-owner")
    without_key = await create_team_workspace(api_client, owner, "Manual Without Key")
    with_key = await create_team_workspace(api_client, owner, "Manual With Key")
    stored_objects: list[tuple[str, bytes, str]] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        stored_objects.append((key, content, content_type))

    monkeypatch.setattr("app.services.storage.put_object", put_object)

    no_key_dashboard = await _run_manual_flow(api_client, owner, without_key["id"])

    configure = await _configure(api_client, owner, with_key["id"])
    assert configure.status_code == 200, configure.text
    configured_dashboard = await _run_manual_flow(api_client, owner, with_key["id"])

    assert configured_dashboard["summary"] == no_key_dashboard["summary"]
    assert configured_dashboard["pending_ai_count"] == no_key_dashboard["pending_ai_count"] == 0
    assert len(stored_objects) == 2

    before_byok = await _dashboard(api_client, owner, without_key["id"])
    configure_existing = await _configure(api_client, owner, without_key["id"])
    assert configure_existing.status_code == 200, configure_existing.text
    after_byok = await _dashboard(api_client, owner, without_key["id"])
    assert after_byok["summary"] == before_byok["summary"]
    assert after_byok["pending_ai_count"] == before_byok["pending_ai_count"] == 0
