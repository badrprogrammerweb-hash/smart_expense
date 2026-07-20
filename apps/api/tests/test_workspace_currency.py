import pytest
from sqlalchemy import text

from conftest import add_member, create_expense, create_income, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def _workspace_currency(db_connection, workspace_id: str) -> str:
    result = await db_connection.execute(
        text("select currency from public.workspaces where id = :workspace_id"),
        {"workspace_id": workspace_id},
    )
    return result.scalar_one()


async def test_owner_sets_currency_before_records_and_records_use_it(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("currency-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert workspace["currency"] == "SAR"

    update_response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"currency": "USD"},
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json() == {
        "id": workspace_id,
        "currency": "USD",
        "auto_delete_after_extraction": False,
    }

    workspace_response = await api_client.get(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
    )
    assert workspace_response.status_code == 200, workspace_response.text
    assert workspace_response.json()["currency"] == "USD"

    income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 100000, "occurred_on": "2026-07-20"},
    )
    assert income_response.status_code == 201, income_response.text
    assert income_response.json()["currency"] == "USD"

    expense_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 25000, "occurred_on": "2026-07-21"},
    )
    assert expense_response.status_code == 201, expense_response.text
    assert expense_response.json()["currency"] == "USD"

    locked_response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"currency": "EUR"},
    )
    assert locked_response.status_code == 409, locked_response.text
    assert locked_response.json()["error"]["code"] == "currency_locked"
    assert await _workspace_currency(db_connection, workspace_id) == "USD"


async def test_workspace_currency_locks_after_soft_deleted_record(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("currency-soft-delete-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    update_response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"currency": "KWD"},
    )
    assert update_response.status_code == 200, update_response.text

    expense_response = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 25000, "occurred_on": "2026-07-21"},
    )
    assert expense_response.status_code == 201, expense_response.text
    expense_id = expense_response.json()["id"]

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text

    locked_response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"currency": "OMR"},
    )
    assert locked_response.status_code == 409, locked_response.text
    assert locked_response.json()["error"]["code"] == "currency_locked"
    assert await _workspace_currency(db_connection, workspace_id) == "KWD"


async def test_non_owners_cannot_update_workspace_currency(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("currency-role-owner")
    admin = await signup_user("currency-role-admin")
    member = await signup_user("currency-role-member")
    viewer = await signup_user("currency-role-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    for caller in (admin, member, viewer):
        response = await api_client.patch(
            f"/workspaces/{workspace_id}",
            headers=caller.auth_header,
            json={"currency": "AED"},
        )

        assert response.status_code == 403, response.text
        assert response.json()["error"]["code"] == "forbidden"

    assert await _workspace_currency(db_connection, workspace_id) == "SAR"


async def test_unsupported_workspace_currency_is_rejected(api_client, signup_user) -> None:
    owner = await signup_user("currency-invalid-owner")
    workspace = await create_team_workspace(api_client, owner)

    response = await api_client.patch(
        f"/workspaces/{workspace['id']}",
        headers=owner.auth_header,
        json={"currency": "JPY"},
    )

    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "invalid_request"
