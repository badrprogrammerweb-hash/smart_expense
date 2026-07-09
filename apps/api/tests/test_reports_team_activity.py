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


async def _insert_ready_extraction(db_connection, workspace_id: str, user_id: str, filename: str) -> None:
    file_result = await db_connection.execute(
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
    file_id = file_result.scalar_one()
    await db_connection.execute(
        text(
            """
            insert into public.ai_extractions (
                workspace_id, file_id, provider, status, amount_minor,
                extracted_currency, occurred_on, vendor_name, triggered_by
            )
            values (
                :workspace_id, :file_id, 'openai', 'ready_for_review', 5500,
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


async def _report(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/reports",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _dashboard(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_reports_include_team_activity_and_dashboard_pending_count(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("reports-team-owner")
    admin = await signup_user("reports-team-admin")
    member = await signup_user("reports-team-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    current_start, _ = get_current_period()
    responses = [
        await create_income(
            api_client,
            owner,
            workspace_id,
            {"amount_minor": 100000, "occurred_on": current_start.isoformat()},
        ),
        await create_income(
            api_client,
            owner,
            workspace_id,
            {"amount_minor": 25000, "occurred_on": (current_start - timedelta(days=1)).isoformat()},
        ),
        await create_income(
            api_client,
            admin,
            workspace_id,
            {"amount_minor": 50000, "occurred_on": period_date(2)},
        ),
        await create_expense(
            api_client,
            member,
            workspace_id,
            {"amount_minor": 12000, "occurred_on": period_date(3)},
        ),
        await create_expense(
            api_client,
            member,
            workspace_id,
            {"amount_minor": 8000, "occurred_on": period_date(4)},
        ),
    ]
    for response in responses:
        assert response.status_code == 201, response.text

    deleted = await create_expense(
        api_client,
        member,
        workspace_id,
        {"amount_minor": 9000, "occurred_on": period_date(5)},
    )
    assert deleted.status_code == 201, deleted.text
    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{deleted.json()['id']}",
        headers=member.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text

    await _insert_ready_extraction(db_connection, workspace_id, owner.user_id, "pending-one.pdf")
    await _insert_ready_extraction(db_connection, workspace_id, owner.user_id, "pending-two.pdf")
    await db_connection.commit()

    report = await _report(api_client, owner, workspace_id)
    dashboard = await _dashboard(api_client, owner, workspace_id)

    activity_by_user = {item["user_id"]: item for item in report["team_activity"]}
    assert activity_by_user[owner.user_id]["records_created"] == 2
    assert activity_by_user[admin.user_id]["records_created"] == 1
    assert activity_by_user[member.user_id]["records_created"] == 2
    assert report["pending_review_count"] == dashboard["pending_ai_count"] == 2

    single_workspace = await create_team_workspace(api_client, owner, "Single Member")
    single_response = await create_expense(
        api_client,
        owner,
        single_workspace["id"],
        {"amount_minor": 7000, "occurred_on": period_date(6)},
    )
    assert single_response.status_code == 201, single_response.text
    single_report = await _report(api_client, owner, single_workspace["id"])
    assert single_report["team_activity"] == [
        {
            "user_id": owner.user_id,
            "display_name": owner.email,
            "records_created": 1,
        }
    ]
