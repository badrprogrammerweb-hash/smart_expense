from datetime import timedelta

import pytest

from app.services.dashboard import get_current_period
from conftest import (
    create_expense,
    create_income,
    create_team_workspace,
    default_category_id,
    period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


def _previous_month_date() -> str:
    period_start, _ = get_current_period()
    return (period_start - timedelta(days=1)).isoformat()


async def _dashboard(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard?recent_limit=50",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_dashboard_current_period_excludes_previous_month_records(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    rent_id = await default_category_id(db_connection, workspace_id, "Rent")

    current_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 700000, "occurred_on": period_date(1)},
    )
    previous_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 100000, "occurred_on": _previous_month_date()},
    )
    current_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 165000,
            "occurred_on": period_date(2),
            "category_id": rent_id,
        },
    )
    previous_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 50000,
            "occurred_on": _previous_month_date(),
            "category_id": rent_id,
        },
    )
    for response in (current_income, previous_income, current_expense, previous_expense):
        assert response.status_code == 201, response.text

    data = await _dashboard(api_client, owner, workspace_id)
    period_start, period_end = get_current_period()

    assert data["period"] == {
        "start": period_start.isoformat(),
        "end": period_end.isoformat(),
    }
    assert data["summary"]["total_income_minor"] == 700000
    assert data["summary"]["total_expenses_minor"] == 165000
    assert data["summary"]["remaining_balance_minor"] == 535000
    assert data["category_breakdown"] == [
        {
            "category_id": rent_id,
            "category_name": "Rent",
            "total_minor": 165000,
            "currency": "SAR",
        }
    ]

    recent_ids = {record["id"] for record in data["recent_records"]}
    assert current_income.json()["id"] in recent_ids
    assert current_expense.json()["id"] in recent_ids
    assert previous_income.json()["id"] not in recent_ids
    assert previous_expense.json()["id"] not in recent_ids


async def test_dashboard_current_period_empty_when_only_previous_month_records(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    previous_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 100000, "occurred_on": _previous_month_date()},
    )
    previous_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 45000, "occurred_on": _previous_month_date()},
    )
    assert previous_income.status_code == 201, previous_income.text
    assert previous_expense.status_code == 201, previous_expense.text

    data = await _dashboard(api_client, owner, workspace_id)

    assert data["summary"]["total_income_minor"] == 0
    assert data["summary"]["total_expenses_minor"] == 0
    assert data["summary"]["remaining_balance_minor"] == 0
    assert data["category_breakdown"] == []
    assert data["recent_records"] == []
