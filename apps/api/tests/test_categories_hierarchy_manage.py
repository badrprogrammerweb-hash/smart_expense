import pytest
from sqlalchemy import text

from conftest import (
    add_member,
    create_category,
    create_expense,
    create_team_workspace,
    default_category_id,
    list_categories,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


# --- T028: POST main category and subcategory ---


async def test_create_main_category_and_subcategory(api_client, signup_user, db_connection) -> None:
    owner = await signup_user("hier-create-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    main_response = await create_category(
        api_client, owner, workspace_id, {"name": "Pets", "category_type": "expense"}
    )
    assert main_response.status_code == 201, main_response.text
    main = main_response.json()
    assert main["parent_id"] is None
    assert main["is_system"] is False
    assert main["translation_key"] is None

    sub_response = await create_category(
        api_client, owner, workspace_id, {"name": "Grooming", "parent_id": main["id"]}
    )
    assert sub_response.status_code == 201, sub_response.text
    sub = sub_response.json()
    assert sub["parent_id"] == main["id"]

    tree = await list_categories(api_client, owner, workspace_id, category_type="expense")
    pets = next(item for item in tree if item["id"] == main["id"])
    assert [item["name"] for item in pets["subcategories"]] == ["Grooming"]


async def test_create_category_rejects_wrong_role(api_client, signup_user) -> None:
    owner = await signup_user("hier-create-owner2")
    member = await signup_user("hier-create-member")
    viewer = await signup_user("hier-create-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    for user in (member, viewer):
        response = await create_category(
            api_client, user, workspace_id, {"name": "Nope", "category_type": "expense"}
        )
        assert response.status_code == 403


async def test_create_category_rejects_empty_name(api_client, signup_user) -> None:
    owner = await signup_user("hier-create-owner3")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    response = await create_category(
        api_client, owner, workspace_id, {"name": "   ", "category_type": "expense"}
    )
    assert response.status_code == 422


async def test_create_subcategory_rejects_invalid_or_foreign_parent(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("hier-create-owner4")
    other_owner = await signup_user("hier-create-other")
    workspace = await create_team_workspace(api_client, owner, "Hier Create Budget")
    other_workspace = await create_team_workspace(api_client, other_owner, "Hier Create Other")
    workspace_id = workspace["id"]
    other_workspace_id = other_workspace["id"]

    missing_parent = await create_category(
        api_client, owner, workspace_id, {"name": "Orphan", "parent_id": "00000000-0000-0000-0000-000000000000"}
    )
    assert missing_parent.status_code == 422
    assert missing_parent.json()["error"]["code"] == "invalid_parent_category"

    other_restaurants_id = await default_category_id(db_connection, other_workspace_id, "Restaurants")
    foreign_parent = await create_category(
        api_client, owner, workspace_id, {"name": "Cross", "parent_id": other_restaurants_id}
    )
    assert foreign_parent.status_code == 422
    assert foreign_parent.json()["error"]["code"] == "invalid_parent_category"

    dining_out_id = await default_category_id(db_connection, workspace_id, "Dining Out")
    too_deep = await create_category(
        api_client, owner, workspace_id, {"name": "TooDeep", "parent_id": dining_out_id}
    )
    assert too_deep.status_code == 422
    assert too_deep.json()["error"]["code"] == "invalid_parent_category"


async def test_create_category_rejects_duplicate_active_sibling_name(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("hier-create-owner5")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    duplicate_main = await create_category(
        api_client, owner, workspace_id, {"name": "restaurants", "category_type": "expense"}
    )
    assert duplicate_main.status_code == 409
    assert duplicate_main.json()["error"]["code"] == "duplicate_category_name"

    restaurants_id = await default_category_id(db_connection, workspace_id, "Restaurants")
    duplicate_sub = await create_category(
        api_client, owner, workspace_id, {"name": "dining out", "parent_id": restaurants_id}
    )
    assert duplicate_sub.status_code == 409
    assert duplicate_sub.json()["error"]["code"] == "duplicate_category_name"

    # Same name is fine as a subcategory under a DIFFERENT parent, or as a
    # main category of the OTHER record type (different scope).
    groceries_id = await default_category_id(db_connection, workspace_id, "Groceries")
    allowed_elsewhere = await create_category(
        api_client, owner, workspace_id, {"name": "Dining Out", "parent_id": groceries_id}
    )
    assert allowed_elsewhere.status_code == 201, allowed_elsewhere.text
    allowed_income = await create_category(
        api_client, owner, workspace_id, {"name": "Restaurants", "category_type": "income"}
    )
    assert allowed_income.status_code == 201, allowed_income.text


# --- T029: PATCH rename and archive/unarchive; parent-disable cascade ---


async def test_rename_category_and_subcategory(api_client, signup_user, db_connection) -> None:
    owner = await signup_user("hier-patch-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    restaurants_id = await default_category_id(db_connection, workspace_id, "Restaurants")
    dining_out_id = await default_category_id(db_connection, workspace_id, "Dining Out")

    rename_main = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{restaurants_id}",
        headers=owner.auth_header,
        json={"name": "Dining"},
    )
    assert rename_main.status_code == 200, rename_main.text
    assert rename_main.json()["name"] == "Dining"
    # Renaming a system category supersedes its translated default label —
    # `translation_key` must clear so every surface displays the reviewer's
    # new name, not a stale translation, per FR-008 ("historical records
    # show the current name, not a frozen snapshot").
    assert rename_main.json()["translation_key"] is None

    rename_sub = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{dining_out_id}",
        headers=owner.auth_header,
        json={"name": "Eating Out"},
    )
    assert rename_sub.status_code == 200, rename_sub.text
    assert rename_sub.json()["name"] == "Eating Out"
    assert rename_sub.json()["translation_key"] is None


async def test_disable_main_category_hides_subcategories_and_reenable_restores(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("hier-patch-owner2")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    utilities_id = await default_category_id(db_connection, workspace_id, "Utilities")
    electricity_id = await default_category_id(db_connection, workspace_id, "Electricity")
    water_id = await default_category_id(db_connection, workspace_id, "Water")

    # Individually archive one of the two subcategories BEFORE archiving the
    # parent, so we can prove the parent-disable/re-enable cycle does not
    # touch each child's own stored is_archived flag.
    archive_water = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{water_id}",
        headers=owner.auth_header,
        json={"is_archived": True},
    )
    assert archive_water.status_code == 200, archive_water.text

    archive_parent = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{utilities_id}",
        headers=owner.auth_header,
        json={"is_archived": True},
    )
    assert archive_parent.status_code == 200, archive_parent.text

    active_tree = await list_categories(
        api_client, owner, workspace_id, category_type="expense", include_archived=False
    )
    assert utilities_id not in {item["id"] for item in active_tree}

    row = (
        await db_connection.execute(
            text("select is_archived from public.categories where id = :id"), {"id": electricity_id}
        )
    ).first()
    assert row.is_archived is False

    reenable_parent = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{utilities_id}",
        headers=owner.auth_header,
        json={"is_archived": False},
    )
    assert reenable_parent.status_code == 200, reenable_parent.text
    assert reenable_parent.json()["is_archived"] is False

    restored_tree = await list_categories(
        api_client, owner, workspace_id, category_type="expense", include_archived=False
    )
    utilities = next(item for item in restored_tree if item["id"] == utilities_id)
    restored_sub_names = {item["name"] for item in utilities["subcategories"]}
    assert "Electricity" in restored_sub_names
    assert "Water" not in restored_sub_names

    water_row = (
        await db_connection.execute(
            text("select is_archived from public.categories where id = :id"), {"id": water_id}
        )
    ).first()
    assert water_row.is_archived is True


# --- T030: PUT .../order ---


async def test_reorder_main_categories_and_subcategories(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("hier-order-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    income_tree = await list_categories(api_client, owner, workspace_id, category_type="income")
    income_main_ids = [item["id"] for item in income_tree]
    reordered_income_ids = list(reversed(income_main_ids))

    reorder_mains = await api_client.put(
        f"/workspaces/{workspace_id}/categories/order",
        headers=owner.auth_header,
        json={"category_type": "income", "category_ids": reordered_income_ids},
    )
    assert reorder_mains.status_code == 200, reorder_mains.text
    reordered_tree = reorder_mains.json()["categories"]
    assert [item["id"] for item in reordered_tree] == reordered_income_ids

    salary_id = await default_category_id(db_connection, workspace_id, "Salary")
    salary = next(item for item in income_tree if item["id"] == salary_id)
    sub_ids = [item["id"] for item in salary["subcategories"]]
    reordered_sub_ids = list(reversed(sub_ids))

    reorder_subs = await api_client.put(
        f"/workspaces/{workspace_id}/categories/order",
        headers=owner.auth_header,
        json={"parent_id": salary_id, "category_ids": reordered_sub_ids},
    )
    assert reorder_subs.status_code == 200, reorder_subs.text
    reordered_salary = next(item for item in reorder_subs.json()["categories"] if item["id"] == salary_id)
    assert [item["id"] for item in reordered_salary["subcategories"]] == reordered_sub_ids

    mismatched = await api_client.put(
        f"/workspaces/{workspace_id}/categories/order",
        headers=owner.auth_header,
        json={"parent_id": salary_id, "category_ids": [sub_ids[0]]},
    )
    assert mismatched.status_code == 422
    assert mismatched.json()["error"]["code"] == "invalid_order"


# --- T031: DELETE ---


async def test_delete_category_requires_no_references_or_children(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("hier-delete-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    main_response = await create_category(
        api_client, owner, workspace_id, {"name": "Temp Main", "category_type": "expense"}
    )
    main_id = main_response.json()["id"]
    sub_response = await create_category(
        api_client, owner, workspace_id, {"name": "Temp Sub", "parent_id": main_id}
    )
    sub_id = sub_response.json()["id"]

    blocked_by_child = await api_client.delete(
        f"/workspaces/{workspace_id}/categories/{main_id}",
        headers=owner.auth_header,
    )
    assert blocked_by_child.status_code == 409
    assert blocked_by_child.json()["error"]["code"] == "category_has_references"

    expense_response = await create_expense(
        api_client, owner, workspace_id, {"category_id": sub_id}
    )
    assert expense_response.status_code == 201, expense_response.text

    blocked_by_expense = await api_client.delete(
        f"/workspaces/{workspace_id}/categories/{sub_id}",
        headers=owner.auth_header,
    )
    assert blocked_by_expense.status_code == 409
    assert blocked_by_expense.json()["error"]["code"] == "category_has_references"

    unused_response = await create_category(
        api_client, owner, workspace_id, {"name": "Unused Sub", "parent_id": main_id}
    )
    unused_id = unused_response.json()["id"]

    delete_unused = await api_client.delete(
        f"/workspaces/{workspace_id}/categories/{unused_id}",
        headers=owner.auth_header,
    )
    assert delete_unused.status_code == 204, delete_unused.text

    history = (
        await db_connection.execute(
            text(
                "select event_type from public.activity_history "
                "where workspace_id = :workspace_id and entity_id = :entity_id"
            ),
            {"workspace_id": workspace_id, "entity_id": unused_id},
        )
    ).all()
    assert any(row.event_type == "category_deleted" for row in history)


async def test_delete_category_rejects_wrong_role(api_client, signup_user) -> None:
    owner = await signup_user("hier-delete-owner2")
    member = await signup_user("hier-delete-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    created = await create_category(
        api_client, owner, workspace_id, {"name": "Deletable", "category_type": "expense"}
    )
    category_id = created.json()["id"]

    response = await api_client.delete(
        f"/workspaces/{workspace_id}/categories/{category_id}",
        headers=member.auth_header,
    )
    assert response.status_code == 403


# --- T032: Viewer/Member read-only ---


async def test_viewer_and_member_can_read_but_not_mutate(api_client, signup_user) -> None:
    owner = await signup_user("hier-viewer-owner")
    member = await signup_user("hier-viewer-member")
    viewer = await signup_user("hier-viewer-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    for user in (member, viewer):
        read = await list_categories(api_client, user, workspace_id, category_type="expense")
        assert isinstance(read, list)

    created = await create_category(
        api_client, owner, workspace_id, {"name": "Guarded", "category_type": "expense"}
    )
    category_id = created.json()["id"]
    tree = await list_categories(api_client, owner, workspace_id, category_type="expense")
    category_ids = [item["id"] for item in tree]

    for user in (member, viewer):
        assert (
            await create_category(api_client, user, workspace_id, {"name": "Nope", "category_type": "expense"})
        ).status_code == 403
        assert (
            await api_client.patch(
                f"/workspaces/{workspace_id}/categories/{category_id}",
                headers=user.auth_header,
                json={"name": "Blocked"},
            )
        ).status_code == 403
        assert (
            await api_client.put(
                f"/workspaces/{workspace_id}/categories/order",
                headers=user.auth_header,
                json={"category_type": "expense", "category_ids": category_ids},
            )
        ).status_code == 403
        assert (
            await api_client.delete(
                f"/workspaces/{workspace_id}/categories/{category_id}",
                headers=user.auth_header,
            )
        ).status_code == 403
