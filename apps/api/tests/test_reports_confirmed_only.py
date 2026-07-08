from datetime import date

from sqlalchemy import text

import pytest

from conftest import (
    create_expense,
    create_income,
    create_team_workspace,
    default_category_id,
    period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def _report(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/reports",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _insert_ai_extraction(
    db_connection,
    workspace_id: str,
    user_id: str,
    status: str,
    amount_minor: int,
    filename: str,
) -> None:
    result = await db_connection.execute(
        text(
            """
            insert into public.files (
                workspace_id, uploaded_by, original_filename, content_type,
                size_bytes, storage_path
            )
            values (
                :workspace_id, :user_id, :filename, 'application/pdf',
                256, :storage_path
            )
            returning id
            """
        ),
        {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "filename": filename,
            "storage_path": f"{workspace_id}/{filename}",
        },
    )
    file_id = result.scalar_one()

    await db_connection.execute(
        text(
            """
            insert into public.ai_extractions (
                workspace_id, file_id, provider, status, amount_minor,
                extracted_currency, occurred_on, vendor_name, failure_reason,
                triggered_by, discarded_by, discarded_at
            )
            values (
                :workspace_id, :file_id, 'openai', :status, :amount_minor,
                'SAR', :occurred_on, :vendor_name, :failure_reason,
                :user_id,
                case when :status = 'discarded' then cast(:user_id as uuid) else null end,
                case when :status = 'discarded' then now() else null end
            )
            """
        ),
        {
            "workspace_id": workspace_id,
            "file_id": str(file_id),
            "status": status,
            "amount_minor": amount_minor,
            "occurred_on": date.fromisoformat(period_date(5)),
            "vendor_name": f"AI {status}",
            "failure_reason": "provider_error" if status == "failed" else None,
            "user_id": user_id,
        },
    )


async def test_report_figures_exclude_deleted_records_and_unconfirmed_ai_rows(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    groceries_id = await default_category_id(db_connection, workspace_id, "Groceries")

    income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 100000, "occurred_on": period_date(1)},
    )
    confirmed_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 12500,
            "occurred_on": period_date(2),
            "category_id": groceries_id,
            "merchant_name": "Market",
        },
    )
    deleted_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 50000,
            "occurred_on": period_date(3),
            "category_id": groceries_id,
            "merchant_name": "Deleted Market",
        },
    )
    for response in (income, confirmed_expense, deleted_expense):
        assert response.status_code == 201, response.text

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{deleted_expense.json()['id']}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text

    await _insert_ai_extraction(
        db_connection, workspace_id, owner.user_id, "processing", 80000, "processing.pdf"
    )
    await _insert_ai_extraction(
        db_connection, workspace_id, owner.user_id, "failed", 70000, "failed.pdf"
    )
    await _insert_ai_extraction(
        db_connection, workspace_id, owner.user_id, "discarded", 60000, "discarded.pdf"
    )

    report = await _report(api_client, owner, workspace_id)

    assert report["summary"]["total_income_minor"] == 100000
    assert report["summary"]["total_expenses_minor"] == 12500
    assert report["summary"]["remaining_balance_minor"] == 87500
    assert report["category_breakdown"] == [
        {
            "category_id": groceries_id,
            "category_name": "Groceries",
            "total_minor": 12500,
            "currency": "SAR",
        }
    ]
    assert report["top_merchants"] == [
        {"merchant_name": "Market", "total_minor": 12500, "count": 1, "currency": "SAR"}
    ]
    assert report["spending_trend"] == [
        {
            "bucket": period_date(1),
            "granularity": "day",
            "income_minor": 100000,
            "expense_minor": 0,
            "remaining_minor": 100000,
            "currency": "SAR",
        },
        {
            "bucket": period_date(2),
            "granularity": "day",
            "income_minor": 0,
            "expense_minor": 12500,
            "remaining_minor": -12500,
            "currency": "SAR",
        },
    ]
