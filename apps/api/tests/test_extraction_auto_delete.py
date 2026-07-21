"""Backend tests for Phase 7 (US5): the Phase 6 `auto_delete_after_extraction`
setting only ever removes a file's binary immediately after a *successful
confirm*, never on failure/discard/extraction-alone (FR-017, FR-021, FR-023,
FR-024; SC-006). The confirming actor here is deliberately a Member acting on
their own triggered extraction -- Phase 6 normally restricts file deletion to
Owner/Admin, so a Member successfully triggering the soft-delete only works
because `confirm_ai_extraction`'s SECURITY DEFINER bypasses `files` RLS
(research.md Decision 9)."""

import pytest
from sqlalchemy import text

from app.schemas.extractions import FailureReason
from app.services import ai_providers
from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nphase-seven-auto-delete"


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


async def _set_auto_delete(api_client, owner, workspace_id: str, enabled: bool) -> None:
    response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"auto_delete_after_extraction": enabled},
    )
    assert response.status_code == 200, response.text
    assert response.json()["auto_delete_after_extraction"] is enabled


async def _upload_file(api_client, user, workspace_id: str, filename: str) -> dict:
    response = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=user.auth_header,
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _stub_storage(monkeypatch) -> list[str]:
    remove_calls: list[str] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def get_object(key: str) -> bytes:
        return PDF_BYTES

    async def remove_object(key: str) -> None:
        remove_calls.append(key)

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.get_object", get_object)
    monkeypatch.setattr("app.services.storage.remove_object", remove_object)
    return remove_calls


def _stub_ready_extraction(monkeypatch, amount_minor: int = 4250) -> None:
    async def extract_receipt(provider, api_key, file_bytes, content_type, category_names=None):
        return ai_providers.ExtractedFields(
            amount_minor=amount_minor,
            currency="SAR",
            occurred_on="2026-07-01",
            vendor_name="Panda Hypermarket",
            suggested_category="Groceries",
        )

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)


def _stub_failed_extraction(monkeypatch) -> None:
    async def extract_receipt(provider, api_key, file_bytes, content_type, category_names=None):
        return ai_providers.ExtractionFailure(failure_reason=FailureReason.TIMEOUT)

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)


async def _trigger_extraction(api_client, actor, workspace_id: str, file_id: str) -> dict:
    response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file_id}/extractions",
        headers=actor.auth_header,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _file_state(db_connection, file_id: str):
    return (
        await db_connection.execute(
            text(
                """
                select status, expense_id, deleted_at, deleted_by, storage_path
                from public.files
                where id = :file_id
                """
            ),
            {"file_id": file_id},
        )
    ).one()


async def test_member_confirm_with_auto_delete_on_removes_binary_and_soft_deletes_file(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("auto-delete-confirm-owner")
    member = await signup_user("auto-delete-confirm-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    await _set_auto_delete(api_client, owner, workspace_id, True)
    remove_calls = _stub_storage(monkeypatch)
    _stub_ready_extraction(monkeypatch)

    file = await _upload_file(api_client, member, workspace_id, "auto-delete-on.pdf")
    before = await _file_state(db_connection, file["id"])
    storage_path = before.storage_path

    extraction = await _trigger_extraction(api_client, member, workspace_id, file["id"])
    assert extraction["status"] == "ready_for_review"

    confirm = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/confirm",
        headers=member.auth_header,
        json={"amount_minor": 4250, "occurred_on": "2026-07-01"},
    )
    assert confirm.status_code == 200, confirm.text
    payload = confirm.json()
    assert payload["status"] == "confirmed"
    expense_id = payload["expense_id"]
    assert expense_id is not None

    # The file binary is gone...
    assert remove_calls == [storage_path]

    # ...but the file's metadata row is retained, marked deleted, and the
    # expense it produced still exists (soft-delete, not erasure).
    after = await _file_state(db_connection, file["id"])
    assert after.status == "deleted"
    assert after.deleted_at is not None
    assert str(after.deleted_by) == member.user_id
    assert str(after.expense_id) == expense_id

    expense_row = (
        await db_connection.execute(
            text("select amount_minor, currency, status from public.expenses where id = :id"),
            {"id": expense_id},
        )
    ).one()
    assert expense_row.amount_minor == 4250
    assert expense_row.currency == "SAR"
    assert expense_row.status == "confirmed"


async def test_confirm_with_auto_delete_off_retains_file_binary(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("auto-delete-off-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    # auto_delete_after_extraction defaults to False; do not enable it.
    remove_calls = _stub_storage(monkeypatch)
    _stub_ready_extraction(monkeypatch)

    file = await _upload_file(api_client, owner, workspace_id, "auto-delete-off.pdf")
    extraction = await _trigger_extraction(api_client, owner, workspace_id, file["id"])
    assert extraction["status"] == "ready_for_review"

    confirm = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/confirm",
        headers=owner.auth_header,
        json={"amount_minor": 3300, "occurred_on": "2026-07-02"},
    )
    assert confirm.status_code == 200, confirm.text
    assert confirm.json()["status"] == "confirmed"

    assert remove_calls == []
    after = await _file_state(db_connection, file["id"])
    assert after.status == "active"
    assert after.deleted_at is None
    assert after.deleted_by is None


async def test_failed_and_discarded_extractions_with_auto_delete_on_never_touch_file(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("auto-delete-untouched-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    await _set_auto_delete(api_client, owner, workspace_id, True)
    remove_calls = _stub_storage(monkeypatch)

    # Failed extraction: auto-delete must not fire on failure alone.
    _stub_failed_extraction(monkeypatch)
    failed_file = await _upload_file(api_client, owner, workspace_id, "auto-delete-failed.pdf")
    failed_before = await _file_state(db_connection, failed_file["id"])
    failed_extraction = await _trigger_extraction(api_client, owner, workspace_id, failed_file["id"])
    assert failed_extraction["status"] == "failed"

    failed_after = await _file_state(db_connection, failed_file["id"])
    assert failed_after.status == "active"
    assert failed_after.deleted_at is None
    assert failed_after.storage_path == failed_before.storage_path

    # Discarded extraction: auto-delete must not fire on discard either.
    _stub_ready_extraction(monkeypatch)
    discarded_file = await _upload_file(api_client, owner, workspace_id, "auto-delete-discarded.pdf")
    discarded_before = await _file_state(db_connection, discarded_file["id"])
    discarded_extraction = await _trigger_extraction(
        api_client, owner, workspace_id, discarded_file["id"]
    )
    assert discarded_extraction["status"] == "ready_for_review"

    discard = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{discarded_extraction['id']}/discard",
        headers=owner.auth_header,
    )
    assert discard.status_code == 200, discard.text
    assert discard.json()["status"] == "discarded"

    discarded_after = await _file_state(db_connection, discarded_file["id"])
    assert discarded_after.status == "active"
    assert discarded_after.deleted_at is None
    assert discarded_after.storage_path == discarded_before.storage_path

    assert remove_calls == []
