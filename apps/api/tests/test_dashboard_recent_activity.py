import pytest

from conftest import (
    create_expense,
    create_income,
    create_team_workspace,
    period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def _dashboard(api_client, user, workspace_id: str, query: str = "") -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard{query}",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_dashboard_recent_activity_default_limit_order_and_confirmed_only(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    first_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 10000, "occurred_on": period_date(1), "description": "Oldest income"},
    )
    first_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 2000,
            "occurred_on": period_date(2),
            "description": "Older expense",
            "merchant_name": "Bakery",
        },
    )
    second_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 30000, "occurred_on": period_date(3), "description": "Income 2"},
    )
    second_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 4000,
            "occurred_on": period_date(4),
            "description": "Expense 2",
            "merchant_name": "Market",
        },
    )
    third_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 5000,
            "occurred_on": period_date(5),
            "description": "Expense 3",
            "merchant_name": "Fuel Station",
        },
    )
    newest_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 60000, "occurred_on": period_date(6), "description": "Newest income"},
    )
    deleted_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 7000,
            "occurred_on": period_date(7),
            "description": "Deleted expense",
        },
    )
    responses = [
        first_income,
        first_expense,
        second_income,
        second_expense,
        third_expense,
        newest_income,
        deleted_expense,
    ]
    for response in responses:
        assert response.status_code == 201, response.text

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{deleted_expense.json()['id']}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text

    records = (await _dashboard(api_client, owner, workspace_id))["recent_records"]

    assert len(records) == 5
    assert [record["occurred_on"] for record in records] == [
        period_date(6),
        period_date(5),
        period_date(4),
        period_date(3),
        period_date(2),
    ]
    assert [record["id"] for record in records] == [
        newest_income.json()["id"],
        third_expense.json()["id"],
        second_expense.json()["id"],
        second_income.json()["id"],
        first_expense.json()["id"],
    ]
    assert deleted_expense.json()["id"] not in {record["id"] for record in records}
    assert first_income.json()["id"] not in {record["id"] for record in records}
    assert records[0]["type"] == "income"
    assert records[1]["type"] == "expense"
    assert records[1]["merchant_name"] == "Fuel Station"


async def test_dashboard_recent_activity_respects_custom_limit(api_client, signup_user) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    oldest = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 10000, "occurred_on": period_date(1)},
    )
    middle = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 2000, "occurred_on": period_date(2)},
    )
    newest = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 30000, "occurred_on": period_date(3)},
    )
    for response in (oldest, middle, newest):
        assert response.status_code == 201, response.text

    records = (await _dashboard(api_client, owner, workspace_id, "?recent_limit=2"))[
        "recent_records"
    ]

    assert len(records) == 2
    assert [record["id"] for record in records] == [newest.json()["id"], middle.json()["id"]]


async def test_dashboard_recent_activity_empty_workspace(api_client, signup_user) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)

    records = (await _dashboard(api_client, owner, workspace["id"]))["recent_records"]

    assert records == []


async def test_dashboard_recent_activity_rejects_invalid_limits(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)

    for invalid_limit in (0, 51):
        response = await api_client.get(
            f"/workspaces/{workspace['id']}/dashboard?recent_limit={invalid_limit}",
            headers=owner.auth_header,
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "invalid_limit"
