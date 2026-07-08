from uuid import uuid4

import pytest

from conftest import (
    add_member,
    create_expense,
    create_income,
    create_team_workspace,
    period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_reports_are_readable_by_workspace_roles_but_not_outsiders(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    viewer = await signup_user()
    outsider = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 10000, "occurred_on": period_date(1)},
    )
    expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 4000, "occurred_on": period_date(2)},
    )
    assert income.status_code == 201, income.text
    assert expense.status_code == 201, expense.text

    viewer_response = await api_client.get(
        f"/workspaces/{workspace_id}/reports",
        headers=viewer.auth_header,
    )
    outsider_response = await api_client.get(
        f"/workspaces/{workspace_id}/reports",
        headers=outsider.auth_header,
    )
    unauthenticated_response = await api_client.get(f"/workspaces/{workspace_id}/reports")
    missing_response = await api_client.get(
        f"/workspaces/{uuid4()}/reports",
        headers=owner.auth_header,
    )

    assert viewer_response.status_code == 200, viewer_response.text
    assert viewer_response.json()["summary"]["total_income_minor"] == 10000
    assert outsider_response.status_code == 404
    assert unauthenticated_response.status_code == 401
    assert missing_response.status_code == 404
