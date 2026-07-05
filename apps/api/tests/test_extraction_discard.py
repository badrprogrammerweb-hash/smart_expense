import pytest
from sqlalchemy import text

from app.schemas.extractions import FailureReason
from app.services import ai_providers
from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nphase-five-discard"


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


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
    async def extract_receipt(provider, api_key, file_bytes, content_type):
        return ai_providers.ExtractedFields(
            amount_minor=amount_minor,
            currency="SAR",
            occurred_on="2026-07-01",
            vendor_name="Panda Hypermarket",
            suggested_category="Groceries",
        )

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)


def _stub_failed_extraction(monkeypatch) -> None:
    async def extract_receipt(provider, api_key, file_bytes, content_type):
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
                select status, expense_id, storage_path
                from public.files
                where id = :file_id
                """
            ),
            {"file_id": file_id},
        )
    ).one()


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


async def _assert_file_unchanged_and_unlinked(db_connection, file_id: str, before) -> None:
    after = await _file_state(db_connection, file_id)
    assert after.status == "active"
    assert after.expense_id is None
    assert after.storage_path == before.storage_path


async def test_discard_ready_and_failed_by_triggering_member_leaves_file_and_allows_retrigger(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-discard-member-owner")
    member = await signup_user("extract-discard-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    remove_calls = _stub_storage(monkeypatch)

    _stub_ready_extraction(monkeypatch)
    ready_file = await _upload_file(api_client, member, workspace_id, "member-ready.pdf")
    ready_before = await _file_state(db_connection, ready_file["id"])
    ready = await _trigger_extraction(api_client, member, workspace_id, ready_file["id"])
    assert ready["status"] == "ready_for_review"

    ready_discard = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{ready['id']}/discard",
        headers=member.auth_header,
    )
    assert ready_discard.status_code == 200, ready_discard.text
    ready_payload = ready_discard.json()
    assert ready_payload["status"] == "discarded"
    assert ready_payload["discarded_by"] == member.user_id
    assert ready_payload["expense_id"] is None
    assert ready_payload["can_discard"] is False
    await _assert_file_unchanged_and_unlinked(db_connection, ready_file["id"], ready_before)

    _stub_failed_extraction(monkeypatch)
    failed_file = await _upload_file(api_client, member, workspace_id, "member-failed.pdf")
    failed_before = await _file_state(db_connection, failed_file["id"])
    failed = await _trigger_extraction(api_client, member, workspace_id, failed_file["id"])
    assert failed["status"] == "failed"

    failed_discard = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{failed['id']}/discard",
        headers=member.auth_header,
    )
    assert failed_discard.status_code == 200, failed_discard.text
    failed_payload = failed_discard.json()
    assert failed_payload["status"] == "discarded"
    assert failed_payload["failure_reason"] is None
    await _assert_file_unchanged_and_unlinked(db_connection, failed_file["id"], failed_before)

    _stub_ready_extraction(monkeypatch, amount_minor=9900)
    ready_retry = await _trigger_extraction(api_client, member, workspace_id, ready_file["id"])
    failed_retry = await _trigger_extraction(api_client, member, workspace_id, failed_file["id"])
    assert ready_retry["status"] == "ready_for_review"
    assert failed_retry["status"] == "ready_for_review"
    assert await _expense_count(db_connection, workspace_id) == 0
    assert remove_calls == []


async def test_discard_by_owner_and_admin_on_member_extractions(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-discard-owner")
    admin = await signup_user("extract-discard-admin")
    member = await signup_user("extract-discard-owner-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    remove_calls = _stub_storage(monkeypatch)

    _stub_ready_extraction(monkeypatch)
    ready_file = await _upload_file(api_client, member, workspace_id, "admin-ready.pdf")
    ready_before = await _file_state(db_connection, ready_file["id"])
    ready = await _trigger_extraction(api_client, member, workspace_id, ready_file["id"])
    admin_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{ready['id']}/discard",
        headers=admin.auth_header,
    )
    assert admin_response.status_code == 200, admin_response.text
    assert admin_response.json()["status"] == "discarded"
    await _assert_file_unchanged_and_unlinked(db_connection, ready_file["id"], ready_before)

    _stub_failed_extraction(monkeypatch)
    failed_file = await _upload_file(api_client, member, workspace_id, "owner-failed.pdf")
    failed_before = await _file_state(db_connection, failed_file["id"])
    failed = await _trigger_extraction(api_client, member, workspace_id, failed_file["id"])
    owner_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{failed['id']}/discard",
        headers=owner.auth_header,
    )
    assert owner_response.status_code == 200, owner_response.text
    owner_payload = owner_response.json()
    assert owner_payload["status"] == "discarded"
    assert owner_payload["failure_reason"] is None
    await _assert_file_unchanged_and_unlinked(db_connection, failed_file["id"], failed_before)

    _stub_ready_extraction(monkeypatch, amount_minor=5800)
    assert (await _trigger_extraction(api_client, member, workspace_id, ready_file["id"]))[
        "status"
    ] == "ready_for_review"
    assert (await _trigger_extraction(api_client, member, workspace_id, failed_file["id"]))[
        "status"
    ] == "ready_for_review"
    assert await _expense_count(db_connection, workspace_id) == 0
    assert remove_calls == []


async def test_discard_rejects_non_triggering_member_viewer_and_already_resolved(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-discard-rules-owner")
    member = await signup_user("extract-discard-rules-member")
    other_member = await signup_user("extract-discard-rules-other")
    viewer = await signup_user("extract-discard-rules-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (
        await add_member(api_client, owner, workspace_id, other_member, "member")
    ).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)
    _stub_ready_extraction(monkeypatch)

    file = await _upload_file(api_client, member, workspace_id, "forbidden.pdf")
    extraction = await _trigger_extraction(api_client, member, workspace_id, file["id"])

    other_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/discard",
        headers=other_member.auth_header,
    )
    assert other_response.status_code == 403, other_response.text
    assert other_response.json()["error"]["code"] == "forbidden"

    viewer_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/discard",
        headers=viewer.auth_header,
    )
    assert viewer_response.status_code == 403, viewer_response.text
    assert viewer_response.json()["error"]["code"] == "forbidden"

    member_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/discard",
        headers=member.auth_header,
    )
    assert member_response.status_code == 200, member_response.text

    duplicate_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction['id']}/discard",
        headers=member.auth_header,
    )
    assert duplicate_response.status_code == 409, duplicate_response.text
    assert duplicate_response.json()["error"]["code"] == "already_resolved"
    assert await _expense_count(db_connection, workspace_id) == 0
