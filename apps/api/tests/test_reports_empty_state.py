import pytest

from conftest import create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_reports_empty_period_returns_zero_totals_and_empty_lists(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)

    response = await api_client.get(
        f"/workspaces/{workspace['id']}/reports?period=custom&start=2026-04-01&end=2026-04-30",
        headers=owner.auth_header,
    )

    assert response.status_code == 200, response.text
    report = response.json()
    assert report["summary"] == {
        "total_income_minor": 0,
        "total_expenses_minor": 0,
        "remaining_balance_minor": 0,
        "currency": "SAR",
    }
    assert report["category_breakdown"] == []
    assert report["spending_trend"] == []
    assert report["top_merchants"] == []
    assert report["recent_records"] == []
    assert report["pending_review_count"] == 0
    assert report["spending_summary"] == {
        "total_income_minor": 0,
        "total_expenses_minor": 0,
        "remaining_balance_minor": 0,
        "top_category": None,
        "trend_direction": "flat",
        "currency": "SAR",
    }
