from datetime import date

from sqlalchemy import text

import pytest

from app.services.dashboard import get_current_period
from conftest import (
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


async def _report(api_client, user, workspace_id: str, query: str = "") -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/reports{query}",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _insert_ready_ai_draft(db_connection, workspace_id: str, user_id: str) -> None:
    result = await db_connection.execute(
        text(
            """
            insert into public.files (
                workspace_id, uploaded_by, original_filename, content_type,
                size_bytes, storage_path
            )
            values (
                :workspace_id, :user_id, 'draft-receipt.pdf', 'application/pdf',
                128, :storage_path
            )
            returning id
            """
        ),
        {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "storage_path": f"{workspace_id}/draft-receipt.pdf",
        },
    )
    file_id = result.scalar_one()

    await db_connection.execute(
        text(
            """
            insert into public.ai_extractions (
                workspace_id, file_id, provider, status, amount_minor,
                extracted_currency, occurred_on, vendor_name, triggered_by
            )
            values (
                :workspace_id, :file_id, 'gemini', 'ready_for_review', 999999,
                'SAR', :occurred_on, 'Draft Vendor', :user_id
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


async def test_report_summary_reconciles_with_dashboard_for_equivalent_current_period(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 500000, "occurred_on": period_date(1), "description": "Salary"},
    )
    expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 125000,
            "occurred_on": period_date(2),
            "description": "Rent",
            "merchant_name": "Landlord",
        },
    )
    deleted_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 88000,
            "occurred_on": period_date(4),
            "description": "Deleted",
            "merchant_name": "Deleted Merchant",
        },
    )
    for response in (income, expense, deleted_expense):
        assert response.status_code == 201, response.text

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{deleted_expense.json()['id']}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text
    await _insert_ready_ai_draft(db_connection, workspace_id, owner.user_id)

    dashboard = await _dashboard(api_client, owner, workspace_id)
    current_report = await _report(api_client, owner, workspace_id)
    period_start, period_end = get_current_period()
    custom_report = await _report(
        api_client,
        owner,
        workspace_id,
        f"?period=custom&start={period_start.isoformat()}&end={period_end.isoformat()}",
    )

    assert current_report["summary"] == dashboard["summary"]
    assert custom_report["summary"] == dashboard["summary"]
    assert current_report["category_breakdown"] == dashboard["category_breakdown"]
    assert custom_report["category_breakdown"] == dashboard["category_breakdown"]
    assert {record["id"] for record in current_report["recent_records"]} == {
        record["id"] for record in dashboard["recent_records"]
    }
