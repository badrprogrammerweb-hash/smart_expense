import pytest
from sqlalchemy import text

from conftest import (
    create_expense,
    create_team_workspace,
    default_category_id,
    list_expenses,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_create_expense_with_main_and_subcategory(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("expense-hier-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    transportation_id = await default_category_id(db_connection, workspace_id, "Transportation")
    vehicle_maintenance_id = await default_category_id(
        db_connection, workspace_id, "Vehicle Maintenance"
    )

    main_only = await create_expense(
        api_client, owner, workspace_id, {"category_id": transportation_id}
    )
    assert main_only.status_code == 201, main_only.text
    assert main_only.json()["category_id"] == transportation_id

    with_sub = await create_expense(
        api_client, owner, workspace_id, {"category_id": vehicle_maintenance_id}
    )
    assert with_sub.status_code == 201, with_sub.text
    assert with_sub.json()["category_id"] == vehicle_maintenance_id

    expenses = await list_expenses(api_client, owner, workspace_id)
    category_by_id = {expense["id"]: expense["category_id"] for expense in expenses}
    assert category_by_id[main_only.json()["id"]] == transportation_id
    assert category_by_id[with_sub.json()["id"]] == vehicle_maintenance_id


async def test_expense_category_rejects_income_type(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("expense-hier-owner2")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    salary_id = await default_category_id(db_connection, workspace_id, "Salary")

    response = await create_expense(api_client, owner, workspace_id, {"category_id": salary_id})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "category_type_mismatch"


async def test_expense_category_rejects_archived_parent(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("expense-hier-owner3")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    utilities_id = await default_category_id(db_connection, workspace_id, "Utilities")
    electricity_id = await default_category_id(db_connection, workspace_id, "Electricity")

    await db_connection.execute(
        text("update public.categories set is_archived = true where id = :category_id"),
        {"category_id": utilities_id},
    )
    await db_connection.commit()

    response = await create_expense(
        api_client, owner, workspace_id, {"category_id": electricity_id}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "category_archived"


async def test_update_expense_category_to_subcategory(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("expense-hier-owner4")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    restaurants_id = await default_category_id(db_connection, workspace_id, "Restaurants")
    dining_out_id = await default_category_id(db_connection, workspace_id, "Dining Out")

    created = await create_expense(
        api_client, owner, workspace_id, {"category_id": restaurants_id}
    )
    assert created.status_code == 201, created.text
    expense_id = created.json()["id"]

    update = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=owner.auth_header,
        json={"category_id": dining_out_id},
    )
    assert update.status_code == 200, update.text
    assert update.json()["category_id"] == dining_out_id
