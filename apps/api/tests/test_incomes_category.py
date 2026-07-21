import pytest
from sqlalchemy import text

from conftest import (
    create_income,
    create_team_workspace,
    default_category_id,
    list_incomes,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_create_income_with_main_and_subcategory(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("income-category-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    salary_id = await default_category_id(db_connection, workspace_id, "Salary")
    bonus_id = await default_category_id(db_connection, workspace_id, "Bonus & Commission")

    main_only = await create_income(api_client, owner, workspace_id, {"category_id": salary_id})
    assert main_only.status_code == 201, main_only.text
    assert main_only.json()["category_id"] == salary_id

    with_sub = await create_income(api_client, owner, workspace_id, {"category_id": bonus_id})
    assert with_sub.status_code == 201, with_sub.text
    assert with_sub.json()["category_id"] == bonus_id

    incomes = await list_incomes(api_client, owner, workspace_id)
    category_by_id = {income["id"]: income["category_id"] for income in incomes}
    assert category_by_id[main_only.json()["id"]] == salary_id
    assert category_by_id[with_sub.json()["id"]] == bonus_id


async def test_income_category_rejects_wrong_workspace(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("income-category-owner2")
    other_owner = await signup_user("income-category-other")
    workspace = await create_team_workspace(api_client, owner, "Income Budget")
    other_workspace = await create_team_workspace(api_client, other_owner, "Other Income Budget")
    workspace_id = workspace["id"]
    other_workspace_id = other_workspace["id"]

    other_salary_id = await default_category_id(db_connection, other_workspace_id, "Salary")

    response = await create_income(
        api_client, owner, workspace_id, {"category_id": other_salary_id}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_category"


async def test_income_category_rejects_expense_type(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("income-category-owner3")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    restaurants_id = await default_category_id(db_connection, workspace_id, "Restaurants")

    response = await create_income(
        api_client, owner, workspace_id, {"category_id": restaurants_id}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "category_type_mismatch"


async def test_income_category_rejects_archived_category(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("income-category-owner4")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    gifts_id = await default_category_id(db_connection, workspace_id, "Gifts")
    await db_connection.execute(
        text("update public.categories set is_archived = true where id = :category_id"),
        {"category_id": gifts_id},
    )
    await db_connection.commit()

    response = await create_income(api_client, owner, workspace_id, {"category_id": gifts_id})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "category_archived"


async def test_income_category_rejects_archived_parent(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("income-category-owner5")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    salary_id = await default_category_id(db_connection, workspace_id, "Salary")
    bonus_id = await default_category_id(db_connection, workspace_id, "Bonus & Commission")

    await db_connection.execute(
        text("update public.categories set is_archived = true where id = :category_id"),
        {"category_id": salary_id},
    )
    await db_connection.commit()

    response = await create_income(api_client, owner, workspace_id, {"category_id": bonus_id})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "category_archived"


async def test_update_income_category(api_client, signup_user, db_connection) -> None:
    owner = await signup_user("income-category-owner6")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    salary_id = await default_category_id(db_connection, workspace_id, "Salary")
    business_id = await default_category_id(db_connection, workspace_id, "Business Income")

    created = await create_income(api_client, owner, workspace_id, {"category_id": salary_id})
    assert created.status_code == 201, created.text
    income_id = created.json()["id"]

    update = await api_client.patch(
        f"/workspaces/{workspace_id}/incomes/{income_id}",
        headers=owner.auth_header,
        json={"category_id": business_id},
    )
    assert update.status_code == 200, update.text
    assert update.json()["category_id"] == business_id
