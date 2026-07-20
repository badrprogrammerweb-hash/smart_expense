from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import text

from conftest import (
    add_member,
    create_expense,
    create_income,
    create_team_workspace,
    period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


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


async def _history(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/history?limit=50",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _set_currency(api_client, owner, workspace_id: str, currency: str) -> None:
    response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"currency": currency},
    )
    assert response.status_code == 200, response.text


async def _insert_ai_rows(db_connection, workspace_id: str, user_id: str) -> None:
    for status_value, amount_minor in (
        ("processing", 64000),
        ("ready_for_review", 81000),
        ("failed", 99000),
    ):
        file_id = str(uuid4())
        await db_connection.execute(
            text(
                """
                insert into public.files (
                    id, workspace_id, uploaded_by, original_filename, content_type,
                    size_bytes, storage_path
                )
                values (
                    :file_id, :workspace_id, :user_id, :filename, 'application/pdf',
                    128, :storage_path
                )
                """
            ),
            {
                "file_id": file_id,
                "workspace_id": workspace_id,
                "user_id": user_id,
                "filename": f"{status_value}.pdf",
                "storage_path": f"{workspace_id}/{status_value}.pdf",
            },
        )
        await db_connection.execute(
            text(
                """
                insert into public.ai_extractions (
                    workspace_id, file_id, provider, status, amount_minor,
                    extracted_currency, occurred_on, vendor_name, triggered_by
                )
                values (
                    :workspace_id, :file_id, 'openai', :status, :amount_minor,
                    'SAR', :occurred_on, :vendor_name, :user_id
                )
                """
            ),
            {
                "workspace_id": workspace_id,
                "file_id": file_id,
                "status": status_value,
                "amount_minor": amount_minor,
                "occurred_on": date.fromisoformat(period_date(5)),
                "vendor_name": f"{status_value} vendor",
                "user_id": user_id,
            },
        )
    await db_connection.commit()


def _assert_summary(summary: dict, currency: str, income: int, expenses: int) -> None:
    assert summary["currency"] == currency
    assert summary["total_income_minor"] == income
    assert summary["total_expenses_minor"] == expenses
    assert summary["remaining_balance_minor"] == income - expenses
    assert all(isinstance(summary[key], int) for key in (
        "total_income_minor",
        "total_expenses_minor",
        "remaining_balance_minor",
    ))


async def test_dashboard_reports_and_history_use_non_sar_workspace_currency(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("reports-currency-owner")
    viewer = await signup_user("reports-currency-viewer")
    other_owner = await signup_user("reports-currency-other-owner")
    workspace = await create_team_workspace(api_client, owner, "KWD Reports")
    workspace_id = workspace["id"]
    other_workspace = await create_team_workspace(api_client, other_owner, "USD Reports")
    other_workspace_id = other_workspace["id"]

    await _set_currency(api_client, owner, workspace_id, "KWD")
    await _set_currency(api_client, other_owner, other_workspace_id, "USD")
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    empty_dashboard = await _dashboard(api_client, owner, workspace_id)
    empty_report = await _report(api_client, owner, workspace_id)
    _assert_summary(empty_dashboard["summary"], "KWD", 0, 0)
    _assert_summary(empty_report["summary"], "KWD", 0, 0)

    income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 100000, "occurred_on": period_date(1), "description": "Initial income"},
    )
    expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 150000,
            "occurred_on": period_date(2),
            "description": "Initial expense",
            "merchant_name": "KWD Market",
        },
    )
    deleted_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 30000,
            "occurred_on": period_date(3),
            "description": "Deleted expense",
            "merchant_name": "Deleted KWD",
        },
    )
    for response in (income, expense, deleted_expense):
        assert response.status_code == 201, response.text
        assert response.json()["currency"] == "KWD"

    income_id = income.json()["id"]
    expense_id = expense.json()["id"]
    deleted_expense_id = deleted_expense.json()["id"]
    patch_income = await api_client.patch(
        f"/workspaces/{workspace_id}/incomes/{income_id}",
        headers=owner.auth_header,
        json={"amount_minor": 120000},
    )
    assert patch_income.status_code == 200, patch_income.text
    patch_expense = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=owner.auth_header,
        json={"amount_minor": 160000},
    )
    assert patch_expense.status_code == 200, patch_expense.text
    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{deleted_expense_id}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text
    await _insert_ai_rows(db_connection, workspace_id, owner.user_id)

    other_income = await create_income(
        api_client,
        other_owner,
        other_workspace_id,
        {"amount_minor": 50000, "occurred_on": period_date(4), "description": "Other income"},
    )
    assert other_income.status_code == 201, other_income.text

    dashboard = await _dashboard(api_client, owner, workspace_id)
    report = await _report(api_client, owner, workspace_id)
    other_dashboard = await _dashboard(api_client, other_owner, other_workspace_id)

    _assert_summary(dashboard["summary"], "KWD", 120000, 160000)
    _assert_summary(report["summary"], "KWD", 120000, 160000)
    _assert_summary(report["spending_summary"], "KWD", 120000, 160000)
    _assert_summary(other_dashboard["summary"], "USD", 50000, 0)
    assert dashboard["summary"]["remaining_balance_minor"] == -40000

    assert {item["currency"] for item in dashboard["category_breakdown"]} == {"KWD"}
    assert {item["currency"] for item in report["category_breakdown"]} == {"KWD"}
    assert {point["currency"] for point in report["spending_trend"]} == {"KWD"}
    assert {merchant["currency"] for merchant in report["top_merchants"]} == {"KWD"}
    assert {record["currency"] for record in dashboard["recent_records"]} == {"KWD"}
    assert {record["currency"] for record in report["recent_records"]} == {"KWD"}
    assert report["spending_summary"]["top_category"]["currency"] == "KWD"

    for payload in (dashboard, report):
        assert payload["summary"]["total_expenses_minor"] == 160000
        assert payload["summary"]["total_expenses_minor"] != 160000 + 64000 + 81000 + 99000

    viewer_dashboard = await _dashboard(api_client, viewer, workspace_id)
    viewer_report = await _report(api_client, viewer, workspace_id)
    assert viewer_dashboard["summary"]["currency"] == "KWD"
    assert viewer_report["summary"]["currency"] == "KWD"
    viewer_create = await create_income(api_client, viewer, workspace_id)
    assert viewer_create.status_code == 403, viewer_create.text

    history = await _history(api_client, owner, workspace_id)
    amount_events = [
        item
        for item in history["items"]
        if isinstance(item["summary"].get("amount_minor"), int)
    ]
    assert amount_events
    assert {item["summary"]["currency"] for item in amount_events} == {"KWD"}
    assert any(
        item["event_type"] == "expense_deleted"
        and item["summary"]["amount_minor"] == 30000
        for item in amount_events
    )


async def test_history_keeps_inserted_event_currency(api_client, signup_user, db_connection) -> None:
    owner = await signup_user("reports-history-currency-owner")
    workspace = await create_team_workspace(api_client, owner, "Manual History Currency")
    workspace_id = workspace["id"]
    await _set_currency(api_client, owner, workspace_id, "BHD")

    await db_connection.execute(
        text(
            """
            insert into public.activity_history (
                workspace_id, event_type, actor_user_id, entity_table,
                entity_id, summary, created_at
            )
            values (
                :workspace_id, 'expense_created', :actor_user_id, 'expenses',
                gen_random_uuid(),
                jsonb_build_object('amount_minor', 1234, 'currency', 'BHD'),
                :created_at
            )
            """
        ),
        {
            "workspace_id": workspace_id,
            "actor_user_id": owner.user_id,
            "created_at": datetime.now(timezone.utc),
        },
    )
    await db_connection.commit()

    history = await _history(api_client, owner, workspace_id)
    inserted_events = [
        item
        for item in history["items"]
        if item["summary"].get("amount_minor") == 1234
    ]
    assert inserted_events
    assert inserted_events[0]["summary"]["currency"] == "BHD"
