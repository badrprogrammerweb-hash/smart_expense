import asyncio

import pytest
from sqlalchemy import text

from app.services import ai_providers
from conftest import add_member, create_team_workspace, default_category_id, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nphase-four-confirm"


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


async def _upload_file(api_client, user, workspace_id: str, filename: str = "receipt.pdf") -> dict:
    response = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=user.auth_header,
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _stub_storage(monkeypatch) -> None:
    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def get_object(key: str) -> bytes:
        return PDF_BYTES

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.get_object", get_object)


def _stub_extraction(monkeypatch, amount_minor: int = 4250) -> None:
    async def extract_receipt(provider, api_key, file_bytes, content_type, category_names=None):
        return ai_providers.ExtractedFields(
            amount_minor=amount_minor,
            currency="USD",
            occurred_on="2026-07-01",
            vendor_name="Panda Hypermarket",
            suggested_category="Groceries",
        )

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)


async def _ready_extraction(api_client, actor, workspace_id: str, filename: str) -> dict:
    file = await _upload_file(api_client, actor, workspace_id, filename)
    response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file['id']}/extractions",
        headers=actor.auth_header,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "ready_for_review"
    return payload


async def _expense_count(db_connection, workspace_id: str) -> int:
    result = await db_connection.execute(
        text(
            """
            select count(*)
            from public.expenses
            where workspace_id = :workspace_id
              and status = 'confirmed'
            """
        ),
        {"workspace_id": workspace_id},
    )
    return int(result.scalar_one())


async def test_confirm_by_triggering_member_creates_one_sar_expense_and_links_file(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-confirm-owner")
    member = await signup_user("extract-confirm-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)
    _stub_extraction(monkeypatch)

    extraction = await _ready_extraction(api_client, member, workspace_id, "member-confirm.pdf")

    response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/confirm",
        headers=member.auth_header,
        json={
            "amount_minor": 9900,
            "occurred_on": "2026-07-03",
            "category_id": None,
            "merchant_name": "Corrected Merchant",
            "description": "Corrected description",
        },
    )
    assert response.status_code == 200, response.text
    confirmed = response.json()
    assert confirmed["status"] == "confirmed"
    assert confirmed["expense_id"] is not None
    assert confirmed["confirmed_by"] == member.user_id

    row = (
        await db_connection.execute(
            text(
                """
                select e.amount_minor, e.currency, e.occurred_on, e.merchant_name,
                       e.description, f.expense_id as file_expense_id,
                       x.status as extraction_status, x.expense_id as extraction_expense_id
                from public.ai_extractions x
                join public.expenses e on e.id = x.expense_id
                join public.files f on f.id = x.file_id
                where x.id = :extraction_id
                """
            ),
            {"extraction_id": extraction["id"]},
        )
    ).one()
    assert row.amount_minor == 9900
    assert row.currency == "SAR"
    assert row.occurred_on.isoformat() == "2026-07-03"
    assert row.merchant_name == "Corrected Merchant"
    assert row.description == "Corrected description"
    assert str(row.file_expense_id) == confirmed["expense_id"]
    assert row.extraction_status == "confirmed"
    assert str(row.extraction_expense_id) == confirmed["expense_id"]
    assert await _expense_count(db_connection, workspace_id) == 1


async def test_confirm_overrides_suggested_category_with_reviewers_final_choice(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    """`ConfirmExtractionRequest.category_id` still accepts any active
    main/sub category regardless of the original AI suggestion, and only
    the reviewer's final submitted choice is ever persisted (FR-019) —
    never auto-confirming the suggestion itself."""
    owner = await signup_user("extract-confirm-category-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)
    _stub_extraction(monkeypatch)  # suggests "Groceries"

    groceries_id = await default_category_id(db_connection, workspace_id, "Groceries")
    rent_id = await default_category_id(db_connection, workspace_id, "Rent")

    extraction = await _ready_extraction(api_client, owner, workspace_id, "override.pdf")
    assert extraction["draft"]["suggested_category_id"] == groceries_id

    response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/confirm",
        headers=owner.auth_header,
        json={"amount_minor": 4200, "occurred_on": "2026-07-03", "category_id": rent_id},
    )
    assert response.status_code == 200, response.text
    expense_id = response.json()["expense_id"]

    row = (
        await db_connection.execute(
            text("select category_id from public.expenses where id = :id"),
            {"id": expense_id},
        )
    ).one()
    assert str(row.category_id) == rent_id


async def test_concurrent_confirm_does_not_create_duplicate_expenses(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    """Many simultaneous confirm calls on the same extraction (double-click,
    duplicate retry, or two admins racing) must yield exactly one expense.
    Regression test for the missing `for update` row lock in
    confirm_ai_extraction -- without it, calls could read 'ready_for_review'
    before any of them commit and each insert their own expense row.

    A single unlocked plpgsql call executes far too fast (sub-millisecond,
    no I/O) for two concurrent requests to reliably collide inside its tiny
    read-then-write window -- verified empirically: with only 2 concurrent
    calls against a deliberately-unlocked copy of this RPC, 10/10 local runs
    still came back [200, 409] (no duplicate), a false negative. Firing 30
    concurrent calls instead reliably reproduced multiple 200s (i.e. more
    than one expense) against the unlocked RPC in every trial, so 30 is used
    here as the smallest concurrency that actually exercises the race rather
    than one that merely looks like it does.
    """
    owner = await signup_user("extract-confirm-race-owner")
    member = await signup_user("extract-confirm-race-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)
    _stub_extraction(monkeypatch)

    extraction = await _ready_extraction(api_client, member, workspace_id, "race-confirm.pdf")

    async def confirm():
        return await api_client.post(
            f"/workspaces/{workspace_id}/extractions/{extraction['id']}/confirm",
            headers=member.auth_header,
            json={"amount_minor": 4200, "occurred_on": "2026-07-03"},
        )

    responses = await asyncio.gather(*(confirm() for _ in range(30)))
    statuses = [response.status_code for response in responses]
    assert statuses.count(200) == 1, statuses
    assert statuses.count(409) == 29, statuses

    assert await _expense_count(db_connection, workspace_id) == 1


async def test_confirm_role_rules_validation_and_duplicate_submit(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-confirm-rules-owner")
    admin = await signup_user("extract-confirm-rules-admin")
    member = await signup_user("extract-confirm-rules-member")
    other_member = await signup_user("extract-confirm-rules-other")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (
        await add_member(api_client, owner, workspace_id, other_member, "member")
    ).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)
    _stub_extraction(monkeypatch)

    member_extraction = await _ready_extraction(api_client, member, workspace_id, "member-owned.pdf")
    forbidden = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{member_extraction['id']}/confirm",
        headers=other_member.auth_header,
        json={"amount_minor": 4200, "occurred_on": "2026-07-03"},
    )
    assert forbidden.status_code == 403, forbidden.text

    admin_confirm = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{member_extraction['id']}/confirm",
        headers=admin.auth_header,
        json={"amount_minor": 4200, "occurred_on": "2026-07-03"},
    )
    assert admin_confirm.status_code == 200, admin_confirm.text

    duplicate = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{member_extraction['id']}/confirm",
        headers=admin.auth_header,
        json={"amount_minor": 4200, "occurred_on": "2026-07-03"},
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["error"]["code"] == "already_resolved"
    assert await _expense_count(db_connection, workspace_id) == 1

    invalid_extraction = await _ready_extraction(api_client, member, workspace_id, "invalid.pdf")
    invalid = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{invalid_extraction['id']}/confirm",
        headers=member.auth_header,
        json={"amount_minor": 0, "occurred_on": "2026-07-03"},
    )
    assert invalid.status_code == 422, invalid.text
    assert invalid.json()["error"]["code"] == "invalid_request"
    assert await _expense_count(db_connection, workspace_id) == 1

    owner_extraction = await _ready_extraction(api_client, member, workspace_id, "owner-any.pdf")
    owner_confirm = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{owner_extraction['id']}/confirm",
        headers=owner.auth_header,
        json={"amount_minor": 5300, "occurred_on": "2026-07-04"},
    )
    assert owner_confirm.status_code == 200, owner_confirm.text
    assert await _expense_count(db_connection, workspace_id) == 2


async def test_confirm_authorization_is_checked_before_amount_validation(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    """A non-triggering Member must be rejected with 403, not 422, even when
    the request body also happens to be invalid -- authorization must not be
    bypassable by pairing it with a bad amount (FR-011, FR-013)."""
    owner = await signup_user("extract-confirm-order-owner")
    member = await signup_user("extract-confirm-order-member")
    other_member = await signup_user("extract-confirm-order-other")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (
        await add_member(api_client, owner, workspace_id, other_member, "member")
    ).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)
    _stub_extraction(monkeypatch)

    extraction = await _ready_extraction(api_client, member, workspace_id, "order-check.pdf")

    response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/confirm",
        headers=other_member.auth_header,
        json={"amount_minor": 0, "occurred_on": "2026-07-03"},
    )
    assert response.status_code == 403, response.text
    assert response.json()["error"]["code"] == "forbidden"
    assert await _expense_count(db_connection, workspace_id) == 0
