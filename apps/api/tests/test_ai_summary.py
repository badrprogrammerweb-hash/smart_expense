import json
from datetime import date, timedelta

import pytest
from sqlalchemy import text

from app.services.dashboard import get_current_period
from conftest import (
    add_member,
    create_expense,
    create_income,
    create_team_workspace,
    period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


async def _request_summary(api_client, user, workspace_id: str, locale: str = "en"):
    return await api_client.post(
        f"/workspaces/{workspace_id}/reports/ai-summary",
        headers=user.auth_header,
        json={"period": "current_month", "locale": locale},
    )


async def _insert_ready_extraction(db_connection, workspace_id: str, user_id: str) -> None:
    file_result = await db_connection.execute(
        text(
            """
            insert into public.files (
                workspace_id, uploaded_by, original_filename, content_type,
                size_bytes, storage_path
            )
            values (
                :workspace_id, :user_id, 'pending-ai.pdf', 'application/pdf',
                256, :storage_path
            )
            returning id
            """
        ),
        {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "storage_path": f"{workspace_id}/pending-ai.pdf",
        },
    )
    file_id = file_result.scalar_one()
    await db_connection.execute(
        text(
            """
            insert into public.ai_extractions (
                workspace_id, file_id, provider, status, amount_minor,
                extracted_currency, occurred_on, vendor_name, triggered_by
            )
            values (
                :workspace_id, :file_id, 'openai', 'ready_for_review', 9000,
                'SAR', :occurred_on, 'Pending Vendor', :user_id
            )
            """
        ),
        {
            "workspace_id": workspace_id,
            "file_id": str(file_id),
            "occurred_on": date.fromisoformat(period_date(3)),
            "user_id": user_id,
        },
    )


def _stub_summary_provider(monkeypatch) -> list[dict[str, object]]:
    calls: list[dict[str, object]] = []

    async def summarize_spending(provider, api_key, aggregates, locale):
        calls.append(
            {
                "provider": provider,
                "api_key": api_key,
                "aggregates": aggregates,
                "locale": locale,
            }
        )
        return f"AI summary in {locale}"

    monkeypatch.setattr(
        "app.services.ai_summary.ai_providers.summarize_spending",
        summarize_spending,
    )
    return calls


async def test_ai_summary_requires_byok_and_role_then_uses_confirmed_aggregates(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("ai-summary-owner")
    admin = await signup_user("ai-summary-admin")
    member = await signup_user("ai-summary-member")
    viewer = await signup_user("ai-summary-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    no_key = await _request_summary(api_client, owner, workspace_id)
    assert no_key.status_code == 409, no_key.text
    assert no_key.json()["error"]["code"] == "ai_not_configured"

    current_start, _ = get_current_period()
    previous_month_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 300000, "occurred_on": (current_start - timedelta(days=1)).isoformat()},
    )
    assert previous_month_income.status_code == 201, previous_month_income.text
    confirmed_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 120000, "occurred_on": period_date(1)},
    )
    confirmed_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 45000,
            "occurred_on": period_date(2),
            "merchant_name": "Confirmed Market",
            "description": "confirmed row",
        },
    )
    deleted_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 99000,
            "occurred_on": period_date(3),
            "merchant_name": "Deleted Shop",
            "description": "deleted row must not leak",
        },
    )
    for response in (confirmed_income, confirmed_expense, deleted_expense):
        assert response.status_code == 201, response.text
    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{deleted_expense.json()['id']}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text
    await _insert_ready_extraction(db_connection, workspace_id, owner.user_id)
    await db_connection.commit()

    await _configure_ai(api_client, owner, workspace_id)
    calls = _stub_summary_provider(monkeypatch)

    for user in (owner, admin, member):
        response = await _request_summary(api_client, user, workspace_id)
        assert response.status_code == 200, response.text
        assert response.json() == {"locale": "en", "text": "AI summary in en"}

    viewer_response = await _request_summary(api_client, viewer, workspace_id)
    assert viewer_response.status_code == 403, viewer_response.text
    assert viewer_response.json()["error"]["code"] == "not_authorized"

    arabic_response = await _request_summary(api_client, admin, workspace_id, locale="ar")
    assert arabic_response.status_code == 200, arabic_response.text
    assert arabic_response.json() == {"locale": "ar", "text": "AI summary in ar"}

    assert len(calls) == 4
    assert all(call["api_key"] == OPENAI_KEY for call in calls)
    assert calls[-1]["locale"] == "ar"
    aggregates = calls[0]["aggregates"]
    assert "recent_records" not in aggregates
    assert aggregates["summary"]["total_income_minor"] == 120000
    assert aggregates["summary"]["total_expenses_minor"] == 45000
    assert aggregates["summary"]["remaining_balance_minor"] == 75000
    assert aggregates["summary"]["currency"] == "SAR"
    serialized = json.dumps(aggregates, default=str)
    assert "Confirmed Market" in serialized
    assert "Deleted Shop" not in serialized
    assert "deleted row must not leak" not in serialized
    assert "Pending Vendor" not in serialized
