import pytest

from conftest import (
    add_member,
    create_category,
    create_expense,
    create_team_workspace,
    list_categories,
    list_expenses,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


DEFAULT_CATEGORY_NAMES = [
    "Restaurants",
    "Groceries",
    "Fuel",
    "Transportation",
    "Rent",
    "Utilities",
    "Internet & Mobile",
    "Health",
    "Education",
    "Family",
    "Shopping",
    "Entertainment",
    "Travel",
    "Subscriptions",
    "Other",
]


async def test_default_categories_create_permissions_and_duplicate_names(
    api_client, signup_user
) -> None:
    owner = await signup_user("category-owner")
    admin = await signup_user("category-admin")
    member = await signup_user("category-member")
    viewer = await signup_user("category-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    categories = await list_categories(api_client, owner, workspace_id)
    assert [category["name"] for category in categories] == DEFAULT_CATEGORY_NAMES
    assert [category["sort_order"] for category in categories] == list(range(15))
    assert {category["is_archived"] for category in categories} == {False}
    assert [category["name"] for category in await list_categories(api_client, viewer, workspace_id)] == DEFAULT_CATEGORY_NAMES

    owner_create = await create_category(api_client, owner, workspace_id, {"name": "Pets"})
    admin_create = await create_category(api_client, admin, workspace_id, {"name": "Car Care"})
    assert owner_create.status_code == 201, owner_create.text
    assert admin_create.status_code == 201, admin_create.text
    assert owner_create.json()["sort_order"] == 15
    assert admin_create.json()["sort_order"] == 16
    assert owner_create.json()["is_archived"] is False

    assert (await create_category(api_client, member, workspace_id, {"name": "Member Cat"})).status_code == 403
    assert (await create_category(api_client, viewer, workspace_id, {"name": "Viewer Cat"})).status_code == 403

    duplicate = await create_category(api_client, owner, workspace_id, {"name": "pets"})
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "duplicate_category_name"

    blank = await create_category(api_client, owner, workspace_id, {"name": "   "})
    assert blank.status_code == 422


async def test_rename_archive_reuse_name_and_keep_expense_association(
    api_client, signup_user
) -> None:
    owner = await signup_user("category-archive-owner")
    member = await signup_user("category-archive-member")
    viewer = await signup_user("category-archive-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    pets_response = await create_category(api_client, owner, workspace_id, {"name": "Pets"})
    assert pets_response.status_code == 201, pets_response.text
    pets_id = pets_response.json()["id"]

    expense_response = await create_expense(
        api_client,
        member,
        workspace_id,
        {"category_id": pets_id, "amount_minor": 2500},
    )
    assert expense_response.status_code == 201, expense_response.text

    member_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{pets_id}",
        headers=member.auth_header,
        json={"name": "Pet Care"},
    )
    viewer_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{pets_id}",
        headers=viewer.auth_header,
        json={"is_archived": True},
    )
    assert member_patch.status_code == 403
    assert viewer_patch.status_code == 403

    rename = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{pets_id}",
        headers=owner.auth_header,
        json={"name": "Pet Care"},
    )
    assert rename.status_code == 200, rename.text
    assert rename.json()["name"] == "Pet Care"

    duplicate_rename = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{pets_id}",
        headers=owner.auth_header,
        json={"name": "restaurants"},
    )
    assert duplicate_rename.status_code == 409
    assert duplicate_rename.json()["error"]["code"] == "duplicate_category_name"

    archive = await api_client.patch(
        f"/workspaces/{workspace_id}/categories/{pets_id}",
        headers=owner.auth_header,
        json={"is_archived": True},
    )
    assert archive.status_code == 200, archive.text
    assert archive.json()["is_archived"] is True

    active_only = await api_client.get(
        f"/workspaces/{workspace_id}/categories?include_archived=false",
        headers=owner.auth_header,
    )
    assert active_only.status_code == 200, active_only.text
    assert pets_id not in {category["id"] for category in active_only.json()["categories"]}

    reuse = await create_category(api_client, owner, workspace_id, {"name": "Pet Care"})
    assert reuse.status_code == 201, reuse.text

    expenses = await list_expenses(api_client, owner, workspace_id)
    assert expenses[0]["category_id"] == pets_id


async def test_reorder_requires_full_matching_category_set(api_client, signup_user) -> None:
    owner = await signup_user("category-order-owner")
    member = await signup_user("category-order-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    categories = await list_categories(api_client, owner, workspace_id)
    category_ids = [category["id"] for category in categories]
    reordered_ids = list(reversed(category_ids))

    member_reorder = await api_client.put(
        f"/workspaces/{workspace_id}/categories/order",
        headers=member.auth_header,
        json={"category_ids": reordered_ids},
    )
    assert member_reorder.status_code == 403

    missing_id = await api_client.put(
        f"/workspaces/{workspace_id}/categories/order",
        headers=owner.auth_header,
        json={"category_ids": reordered_ids[:-1]},
    )
    duplicate_id = await api_client.put(
        f"/workspaces/{workspace_id}/categories/order",
        headers=owner.auth_header,
        json={"category_ids": reordered_ids[:-1] + [reordered_ids[0]]},
    )
    assert missing_id.status_code == 422
    assert missing_id.json()["error"]["code"] == "invalid_order"
    assert duplicate_id.status_code == 422
    assert duplicate_id.json()["error"]["code"] == "invalid_order"

    reorder = await api_client.put(
        f"/workspaces/{workspace_id}/categories/order",
        headers=owner.auth_header,
        json={"category_ids": reordered_ids},
    )
    assert reorder.status_code == 200, reorder.text
    reordered = reorder.json()["categories"]
    assert [category["id"] for category in reordered] == reordered_ids
    assert [category["sort_order"] for category in reordered] == list(range(len(reordered_ids)))
