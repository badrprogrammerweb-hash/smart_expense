import pytest

from conftest import (
    add_member,
    create_income,
    create_team_workspace,
    list_incomes,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_create_income_role_validation_and_listing(api_client, signup_user) -> None:
    owner = await signup_user("income-owner")
    admin = await signup_user("income-admin")
    member = await signup_user("income-member")
    viewer = await signup_user("income-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    owner_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 500000, "occurred_on": "2026-06-01", "description": "Salary"},
    )
    assert owner_response.status_code == 201, owner_response.text
    owner_income = owner_response.json()
    assert owner_income["amount_minor"] == 500000
    assert owner_income["currency"] == "SAR"
    assert owner_income["occurred_on"] == "2026-06-01"
    assert owner_income["description"] == "Salary"
    assert owner_income["status"] == "confirmed"
    assert owner_income["created_by"] == owner.user_id

    admin_response = await create_income(
        api_client,
        admin,
        workspace_id,
        {"amount_minor": 75000, "occurred_on": "2026-06-02"},
    )
    assert admin_response.status_code == 201, admin_response.text
    assert admin_response.json()["created_by"] == admin.user_id

    assert (await create_income(api_client, member, workspace_id)).status_code == 403
    assert (await create_income(api_client, viewer, workspace_id)).status_code == 403

    for user in (owner, admin, member, viewer):
        incomes = await list_incomes(api_client, user, workspace_id)
        income_ids = {income["id"] for income in incomes}
        assert owner_income["id"] in income_ids
        assert admin_response.json()["id"] in income_ids


async def test_create_income_rejects_invalid_payloads(api_client, signup_user) -> None:
    owner = await signup_user("income-invalid-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    invalid_payloads = [
        {"amount_minor": 0, "occurred_on": "2026-06-01"},
        {"amount_minor": -1, "occurred_on": "2026-06-01"},
        {"occurred_on": "2026-06-01"},
        {"amount_minor": 500000},
        {"amount_minor": 500000, "occurred_on": "not-a-date"},
    ]

    for payload in invalid_payloads:
        response = await api_client.post(
            f"/workspaces/{workspace_id}/incomes",
            headers=owner.auth_header,
            json=payload,
        )
        assert response.status_code == 422, response.text
