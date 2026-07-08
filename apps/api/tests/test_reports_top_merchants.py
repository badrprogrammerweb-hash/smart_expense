import pytest

from conftest import create_expense, create_team_workspace, period_date, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_top_merchants_excludes_blank_merchants_without_affecting_expense_total(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    payloads = [
        {"amount_minor": 10000, "occurred_on": period_date(1), "merchant_name": "Market"},
        {"amount_minor": 7000, "occurred_on": period_date(2), "merchant_name": "Fuel"},
        {"amount_minor": 5000, "occurred_on": period_date(3), "merchant_name": "Market"},
        {"amount_minor": 4000, "occurred_on": period_date(4), "merchant_name": ""},
        {"amount_minor": 3000, "occurred_on": period_date(5), "merchant_name": "   "},
        {"amount_minor": 2000, "occurred_on": period_date(6), "merchant_name": None},
    ]
    responses = [
        await create_expense(api_client, owner, workspace_id, payload) for payload in payloads
    ]
    for response in responses:
        assert response.status_code == 201, response.text

    report_response = await api_client.get(
        f"/workspaces/{workspace_id}/reports",
        headers=owner.auth_header,
    )
    assert report_response.status_code == 200, report_response.text
    report = report_response.json()

    assert report["summary"]["total_expenses_minor"] == 31000
    assert report["top_merchants"] == [
        {"merchant_name": "Market", "total_minor": 15000, "count": 2, "currency": "SAR"},
        {"merchant_name": "Fuel", "total_minor": 7000, "count": 1, "currency": "SAR"},
    ]
