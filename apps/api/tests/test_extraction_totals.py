from datetime import date

import pytest
from sqlalchemy import text

from conftest import create_income, create_team_workspace, period_date, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def _dashboard(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _insert_file_and_extraction(
    db_connection,
    workspace_id: str,
    user_id: str,
    status: str,
    suffix: str,
    *,
    amount_minor: int | None = 777700,
) -> str:
    file_id = (
        await db_connection.execute(
            text(
                """
                insert into public.files(
                    workspace_id, uploaded_by, original_filename, content_type,
                    size_bytes, storage_path
                )
                values (
                    :workspace_id, :uploaded_by, :filename, 'application/pdf',
                    32, :storage_path
                )
                returning id
                """
            ),
            {
                "workspace_id": workspace_id,
                "uploaded_by": user_id,
                "filename": f"{suffix}.pdf",
                "storage_path": f"{workspace_id}/{suffix}",
            },
        )
    ).scalar_one()
    extraction_id = (
        await db_connection.execute(
            text(
                """
                insert into public.ai_extractions(
                    workspace_id, file_id, provider, status, amount_minor,
                    extracted_currency, occurred_on, vendor_name, suggested_category,
                    failure_reason, triggered_by
                )
                values (
                    :workspace_id, :file_id, 'openai', :status, :amount_minor,
                    'SAR', :occurred_on, 'Draft Merchant', 'Draft Category',
                    :failure_reason, :triggered_by
                )
                returning id
                """
            ),
            {
                "workspace_id": workspace_id,
                "file_id": str(file_id),
                "status": status,
                "amount_minor": amount_minor if status != "failed" else None,
                "occurred_on": date.fromisoformat(period_date(2)) if status != "failed" else None,
                "failure_reason": "provider_error" if status == "failed" else None,
                "triggered_by": user_id,
            },
        )
    ).scalar_one()
    return str(extraction_id)


async def test_unconfirmed_extractions_do_not_affect_dashboard_or_report_figures(
    api_client, signup_user, db_connection
) -> None:
    # There is no separate backend "reports" endpoint/service: the frontend
    # reports page (`ReportSummary`) reads the same `GET .../dashboard`
    # response via `useDashboard`, and both dashboard totals and the category
    # breakdown are computed from the same `status = 'confirmed'`-filtered
    # queries in `services/dashboard.py`. Exercising `/dashboard` here is
    # therefore not just a proxy for reports coverage -- it is the same code
    # path reports uses, so this test's assertions cover both surfaces.
    owner = await signup_user("extract-totals-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 250000, "occurred_on": period_date(1)},
    )
    assert income.status_code == 201, income.text
    baseline = await _dashboard(api_client, owner, workspace_id)

    ready_id = await _insert_file_and_extraction(
        db_connection, workspace_id, owner.user_id, "ready_for_review", "ready"
    )
    await _insert_file_and_extraction(
        db_connection, workspace_id, owner.user_id, "processing", "processing"
    )
    await _insert_file_and_extraction(db_connection, workspace_id, owner.user_id, "failed", "failed")
    await _insert_file_and_extraction(
        db_connection, workspace_id, owner.user_id, "discarded", "discarded"
    )
    await db_connection.commit()

    with_drafts = await _dashboard(api_client, owner, workspace_id)
    assert with_drafts["summary"] == baseline["summary"]
    assert with_drafts["category_breakdown"] == baseline["category_breakdown"]
    assert with_drafts["recent_records"] == baseline["recent_records"]

    confirm = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{ready_id}/confirm",
        headers=owner.auth_header,
        json={"amount_minor": 12345, "occurred_on": period_date(3)},
    )
    assert confirm.status_code == 200, confirm.text

    after_confirm = await _dashboard(api_client, owner, workspace_id)
    assert after_confirm["summary"]["total_income_minor"] == baseline["summary"]["total_income_minor"]
    assert after_confirm["summary"]["total_expenses_minor"] == 12345
    assert (
        after_confirm["summary"]["remaining_balance_minor"]
        == baseline["summary"]["remaining_balance_minor"] - 12345
    )
    expense_records = [record for record in after_confirm["recent_records"] if record["type"] == "expense"]
    assert [record["amount_minor"] for record in expense_records] == [12345]
