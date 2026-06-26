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


async def _assert_status(response, expected: int) -> None:
    assert response.status_code == expected, response.text


async def _create_income_id(client, caller, workspace_id: str) -> str:
    response = await create_income(client, caller, workspace_id)
    await _assert_status(response, 201)
    return response.json()["id"]


async def _create_expense_id(client, caller, workspace_id: str) -> str:
    response = await create_expense(client, caller, workspace_id)
    await _assert_status(response, 201)
    return response.json()["id"]


async def _create_category_id(client, caller, workspace_id: str) -> str:
    response = await create_category(client, caller, workspace_id)
    await _assert_status(response, 201)
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

    await _assert_status(await add_member(api_client, owner, workspace_id, admin, "admin"), 201)
    await _assert_status(await add_member(api_client, owner, workspace_id, member, "member"), 201)
    await _assert_status(await add_member(api_client, owner, workspace_id, viewer, "viewer"), 201)

    users_by_role = {
        "owner": owner,
        "admin": admin,
        "member": member,
        "viewer": viewer,
    }

    income_create_expected = {"owner": 201, "admin": 201, "member": 403, "viewer": 403}
    for role, user in users_by_role.items():
        response = await create_income(api_client, user, workspace_id)
        await _assert_status(response, income_create_expected[role])

    for role, user in users_by_role.items():
        income_id = await _create_income_id(api_client, owner, workspace_id)
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/incomes/{income_id}",
            headers=user.auth_header,
            json={"amount_minor": 510000},
        )
        await _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    for role, user in users_by_role.items():
        income_id = await _create_income_id(api_client, owner, workspace_id)
        response = await api_client.delete(
            f"/workspaces/{workspace_id}/incomes/{income_id}",
            headers=user.auth_header,
        )
        await _assert_status(response, 204 if role in {"owner", "admin"} else 403)

    expense_create_expected = {"owner": 201, "admin": 201, "member": 201, "viewer": 403}
    for role, user in users_by_role.items():
        response = await create_expense(api_client, user, workspace_id)
        await _assert_status(response, expense_create_expected[role])

    owned_expense_callers = {"owner": owner, "admin": admin, "member": member}
    for role, user in users_by_role.items():
        caller = owned_expense_callers.get(role, owner)
        expense_id = await _create_expense_id(api_client, caller, workspace_id)
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/expenses/{expense_id}",
            headers=user.auth_header,
            json={"amount_minor": 5500},
        )
        await _assert_status(response, 200 if role in {"owner", "admin", "member"} else 403)

    for role, user in users_by_role.items():
        other_expense_id = await _create_expense_id(api_client, owner, workspace_id)
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/expenses/{other_expense_id}",
            headers=user.auth_header,
            json={"amount_minor": 5600},
        )
        await _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    for role, user in users_by_role.items():
        caller = owned_expense_callers.get(role, owner)
        expense_id = await _create_expense_id(api_client, caller, workspace_id)
        response = await api_client.delete(
            f"/workspaces/{workspace_id}/expenses/{expense_id}",
            headers=user.auth_header,
        )
        await _assert_status(response, 204 if role in {"owner", "admin", "member"} else 403)

    for role, user in users_by_role.items():
        other_expense_id = await _create_expense_id(api_client, owner, workspace_id)
        response = await api_client.delete(
            f"/workspaces/{workspace_id}/expenses/{other_expense_id}",
            headers=user.auth_header,
        )
        await _assert_status(response, 204 if role in {"owner", "admin"} else 403)

    category_create_expected = {"owner": 201, "admin": 201, "member": 403, "viewer": 403}
    for role, user in users_by_role.items():
        response = await create_category(api_client, user, workspace_id)
        await _assert_status(response, category_create_expected[role])

    for role, user in users_by_role.items():
        category_id = await _create_category_id(api_client, owner, workspace_id)
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/categories/{category_id}",
            headers=user.auth_header,
            json={"name": f"Renamed {role}"},
        )
        await _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    for role, user in users_by_role.items():
        category_id = await _create_category_id(api_client, owner, workspace_id)
        response = await api_client.patch(
            f"/workspaces/{workspace_id}/categories/{category_id}",
            headers=user.auth_header,
            json={"is_archived": True},
        )
        await _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    for role, user in users_by_role.items():
        categories = await list_categories(api_client, owner, workspace_id)
        category_ids = [category["id"] for category in reversed(categories)]
        response = await api_client.put(
            f"/workspaces/{workspace_id}/categories/order",
            headers=user.auth_header,
            json={"category_ids": category_ids},
        )
        await _assert_status(response, 200 if role in {"owner", "admin"} else 403)

    for endpoint in ("incomes", "expenses", "categories"):
        response = await api_client.get(
            f"/workspaces/{outsider_workspace_id}/{endpoint}",
            headers=owner.auth_header,
        )
        await _assert_status(response, 404)
