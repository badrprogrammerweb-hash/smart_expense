import pytest

from conftest import (
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


async def test_income_category_breakdown_groups_by_resolved_main_category(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    salary_id = await default_category_id(db_connection, workspace_id, "Salary")
    bonus_id = await default_category_id(db_connection, workspace_id, "Bonus & Commission")
    gifts_id = await default_category_id(db_connection, workspace_id, "Gifts")

    responses = [
        await create_income(
            api_client, owner, workspace_id,
            {"amount_minor": 500000, "occurred_on": "2026-03-11", "category_id": salary_id},
        ),
        await create_income(
            api_client, owner, workspace_id,
            {"amount_minor": 20000, "occurred_on": "2026-03-12", "category_id": bonus_id},
        ),
        await create_income(
            api_client, owner, workspace_id,
            {"amount_minor": 10000, "occurred_on": "2026-03-13", "category_id": gifts_id},
        ),
        await create_income(
            api_client, owner, workspace_id,
            {"amount_minor": 5000, "occurred_on": "2026-03-14", "category_id": None},
        ),
    ]
    for response in responses:
        assert response.status_code == 201, response.text

    report = await _report(api_client, owner, workspace_id, "2026-03-10", "2026-03-20")
    breakdown = report["income_category_breakdown"]

    by_id = {item["category_id"]: item for item in breakdown}
    assert by_id[salary_id]["total_minor"] == 520000
    assert by_id[salary_id]["category_name"] == "Salary"
    assert by_id[gifts_id]["total_minor"] == 10000
    assert by_id[None]["total_minor"] == 5000
    assert bonus_id not in by_id

    # The expense-focused category_breakdown is unaffected by income data.
    assert "category_breakdown" in report
