import pytest

from conftest import (
    create_expense,
    create_team_workspace,
    default_category_id,
    period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_dashboard_category_breakdown_totals_order_and_uncategorized(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    rent_id = await default_category_id(db_connection, workspace_id, "Rent")
    groceries_id = await default_category_id(db_connection, workspace_id, "Groceries")
    fuel_id = await default_category_id(db_connection, workspace_id, "Fuel")

    expense_payloads = [
        {"amount_minor": 120000, "occurred_on": period_date(4), "category_id": rent_id},
        {"amount_minor": 30000, "occurred_on": period_date(5), "category_id": rent_id},
        {"amount_minor": 45000, "occurred_on": period_date(6), "category_id": groceries_id},
        {"amount_minor": 25000, "occurred_on": period_date(7), "category_id": None},
        {"amount_minor": 9999, "occurred_on": period_date(8), "category_id": fuel_id},
    ]
    responses = [
        await create_expense(api_client, owner, workspace_id, payload)
        for payload in expense_payloads
    ]
    for response in responses:
        assert response.status_code == 201, response.text

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{responses[-1].json()['id']}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text

    dashboard_response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard",
        headers=owner.auth_header,
    )

    assert dashboard_response.status_code == 200, dashboard_response.text
    data = dashboard_response.json()
    breakdown = data["category_breakdown"]
    assert data["summary"]["total_expenses_minor"] == 220000
    assert sum(item["total_minor"] for item in breakdown) == 220000
    assert [item["total_minor"] for item in breakdown] == [150000, 45000, 25000]
    assert breakdown == [
        {
            "category_id": rent_id,
            "category_name": "Rent",
            "total_minor": 150000,
            "currency": "SAR",
        },
        {
            "category_id": groceries_id,
            "category_name": "Groceries",
            "total_minor": 45000,
            "currency": "SAR",
        },
        {
            "category_id": None,
            "category_name": "Uncategorized",
            "total_minor": 25000,
            "currency": "SAR",
        },
    ]
    assert fuel_id not in {item["category_id"] for item in breakdown}
