import pytest

from app.services.dashboard import get_current_period
from conftest import (
    create_expense,
    create_income,
    create_team_workspace,
    period_date as _period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def _dashboard(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_dashboard_summary_totals_and_remaining_balance(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 250000, "occurred_on": _period_date(1)},
    )
    expense_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 12500, "occurred_on": _period_date(2)},
    )
    assert income_response.status_code == 201, income_response.text
    assert expense_response.status_code == 201, expense_response.text

    data = await _dashboard(api_client, owner, workspace_id)
    period_start, period_end = get_current_period()

    assert data["workspace_id"] == workspace_id
    assert data["period"] == {
        "start": period_start.isoformat(),
        "end": period_end.isoformat(),
    }
    assert data["summary"] == {
        "total_income_minor": 250000,
        "total_expenses_minor": 12500,
        "remaining_balance_minor": 237500,
        "currency": "SAR",
    }
    assert data["pending_ai_count"] == 0


async def test_dashboard_summary_updates_after_expense_create_and_delete(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 100000, "occurred_on": _period_date(3)},
    )
    assert income_response.status_code == 201, income_response.text

    initial_summary = (await _dashboard(api_client, owner, workspace_id))["summary"]
    assert initial_summary["total_income_minor"] == 100000
    assert initial_summary["total_expenses_minor"] == 0
    assert initial_summary["remaining_balance_minor"] == 100000

    expense_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 25000, "occurred_on": _period_date(4)},
    )
    assert expense_response.status_code == 201, expense_response.text

    updated_summary = (await _dashboard(api_client, owner, workspace_id))["summary"]
    assert updated_summary["total_income_minor"] == 100000
    assert updated_summary["total_expenses_minor"] == 25000
    assert updated_summary["remaining_balance_minor"] == 75000

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{expense_response.json()['id']}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text

    after_delete_summary = (await _dashboard(api_client, owner, workspace_id))["summary"]
    assert after_delete_summary["total_income_minor"] == 100000
    assert after_delete_summary["total_expenses_minor"] == 0
    assert after_delete_summary["remaining_balance_minor"] == 100000


async def test_dashboard_summary_returns_signed_negative_balance(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 10000, "occurred_on": _period_date(5)},
    )
    expense_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 15000, "occurred_on": _period_date(6)},
    )
    assert income_response.status_code == 201, income_response.text
    assert expense_response.status_code == 201, expense_response.text

    summary = (await _dashboard(api_client, owner, workspace_id))["summary"]
    assert summary["total_income_minor"] == 10000
    assert summary["total_expenses_minor"] == 15000
    assert summary["remaining_balance_minor"] == -5000


async def test_dashboard_summary_returns_zero_totals_for_empty_workspace(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)

    summary = (await _dashboard(api_client, owner, workspace["id"]))["summary"]
    assert summary["total_income_minor"] == 0
    assert summary["total_expenses_minor"] == 0
    assert summary["remaining_balance_minor"] == 0


async def test_dashboard_summary_excludes_deleted_expenses(api_client, signup_user) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 20000, "occurred_on": _period_date(7)},
    )
    deleted_expense_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 5000, "occurred_on": _period_date(8)},
    )
    confirmed_expense_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 3000, "occurred_on": _period_date(9)},
    )
    assert income_response.status_code == 201, income_response.text
    assert deleted_expense_response.status_code == 201, deleted_expense_response.text
    assert confirmed_expense_response.status_code == 201, confirmed_expense_response.text

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{deleted_expense_response.json()['id']}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text

    summary = (await _dashboard(api_client, owner, workspace_id))["summary"]
    assert summary["total_income_minor"] == 20000
    assert summary["total_expenses_minor"] == 3000
    assert summary["remaining_balance_minor"] == 17000


async def test_dashboard_summary_excludes_deleted_incomes(api_client, signup_user) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    deleted_income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 50000, "occurred_on": _period_date(10)},
    )
    confirmed_income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 30000, "occurred_on": _period_date(11)},
    )
    assert deleted_income_response.status_code == 201, deleted_income_response.text
    assert confirmed_income_response.status_code == 201, confirmed_income_response.text

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/incomes/{deleted_income_response.json()['id']}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text

    summary = (await _dashboard(api_client, owner, workspace_id))["summary"]
    assert summary["total_income_minor"] == 30000
    assert summary["total_expenses_minor"] == 0
    assert summary["remaining_balance_minor"] == 30000
