import pytest

from conftest import (
    create_expense,
    create_income,
    create_team_workspace,
    default_category_id,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def _drilldown(
    api_client, user, workspace_id: str, main_category_id: str, start: str, end: str
):
    return await api_client.get(
        f"/workspaces/{workspace_id}/reports/category-breakdown/{main_category_id}/subcategories"
        f"?period=custom&start={start}&end={end}",
        headers=user.auth_header,
    )


async def test_drilldown_returns_subcategory_totals_and_no_subcategory_bucket(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    transportation_id = await default_category_id(db_connection, workspace_id, "Transportation")
    public_transit_id = await default_category_id(db_connection, workspace_id, "Public Transit")
    ride_hailing_id = await default_category_id(db_connection, workspace_id, "Ride-Hailing")

    responses = [
        await create_expense(
            api_client, owner, workspace_id,
            {"amount_minor": 4000, "occurred_on": "2026-03-11", "category_id": public_transit_id},
        ),
        await create_expense(
            api_client, owner, workspace_id,
            {"amount_minor": 6000, "occurred_on": "2026-03-12", "category_id": public_transit_id},
        ),
        await create_expense(
            api_client, owner, workspace_id,
            {"amount_minor": 3000, "occurred_on": "2026-03-13", "category_id": ride_hailing_id},
        ),
        await create_expense(
            api_client, owner, workspace_id,
            {"amount_minor": 8000, "occurred_on": "2026-03-14", "category_id": transportation_id},
        ),
    ]
    for response in responses:
        assert response.status_code == 201, response.text

    response = await _drilldown(
        api_client, owner, workspace_id, transportation_id, "2026-03-10", "2026-03-20"
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["main_category_id"] == transportation_id
    assert data["main_category_name"] == "Transportation"

    by_id = {item["subcategory_id"]: item for item in data["subcategory_breakdown"]}
    assert by_id[public_transit_id]["total_minor"] == 10000
    assert by_id[public_transit_id]["subcategory_name"] == "Public Transit"
    assert by_id[ride_hailing_id]["total_minor"] == 3000
    assert by_id[None]["total_minor"] == 8000
    assert by_id[None]["subcategory_name"] == "No subcategory"


async def test_drilldown_404_for_unknown_or_subcategory_main_id(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    unknown = await _drilldown(
        api_client, owner, workspace_id,
        "00000000-0000-0000-0000-000000000000", "2026-03-10", "2026-03-20",
    )
    assert unknown.status_code == 404

    dining_out_id = await default_category_id(db_connection, workspace_id, "Dining Out")
    not_main = await _drilldown(
        api_client, owner, workspace_id, dining_out_id, "2026-03-10", "2026-03-20"
    )
    assert not_main.status_code == 404


async def test_drilldown_works_for_income_main_category(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    salary_id = await default_category_id(db_connection, workspace_id, "Salary")
    bonus_id = await default_category_id(db_connection, workspace_id, "Bonus & Commission")

    responses = [
        await create_income(
            api_client, owner, workspace_id,
            {"amount_minor": 500000, "occurred_on": "2026-03-11", "category_id": salary_id},
        ),
        await create_income(
            api_client, owner, workspace_id,
            {"amount_minor": 20000, "occurred_on": "2026-03-12", "category_id": bonus_id},
        ),
    ]
    for response in responses:
        assert response.status_code == 201, response.text

    response = await _drilldown(
        api_client, owner, workspace_id, salary_id, "2026-03-10", "2026-03-20"
    )
    assert response.status_code == 200, response.text
    data = response.json()
    by_id = {item["subcategory_id"]: item for item in data["subcategory_breakdown"]}
    assert by_id[None]["total_minor"] == 500000
    assert by_id[bonus_id]["total_minor"] == 20000
