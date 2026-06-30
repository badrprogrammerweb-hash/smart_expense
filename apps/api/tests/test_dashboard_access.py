from uuid import uuid4

import pytest

from conftest import (
    add_member,
    create_expense,
    create_income,
    create_team_workspace,
    period_date as _period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_dashboard_all_workspace_roles_can_read(api_client, signup_user) -> None:
    owner = await signup_user()
    admin = await signup_user()
    member = await signup_user()
    viewer = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    for user in (owner, admin, member, viewer):
        response = await api_client.get(
            f"/workspaces/{workspace_id}/dashboard",
            headers=user.auth_header,
        )
        assert response.status_code == 200, response.text


async def test_dashboard_requires_authentication(api_client) -> None:
    response = await api_client.get(f"/workspaces/{uuid4()}/dashboard")

    assert response.status_code == 401


async def test_dashboard_returns_not_found_for_non_member(api_client, signup_user) -> None:
    owner = await signup_user()
    outsider = await signup_user()
    workspace = await create_team_workspace(api_client, owner)

    response = await api_client.get(
        f"/workspaces/{workspace['id']}/dashboard",
        headers=outsider.auth_header,
    )

    assert response.status_code == 404


async def test_dashboard_summary_is_scoped_to_requested_workspace(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    other_owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    other_workspace = await create_team_workspace(api_client, other_owner)

    income_response = await create_income(
        api_client,
        owner,
        workspace["id"],
        {"amount_minor": 50000, "occurred_on": _period_date(1)},
    )
    expense_response = await create_expense(
        api_client,
        owner,
        workspace["id"],
        {"amount_minor": 7000, "occurred_on": _period_date(2)},
    )
    other_income_response = await create_income(
        api_client,
        other_owner,
        other_workspace["id"],
        {"amount_minor": 900000, "occurred_on": _period_date(3)},
    )
    other_expense_response = await create_expense(
        api_client,
        other_owner,
        other_workspace["id"],
        {"amount_minor": 800000, "occurred_on": _period_date(4)},
    )
    assert income_response.status_code == 201, income_response.text
    assert expense_response.status_code == 201, expense_response.text
    assert other_income_response.status_code == 201, other_income_response.text
    assert other_expense_response.status_code == 201, other_expense_response.text

    response = await api_client.get(
        f"/workspaces/{workspace['id']}/dashboard",
        headers=owner.auth_header,
    )

    assert response.status_code == 200, response.text
    summary = response.json()["summary"]
    assert summary["total_income_minor"] == 50000
    assert summary["total_expenses_minor"] == 7000
    assert summary["remaining_balance_minor"] == 43000
