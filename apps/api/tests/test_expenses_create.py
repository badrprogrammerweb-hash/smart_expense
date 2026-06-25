import pytest
from sqlalchemy import text

from conftest import (
    add_member,
    create_expense,
    create_team_workspace,
    default_category_id,
    list_expenses,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_create_expense_role_validation_optional_fields_and_listing(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("expense-owner")
    admin = await signup_user("expense-admin")
    member = await signup_user("expense-member")
    viewer = await signup_user("expense-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    category_id = await default_category_id(db_connection, workspace_id, "Restaurants")

    owner_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {
            "amount_minor": 4500,
            "occurred_on": "2026-06-10",
            "category_id": category_id,
            "description": "Lunch with team",
            "merchant_name": "Al Baik",
        },
    )
    assert owner_response.status_code == 201, owner_response.text
    owner_expense = owner_response.json()
    assert owner_expense["amount_minor"] == 4500
    assert owner_expense["currency"] == "SAR"
    assert owner_expense["occurred_on"] == "2026-06-10"
    assert owner_expense["category_id"] == category_id
    assert owner_expense["description"] == "Lunch with team"
    assert owner_expense["merchant_name"] == "Al Baik"
    assert owner_expense["status"] == "confirmed"
    assert owner_expense["created_by"] == owner.user_id

    admin_response = await create_expense(api_client, admin, workspace_id)
    member_response = await create_expense(api_client, member, workspace_id)
    assert admin_response.status_code == 201, admin_response.text
    assert member_response.status_code == 201, member_response.text

    viewer_response = await create_expense(api_client, viewer, workspace_id)
    assert viewer_response.status_code == 403

    for user in (owner, admin, member, viewer):
        expenses = await list_expenses(api_client, user, workspace_id)
        expense_ids = {expense["id"] for expense in expenses}
        assert owner_expense["id"] in expense_ids
        assert admin_response.json()["id"] in expense_ids
        assert member_response.json()["id"] in expense_ids


async def test_create_expense_rejects_invalid_payloads(api_client, signup_user) -> None:
    owner = await signup_user("expense-invalid-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    invalid_payloads = [
        {"amount_minor": 0, "occurred_on": "2026-06-10"},
        {"amount_minor": -1, "occurred_on": "2026-06-10"},
        {"occurred_on": "2026-06-10"},
        {"amount_minor": 4500},
        {"amount_minor": 4500, "occurred_on": "not-a-date"},
    ]

    for payload in invalid_payloads:
        response = await api_client.post(
            f"/workspaces/{workspace_id}/expenses",
            headers=owner.auth_header,
            json=payload,
        )
        assert response.status_code == 422, response.text


async def test_create_expense_rejects_invalid_or_archived_category(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("expense-category-owner")
    other_owner = await signup_user("expense-category-other")
    workspace = await create_team_workspace(api_client, owner, "Family Budget")
    other_workspace = await create_team_workspace(api_client, other_owner, "Other Budget")
    workspace_id = workspace["id"]
    other_workspace_id = other_workspace["id"]

    other_category_id = await default_category_id(db_connection, other_workspace_id, "Restaurants")
    invalid_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"category_id": other_category_id},
    )
    assert invalid_response.status_code == 422
    assert invalid_response.json()["error"]["code"] == "invalid_category"

    archived_category_id = await default_category_id(db_connection, workspace_id, "Groceries")
    await db_connection.execute(
        text("update public.categories set is_archived = true where id = :category_id"),
        {"category_id": archived_category_id},
    )
    await db_connection.commit()
    archived_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"category_id": archived_category_id},
    )
    assert archived_response.status_code == 422
    assert archived_response.json()["error"]["code"] == "category_archived"
