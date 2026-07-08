import pytest

from conftest import (
    create_expense,
    create_income,
    create_team_workspace,
    default_category_id,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def _report(api_client, user, workspace_id: str, start: str, end: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/reports?period=custom&start={start}&end={end}",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_spending_summary_returns_totals_top_category_and_up_direction(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    groceries_id = await default_category_id(db_connection, workspace_id, "Groceries")
    rent_id = await default_category_id(db_connection, workspace_id, "Rent")

    responses = [
        await create_income(
            api_client,
            owner,
            workspace_id,
            {"amount_minor": 100000, "occurred_on": "2026-03-10"},
        ),
        await create_expense(
            api_client,
            owner,
            workspace_id,
            {
                "amount_minor": 30000,
                "occurred_on": "2026-03-11",
                "category_id": groceries_id,
            },
        ),
        await create_expense(
            api_client,
            owner,
            workspace_id,
            {"amount_minor": 10000, "occurred_on": "2026-03-12", "category_id": rent_id},
        ),
        await create_expense(
            api_client,
            owner,
            workspace_id,
            {
                "amount_minor": 25000,
                "occurred_on": "2026-03-01",
                "category_id": groceries_id,
            },
        ),
    ]
    for response in responses:
        assert response.status_code == 201, response.text

    summary = (await _report(api_client, owner, workspace_id, "2026-03-10", "2026-03-20"))[
        "spending_summary"
    ]

    assert summary == {
        "total_income_minor": 100000,
        "total_expenses_minor": 40000,
        "remaining_balance_minor": 60000,
        "top_category": {
            "category_id": groceries_id,
            "category_name": "Groceries",
            "total_minor": 30000,
            "currency": "SAR",
        },
        "trend_direction": "up",
        "currency": "SAR",
    }


async def test_spending_summary_reports_down_flat_and_empty_cases(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    previous = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 50000, "occurred_on": "2026-04-04"},
    )
    current = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 10000, "occurred_on": "2026-04-15"},
    )
    flat_previous = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 20000, "occurred_on": "2026-05-04"},
    )
    flat_current = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 20000, "occurred_on": "2026-05-15"},
    )
    for response in (previous, current, flat_previous, flat_current):
        assert response.status_code == 201, response.text

    down = (await _report(api_client, owner, workspace_id, "2026-04-10", "2026-04-20"))[
        "spending_summary"
    ]
    flat = (await _report(api_client, owner, workspace_id, "2026-05-10", "2026-05-20"))[
        "spending_summary"
    ]
    empty = (await _report(api_client, owner, workspace_id, "2026-06-10", "2026-06-20"))[
        "spending_summary"
    ]

    assert down["trend_direction"] == "down"
    assert flat["trend_direction"] == "flat"
    assert empty == {
        "total_income_minor": 0,
        "total_expenses_minor": 0,
        "remaining_balance_minor": 0,
        "top_category": None,
        "trend_direction": "flat",
        "currency": "SAR",
    }
