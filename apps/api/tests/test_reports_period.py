from datetime import date, timedelta

import pytest

from app.services.dashboard import get_current_period
from conftest import create_expense, create_income, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


def _previous_month_range() -> tuple[date, date]:
    current_start, _ = get_current_period()
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end.replace(day=1)
    return previous_start, previous_end


async def _report(api_client, user, workspace_id: str, query: str = "") -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/reports{query}",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_reports_support_current_previous_and_custom_periods(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    current_start, current_end = get_current_period()
    previous_start, previous_end = _previous_month_range()

    current_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 90000, "occurred_on": current_start.isoformat()},
    )
    previous_expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 22000, "occurred_on": previous_start.isoformat()},
    )
    custom_income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 33000, "occurred_on": "2026-01-15"},
    )
    for response in (current_income, previous_expense, custom_income):
        assert response.status_code == 201, response.text

    current_report = await _report(api_client, owner, workspace_id)
    previous_report = await _report(api_client, owner, workspace_id, "?period=previous_month")
    custom_report = await _report(
        api_client,
        owner,
        workspace_id,
        "?period=custom&start=2026-01-01&end=2026-01-31",
    )

    assert current_report["period"] == {
        "preset": "current_month",
        "start": current_start.isoformat(),
        "end": current_end.isoformat(),
    }
    assert current_report["summary"]["total_income_minor"] == 90000
    assert previous_report["period"] == {
        "preset": "previous_month",
        "start": previous_start.isoformat(),
        "end": previous_end.isoformat(),
    }
    assert previous_report["summary"]["total_expenses_minor"] == 22000
    assert custom_report["period"] == {
        "preset": "custom",
        "start": "2026-01-01",
        "end": "2026-01-31",
    }
    assert custom_report["summary"]["total_income_minor"] == 33000


async def test_report_trend_granularity_switches_at_31_days(api_client, signup_user) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 11000, "occurred_on": "2026-01-15"},
    )
    expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 4000, "occurred_on": "2026-02-15"},
    )
    assert income.status_code == 201, income.text
    assert expense.status_code == 201, expense.text

    short = await _report(
        api_client,
        owner,
        workspace_id,
        "?period=custom&start=2026-01-01&end=2026-01-31",
    )
    long = await _report(
        api_client,
        owner,
        workspace_id,
        "?period=custom&start=2026-01-01&end=2026-02-15",
    )

    assert {point["granularity"] for point in short["spending_trend"]} == {"day"}
    assert {point["granularity"] for point in long["spending_trend"]} == {"month"}
    assert [point["bucket"] for point in long["spending_trend"]] == ["2026-01-01", "2026-02-01"]


async def test_reports_reject_invalid_custom_periods(api_client, signup_user) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    invalid = await api_client.get(
        f"/workspaces/{workspace_id}/reports?period=custom&start=2026-02-01&end=2026-01-31",
        headers=owner.auth_header,
    )
    too_large = await api_client.get(
        f"/workspaces/{workspace_id}/reports?period=custom&start=2026-01-01&end=2027-01-02",
        headers=owner.auth_header,
    )

    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "invalid_period"
    assert too_large.status_code == 422
    assert too_large.json()["error"]["code"] == "range_too_large"
