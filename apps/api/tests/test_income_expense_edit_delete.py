import pytest
from sqlalchemy import text

from conftest import (
    add_member,
    create_expense,
    create_income,
    create_team_workspace,
    default_category_id,
    list_expenses,
    list_incomes,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


def _sum_confirmed(records: list[dict]) -> int:
    return sum(record["amount_minor"] for record in records if record["status"] == "confirmed")


async def test_edit_delete_updates_confirmed_sums_and_soft_deleted_rows(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("edit-delete-owner")
    member = await signup_user("edit-delete-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    category_id = await default_category_id(db_connection, workspace_id, "Restaurants")
    income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 10000, "occurred_on": "2026-06-01", "description": "Salary"},
    )
    expense_response = await create_expense(
        api_client,
        member,
        workspace_id,
        {
            "amount_minor": 12000,
            "occurred_on": "2026-06-10",
            "category_id": category_id,
            "description": "Dinner",
        },
    )
    assert income_response.status_code == 201, income_response.text
    assert expense_response.status_code == 201, expense_response.text
    income = income_response.json()
    expense = expense_response.json()

    income_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/incomes/{income['id']}",
        headers=owner.auth_header,
        json={
            "amount_minor": 15000,
            "occurred_on": "2026-06-02",
            "description": "Salary + bonus",
        },
    )
    assert income_patch.status_code == 200, income_patch.text
    updated_income = income_patch.json()
    assert updated_income["amount_minor"] == 15000
    assert updated_income["occurred_on"] == "2026-06-02"
    assert updated_income["description"] == "Salary + bonus"
    assert updated_income["updated_at"] >= income["updated_at"]

    expense_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{expense['id']}",
        headers=member.auth_header,
        json={
            "amount_minor": 20000,
            "occurred_on": "2026-06-11",
            "category_id": category_id,
            "description": "Groceries and dinner",
            "merchant_name": "Local Market",
        },
    )
    assert expense_patch.status_code == 200, expense_patch.text
    updated_expense = expense_patch.json()
    assert updated_expense["amount_minor"] == 20000
    assert updated_expense["occurred_on"] == "2026-06-11"
    assert updated_expense["category_id"] == category_id
    assert updated_expense["description"] == "Groceries and dinner"
    assert updated_expense["merchant_name"] == "Local Market"
    assert updated_expense["updated_at"] >= expense["updated_at"]

    income_sum = _sum_confirmed(await list_incomes(api_client, owner, workspace_id))
    expense_sum = _sum_confirmed(await list_expenses(api_client, owner, workspace_id))
    assert income_sum == 15000
    assert expense_sum == 20000
    assert income_sum - expense_sum == -5000

    first_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{expense['id']}",
        headers=member.auth_header,
        json={"amount_minor": 21000},
    )
    second_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{expense['id']}",
        headers=member.auth_header,
        json={"amount_minor": 22000},
    )
    assert first_patch.status_code == 200, first_patch.text
    assert second_patch.status_code == 200, second_patch.text
    assert second_patch.json()["amount_minor"] == 22000

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{expense['id']}",
        headers=member.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text
    expenses = await list_expenses(api_client, owner, workspace_id)
    assert expense["id"] not in {record["id"] for record in expenses}
    assert _sum_confirmed(expenses) == 0

    deleted_row = await db_connection.execute(
        text("select status from public.expenses where id = :expense_id"),
        {"expense_id": expense["id"]},
    )
    assert deleted_row.first().status == "deleted"

    assert (
        await api_client.patch(
            f"/workspaces/{workspace_id}/expenses/{expense['id']}",
            headers=member.auth_header,
            json={"amount_minor": 23000},
        )
    ).status_code == 404
    assert (
        await api_client.delete(
            f"/workspaces/{workspace_id}/expenses/{expense['id']}",
            headers=member.auth_header,
        )
    ).status_code == 404
    assert (
        await api_client.post(
            f"/workspaces/{workspace_id}/expenses/{expense['id']}/restore",
            headers=owner.auth_header,
        )
    ).status_code == 404

    income_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/incomes/{income['id']}",
        headers=owner.auth_header,
    )
    assert income_delete.status_code == 204, income_delete.text
    assert income["id"] not in {
        record["id"] for record in await list_incomes(api_client, owner, workspace_id)
    }
    assert (
        await api_client.patch(
            f"/workspaces/{workspace_id}/incomes/{income['id']}",
            headers=owner.auth_header,
            json={"amount_minor": 16000},
        )
    ).status_code == 404


async def test_income_and_expense_edit_delete_permissions(api_client, signup_user) -> None:
    owner = await signup_user("edit-permission-owner")
    admin = await signup_user("edit-permission-admin")
    member = await signup_user("edit-permission-member")
    other_member = await signup_user("edit-permission-other")
    viewer = await signup_user("edit-permission-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, other_member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    income_response = await create_income(api_client, owner, workspace_id, {"amount_minor": 30000})
    member_expense_response = await create_expense(
        api_client, member, workspace_id, {"amount_minor": 1000}
    )
    other_expense_response = await create_expense(
        api_client, other_member, workspace_id, {"amount_minor": 2000}
    )
    assert income_response.status_code == 201, income_response.text
    assert member_expense_response.status_code == 201, member_expense_response.text
    assert other_expense_response.status_code == 201, other_expense_response.text
    income_id = income_response.json()["id"]
    member_expense_id = member_expense_response.json()["id"]
    other_expense_id = other_expense_response.json()["id"]

    member_income_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/incomes/{income_id}",
        headers=member.auth_header,
        json={"amount_minor": 31000},
    )
    assert member_income_patch.status_code == 403
    viewer_expense_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{member_expense_id}",
        headers=viewer.auth_header,
        json={"amount_minor": 1100},
    )
    assert viewer_expense_patch.status_code == 403
    other_member_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{member_expense_id}",
        headers=other_member.auth_header,
        json={"amount_minor": 1200},
    )
    assert other_member_patch.status_code == 403
    other_member_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{member_expense_id}",
        headers=other_member.auth_header,
    )
    assert other_member_delete.status_code == 403

    admin_income_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/incomes/{income_id}",
        headers=admin.auth_header,
        json={"amount_minor": 32000},
    )
    assert admin_income_patch.status_code == 200, admin_income_patch.text
    owner_expense_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{other_expense_id}",
        headers=owner.auth_header,
        json={"amount_minor": 2500},
    )
    assert owner_expense_patch.status_code == 200, owner_expense_patch.text
    admin_expense_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{other_expense_id}",
        headers=admin.auth_header,
    )
    assert admin_expense_delete.status_code == 204, admin_expense_delete.text
    owner_income_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/incomes/{income_id}",
        headers=owner.auth_header,
    )
    assert owner_income_delete.status_code == 204, owner_income_delete.text


async def test_expense_edit_respects_archived_category_rules(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("edit-category-owner")
    member = await signup_user("edit-category-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    restaurants_id = await default_category_id(db_connection, workspace_id, "Restaurants")
    groceries_id = await default_category_id(db_connection, workspace_id, "Groceries")
    expense_response = await create_expense(
        api_client,
        member,
        workspace_id,
        {"category_id": restaurants_id, "amount_minor": 4500},
    )
    assert expense_response.status_code == 201, expense_response.text
    expense_id = expense_response.json()["id"]

    await db_connection.execute(
        text(
            """
            update public.categories
            set is_archived = true
            where id in (:restaurants_id, :groceries_id)
            """
        ),
        {"restaurants_id": restaurants_id, "groceries_id": groceries_id},
    )
    await db_connection.commit()

    amount_only = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=member.auth_header,
        json={"amount_minor": 5000},
    )
    assert amount_only.status_code == 200, amount_only.text
    assert amount_only.json()["category_id"] == restaurants_id

    archived_category_change = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=member.auth_header,
        json={"category_id": groceries_id},
    )
    assert archived_category_change.status_code == 422
    assert archived_category_change.json()["error"]["code"] == "category_archived"
