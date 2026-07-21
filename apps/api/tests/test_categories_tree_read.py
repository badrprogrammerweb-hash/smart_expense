import pytest
from sqlalchemy import text

from conftest import (
    create_team_workspace,
    default_category_id,
    list_categories,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_get_categories_requires_category_type(api_client, signup_user) -> None:
    owner = await signup_user("tree-read-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    response = await api_client.get(
        f"/workspaces/{workspace_id}/categories",
        headers=owner.auth_header,
    )
    assert response.status_code == 422


async def test_get_categories_returns_nested_tree_per_type(
    api_client, signup_user
) -> None:
    owner = await signup_user("tree-read-owner2")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    expense_tree = await list_categories(api_client, owner, workspace_id, category_type="expense")
    assert len(expense_tree) == 15
    restaurants = next(item for item in expense_tree if item["name"] == "Restaurants")
    assert {sub["name"] for sub in restaurants["subcategories"]} == {
        "Dining Out",
        "Cafes & Coffee",
        "Delivery",
    }
    fuel = next(item for item in expense_tree if item["name"] == "Fuel")
    assert fuel["subcategories"] == []

    income_tree = await list_categories(api_client, owner, workspace_id, category_type="income")
    assert len(income_tree) == 5
    salary = next(item for item in income_tree if item["name"] == "Salary")
    assert {sub["name"] for sub in salary["subcategories"]} == {
        "Primary Job",
        "Bonus & Commission",
    }


async def test_include_archived_false_excludes_archived_items_and_children_of_archived_parent(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("tree-read-owner3")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    groceries_id = await default_category_id(db_connection, workspace_id, "Groceries")
    utilities_id = await default_category_id(db_connection, workspace_id, "Utilities")

    # Archive one subcategory directly, and one main category (hiding its
    # still-individually-active subcategories too — research.md Decision 5).
    await db_connection.execute(
        text(
            "update public.categories set is_archived = true "
            "where workspace_id = :workspace_id and name = 'Bulk & Wholesale'"
        ),
        {"workspace_id": workspace_id},
    )
    await db_connection.execute(
        text("update public.categories set is_archived = true where id = :category_id"),
        {"category_id": utilities_id},
    )
    await db_connection.commit()

    active_tree = await list_categories(
        api_client, owner, workspace_id, category_type="expense", include_archived=False
    )
    names = {item["name"] for item in active_tree}
    assert "Utilities" not in names

    groceries = next(item for item in active_tree if item["id"] == groceries_id)
    subcategory_names = {sub["name"] for sub in groceries["subcategories"]}
    assert "Bulk & Wholesale" not in subcategory_names
    assert "Supermarket" in subcategory_names

    full_tree = await list_categories(
        api_client, owner, workspace_id, category_type="expense", include_archived=True
    )
    full_names = {item["name"] for item in full_tree}
    assert "Utilities" in full_names
    utilities = next(item for item in full_tree if item["id"] == utilities_id)
    assert {sub["name"] for sub in utilities["subcategories"]} == {"Electricity", "Water", "Gas"}
