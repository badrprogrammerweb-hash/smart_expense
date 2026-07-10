import pytest
from sqlalchemy import text

from conftest import (
    create_expense,
    create_income,
    create_team_workspace,
    list_expenses,
    list_incomes,
    period_date,
    requires_supabase,
)


pytestmark = [pytest.mark.asyncio, pytest.mark.acceptance, requires_supabase]


EXPECTED_WORKSPACE_A = {
    "total_income_minor": 325000,
    "total_expenses_minor": 57000,
    "remaining_balance_minor": 268000,
}
EXPECTED_WORKSPACE_B = {
    "total_income_minor": 50000,
    "total_expenses_minor": 70000,
    "remaining_balance_minor": -20000,
}


async def _dashboard(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard?recent_limit=50",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _report(api_client, user, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/reports?recent_limit=50",
        headers=user.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


def _assert_summary(summary: dict, expected: dict[str, int]) -> None:
    for key, value in expected.items():
        assert summary[key] == value
    assert summary["currency"] == "SAR"
    assert summary["remaining_balance_minor"] == (
        summary["total_income_minor"] - summary["total_expenses_minor"]
    )
    assert all(isinstance(summary[key], int) for key in expected)


async def _assert_dashboard_and_report_summary(
    api_client,
    user,
    workspace_id: str,
    expected: dict[str, int],
) -> None:
    dashboard = await _dashboard(api_client, user, workspace_id)
    report = await _report(api_client, user, workspace_id)
    _assert_summary(dashboard["summary"], expected)
    _assert_summary(report["summary"], expected)


async def test_remaining_balance_equals_confirmed_income_minus_expenses(
    api_client,
    acceptance_world,
) -> None:
    await _assert_dashboard_and_report_summary(
        api_client,
        acceptance_world.workspace_a.owner,
        acceptance_world.workspace_a.id,
        EXPECTED_WORKSPACE_A,
    )


async def test_zero_income_zero_expense_negative_balance(
    api_client,
    signup_user,
) -> None:
    owner = await signup_user("acc-financial-edge-owner")

    empty_workspace = await create_team_workspace(api_client, owner, "Acceptance Empty")
    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        empty_workspace["id"],
        {
            "total_income_minor": 0,
            "total_expenses_minor": 0,
            "remaining_balance_minor": 0,
        },
    )

    income_only_workspace = await create_team_workspace(
        api_client,
        owner,
        "Acceptance Zero Expense",
    )
    income_response = await create_income(
        api_client,
        owner,
        income_only_workspace["id"],
        {"amount_minor": 12345, "occurred_on": period_date(8)},
    )
    assert income_response.status_code == 201, income_response.text
    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        income_only_workspace["id"],
        {
            "total_income_minor": 12345,
            "total_expenses_minor": 0,
            "remaining_balance_minor": 12345,
        },
    )

    expense_only_workspace = await create_team_workspace(
        api_client,
        owner,
        "Acceptance Zero Income",
    )
    expense_response = await create_expense(
        api_client,
        owner,
        expense_only_workspace["id"],
        {"amount_minor": 6789, "occurred_on": period_date(9)},
    )
    assert expense_response.status_code == 201, expense_response.text
    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        expense_only_workspace["id"],
        {
            "total_income_minor": 0,
            "total_expenses_minor": 6789,
            "remaining_balance_minor": -6789,
        },
    )


async def test_edit_and_delete_recalculate_totals(
    api_client,
    acceptance_world,
) -> None:
    owner = acceptance_world.workspace_a.owner
    member = acceptance_world.user_for_role("member")
    workspace_id = acceptance_world.workspace_a.id

    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        workspace_id,
        EXPECTED_WORKSPACE_A,
    )

    incomes = await list_incomes(api_client, owner, workspace_id)
    income_ids = {income["id"] for income in incomes}
    assert acceptance_world.records.edited_income_id in income_ids
    assert acceptance_world.records.deleted_income_id not in income_ids
    assert any(
        income["id"] == acceptance_world.records.edited_income_id
        and income["amount_minor"] == 75000
        for income in incomes
    )

    income_response = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 10000, "occurred_on": period_date(10)},
    )
    assert income_response.status_code == 201, income_response.text
    income_id = income_response.json()["id"]
    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        workspace_id,
        {
            **EXPECTED_WORKSPACE_A,
            "total_income_minor": EXPECTED_WORKSPACE_A["total_income_minor"] + 10000,
            "remaining_balance_minor": EXPECTED_WORKSPACE_A["remaining_balance_minor"] + 10000,
        },
    )

    income_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/incomes/{income_id}",
        headers=owner.auth_header,
        json={"amount_minor": 15000},
    )
    assert income_patch.status_code == 200, income_patch.text
    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        workspace_id,
        {
            **EXPECTED_WORKSPACE_A,
            "total_income_minor": EXPECTED_WORKSPACE_A["total_income_minor"] + 15000,
            "remaining_balance_minor": EXPECTED_WORKSPACE_A["remaining_balance_minor"] + 15000,
        },
    )

    income_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/incomes/{income_id}",
        headers=owner.auth_header,
    )
    assert income_delete.status_code == 204, income_delete.text
    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        workspace_id,
        EXPECTED_WORKSPACE_A,
    )

    expenses = await list_expenses(api_client, owner, workspace_id)
    expense_ids = {expense["id"] for expense in expenses}
    assert acceptance_world.records.edited_expense_id in expense_ids
    assert acceptance_world.records.deleted_expense_id not in expense_ids
    assert any(
        expense["id"] == acceptance_world.records.edited_expense_id
        and expense["amount_minor"] == 12000
        for expense in expenses
    )

    expense_response = await create_expense(
        api_client,
        member,
        workspace_id,
        {
            "amount_minor": 3000,
            "occurred_on": period_date(11),
            "category_id": acceptance_world.workspace_a.category_ids["groceries"],
            "merchant_name": "Acceptance Recalc",
        },
    )
    assert expense_response.status_code == 201, expense_response.text
    expense_id = expense_response.json()["id"]
    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        workspace_id,
        {
            **EXPECTED_WORKSPACE_A,
            "total_expenses_minor": EXPECTED_WORKSPACE_A["total_expenses_minor"] + 3000,
            "remaining_balance_minor": EXPECTED_WORKSPACE_A["remaining_balance_minor"] - 3000,
        },
    )

    expense_patch = await api_client.patch(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=member.auth_header,
        json={"amount_minor": 7000, "merchant_name": "Acceptance Recalc Edited"},
    )
    assert expense_patch.status_code == 200, expense_patch.text
    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        workspace_id,
        {
            **EXPECTED_WORKSPACE_A,
            "total_expenses_minor": EXPECTED_WORKSPACE_A["total_expenses_minor"] + 7000,
            "remaining_balance_minor": EXPECTED_WORKSPACE_A["remaining_balance_minor"] - 7000,
        },
    )

    expense_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=member.auth_header,
    )
    assert expense_delete.status_code == 204, expense_delete.text
    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        workspace_id,
        EXPECTED_WORKSPACE_A,
    )


async def test_draft_pending_failed_ai_move_zero_totals(
    api_client,
    acceptance_world,
    db_connection,
) -> None:
    await _assert_dashboard_and_report_summary(
        api_client,
        acceptance_world.workspace_a.owner,
        acceptance_world.workspace_a.id,
        EXPECTED_WORKSPACE_A,
    )

    result = await db_connection.execute(
        text(
            """
            select id, status, amount_minor
            from public.ai_extractions
            where id in (:pending_id, :draft_id, :failed_id)
            """
        ),
        {
            "pending_id": acceptance_world.records.pending_ai_extraction_id,
            "draft_id": acceptance_world.records.draft_ai_extraction_id,
            "failed_id": acceptance_world.records.failed_ai_extraction_id,
        },
    )
    ai_rows = {str(row.id): row for row in result}
    assert ai_rows[acceptance_world.records.pending_ai_extraction_id].status == "processing"
    assert ai_rows[acceptance_world.records.draft_ai_extraction_id].status == "ready_for_review"
    assert ai_rows[acceptance_world.records.failed_ai_extraction_id].status == "failed"
    assert ai_rows[acceptance_world.records.draft_ai_extraction_id].amount_minor == 64000
    assert ai_rows[acceptance_world.records.failed_ai_extraction_id].amount_minor == 81000

    dashboard = await _dashboard(
        api_client,
        acceptance_world.workspace_a.owner,
        acceptance_world.workspace_a.id,
    )
    report = await _report(
        api_client,
        acceptance_world.workspace_a.owner,
        acceptance_world.workspace_a.id,
    )
    for payload in (dashboard, report):
        assert payload["summary"]["total_expenses_minor"] == 57000
        assert payload["summary"]["total_expenses_minor"] != 57000 + 64000 + 81000
        assert payload["summary"]["remaining_balance_minor"] == 268000


async def test_money_is_integer_minor_units_no_float_drift(
    api_client,
    signup_user,
) -> None:
    owner = await signup_user("acc-money-owner")
    workspace = await create_team_workspace(api_client, owner, "Acceptance Integer Money")

    income_response = await create_income(
        api_client,
        owner,
        workspace["id"],
        {"amount_minor": 101, "occurred_on": period_date(12)},
    )
    assert income_response.status_code == 201, income_response.text
    expense_response = await create_expense(
        api_client,
        owner,
        workspace["id"],
        {"amount_minor": 33, "occurred_on": period_date(13)},
    )
    assert expense_response.status_code == 201, expense_response.text

    await _assert_dashboard_and_report_summary(
        api_client,
        owner,
        workspace["id"],
        {
            "total_income_minor": 101,
            "total_expenses_minor": 33,
            "remaining_balance_minor": 68,
        },
    )


async def test_multi_workspace_totals_are_independent(
    api_client,
    acceptance_world,
) -> None:
    await _assert_dashboard_and_report_summary(
        api_client,
        acceptance_world.workspace_a.owner,
        acceptance_world.workspace_a.id,
        EXPECTED_WORKSPACE_A,
    )
    await _assert_dashboard_and_report_summary(
        api_client,
        acceptance_world.workspace_b.owner,
        acceptance_world.workspace_b.id,
        EXPECTED_WORKSPACE_B,
    )
