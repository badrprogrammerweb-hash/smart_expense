import pytest

from conftest import (
    add_member,
    create_category,
    create_expense,
    create_income,
    create_team_workspace,
    list_categories,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


def _assert_status(response, expected: int) -> None:
    assert response.status_code == expected, response.text


async def _create_resource_id(coro) -> str:
    response = await coro
    _assert_status(response, 201)
    return response.json()["id"]


async def test_role_permission_matrix_and_cross_workspace_isolation(
    api_client, signup_user
) -> None:
    owner = await signup_user()
    admin = await signup_user()
    member = await signup_user()
    viewer = await signup_user()
    outsider_owner = await signup_user()
    workspace = await create_team_workspace(api_client, owner)
    outsider_workspace = await create_team_workspace(api_client, outsider_owner)
    workspace_id = workspace["id"]
    outsider_workspace_id = outsider_workspace["id"]

    _assert_status(await add_member(api_client, owner, workspace_id, admin, "admin"), 201)
    _assert_status(await add_member(api_client, owner, workspace_id, member, "member"), 201)
    _assert_status(await add_member(api_client, owner, workspace_id, viewer, "viewer"), 201)

    users_by_role = {
        "owner": owner,
        "admin": admin,
        "member": member,
        "viewer": viewer,
    }

    # --- READ (all roles can list all three resources) ---
    for _, user in users_by_role.items():
        for endpoint in ("incomes", "expenses", "categories?category_type=expense"):
            response = await api_client.get(
                f"/workspaces/{workspace_id}/{endpoint}",
                headers=user.auth_header,
            )
            _assert_status(response, 200)

    # --- INCOME CREATE ---
    income_create_expected = {"owner": 201, "admin": 201, "member": 403, "viewer": 403}
    for role, user in users_by_role.items():
        response = await create_income(api_client, user, workspace_id)
        _assert_status(response, income_create_expected[role])

    # --- INCOME EDIT ---
    for role, user in users_by_role.items():
        income_id = await _create_resource_id(create_income(api_client, owner, workspace_id))
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/incomes/{income_id}",
            headers=user.auth_header,
            json={"amount_minor": 510000},
        )
        _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    # --- INCOME DELETE ---
    for role, user in users_by_role.items():
        income_id = await _create_resource_id(create_income(api_client, owner, workspace_id))
        response = await api_client.delete(
            f"/workspaces/{workspace_id}/incomes/{income_id}",
            headers=user.auth_header,
        )
        _assert_status(response, 204 if role in {"owner", "admin"} else 403)

    # --- EXPENSE CREATE ---
    expense_create_expected = {"owner": 201, "admin": 201, "member": 201, "viewer": 403}
    for role, user in users_by_role.items():
        response = await create_expense(api_client, user, workspace_id)
        _assert_status(response, expense_create_expected[role])

    owned_expense_callers = {"owner": owner, "admin": admin, "member": member}

    # --- EXPENSE EDIT (OWN) ---
    for role, user in users_by_role.items():
        caller = owned_expense_callers.get(role, owner)
        expense_id = await _create_resource_id(create_expense(api_client, caller, workspace_id))
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/expenses/{expense_id}",
            headers=user.auth_header,
            json={"amount_minor": 5500},
        )
        _assert_status(response, 200 if role in {"owner", "admin", "member"} else 403)

    # --- EXPENSE EDIT (OTHER'S) ---
    for role, user in users_by_role.items():
        other_expense_id = await _create_resource_id(create_expense(api_client, owner, workspace_id))
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/expenses/{other_expense_id}",
            headers=user.auth_header,
            json={"amount_minor": 5600},
        )
        _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    # --- EXPENSE DELETE (OWN) ---
    for role, user in users_by_role.items():
        caller = owned_expense_callers.get(role, owner)
        expense_id = await _create_resource_id(create_expense(api_client, caller, workspace_id))
        response = await api_client.delete(
            f"/workspaces/{workspace_id}/expenses/{expense_id}",
            headers=user.auth_header,
        )
        _assert_status(response, 204 if role in {"owner", "admin", "member"} else 403)

    # --- EXPENSE DELETE (OTHER'S) ---
    for role, user in users_by_role.items():
        other_expense_id = await _create_resource_id(create_expense(api_client, owner, workspace_id))
        response = await api_client.delete(
            f"/workspaces/{workspace_id}/expenses/{other_expense_id}",
            headers=user.auth_header,
        )
        _assert_status(response, 204 if role in {"owner", "admin"} else 403)

    # --- CATEGORY CREATE ---
    category_create_expected = {"owner": 201, "admin": 201, "member": 403, "viewer": 403}
    for role, user in users_by_role.items():
        response = await create_category(api_client, user, workspace_id)
        _assert_status(response, category_create_expected[role])

    # --- CATEGORY RENAME ---
    for role, user in users_by_role.items():
        category_id = await _create_resource_id(create_category(api_client, owner, workspace_id))
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/categories/{category_id}",
            headers=user.auth_header,
            json={"name": f"Renamed {role}"},
        )
        _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    # --- CATEGORY ARCHIVE ---
    for role, user in users_by_role.items():
        category_id = await _create_resource_id(create_category(api_client, owner, workspace_id))
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/categories/{category_id}",
            headers=user.auth_header,
            json={"is_archived": True},
        )
        _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    # --- CATEGORY REORDER ---
    categories = await list_categories(api_client, owner, workspace_id)
    category_ids = [category["id"] for category in reversed(categories)]
    for role, user in users_by_role.items():
        response = await api_client.put(
            f"/workspaces/{workspace_id}/categories/order",
            headers=user.auth_header,
            json={"category_type": "expense", "category_ids": category_ids},
        )
        _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    # --- CROSS-WORKSPACE ISOLATION ---
    for endpoint in ("incomes", "expenses", "categories?category_type=expense"):
        response = await api_client.get(
            f"/workspaces/{outsider_workspace_id}/{endpoint}",
            headers=owner.auth_header,
        )
        _assert_status(response, 404)

    for body, endpoint in (
        ({"amount_minor": 100, "occurred_on": "2026-06-01"}, "incomes"),
        ({"amount_minor": 100, "occurred_on": "2026-06-01"}, "expenses"),
        ({"name": "X", "category_type": "expense"}, "categories"),
    ):
        response = await api_client.post(
            f"/workspaces/{outsider_workspace_id}/{endpoint}",
            headers=owner.auth_header,
            json=body,
        )
        _assert_status(response, 404)
