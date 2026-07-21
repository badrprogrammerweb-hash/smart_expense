"""Dedicated key-secrecy test (constitution VI/XIV NON-NEGOTIABLE).

The decrypted BYOK key must never appear in any trigger/confirm/discard
response, error, or captured log line, and
`get_workspace_ai_key_for_extraction` must be the only database function that
ever reads `vault.decrypted_secrets` (research.md Decisions 1-3). This
mirrors the same non-negotiable treatment Phase 7 gave
`test_ai_settings_secrecy.py`.
"""

import logging

import pytest
from sqlalchemy import text

from app.schemas.extractions import FailureReason
from app.services import ai_providers
from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nphase-eight-secrecy"


def _assert_key_not_exposed(raw_key: str, body: str) -> None:
    assert raw_key not in body
    assert raw_key[:-4] not in body
    assert raw_key[:8] not in body


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text
    _assert_key_not_exposed(OPENAI_KEY, response.text)


async def _upload_file(api_client, user, workspace_id: str, filename: str) -> dict:
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

    async def remove_object(key: str) -> None:
        return None

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.get_object", get_object)
    monkeypatch.setattr("app.services.storage.remove_object", remove_object)


def _stub_extract_receipt(monkeypatch, outcome, captured_keys: list[str]) -> None:
    async def extract_receipt(provider, api_key, file_bytes, content_type, category_names=None):
        # The real ai_providers.extract_receipt receives the decrypted key as
        # a plain argument (never logged) -- capture it here only to prove
        # the *route/service layer* never re-surfaces it anywhere, not to
        # assert anything about this stub itself.
        captured_keys.append(api_key)
        return outcome

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)


async def test_key_never_appears_in_trigger_confirm_or_discard_responses_or_logs(
    api_client, signup_user, db_connection, monkeypatch, caplog
) -> None:
    # DEBUG, not WARNING: this is a regression guard against a future
    # logger.debug/info leak, not just today's code path.
    caplog.set_level(logging.DEBUG)
    owner = await signup_user("extract-secrecy-owner")
    member = await signup_user("extract-secrecy-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)

    captured_keys: list[str] = []
    _stub_extract_receipt(
        monkeypatch,
        ai_providers.ExtractedFields(
            amount_minor=4250,
            currency="SAR",
            occurred_on="2026-07-01",
            vendor_name="Panda Hypermarket",
            suggested_category="Groceries",
        ),
        captured_keys,
    )

    # Trigger (ready_for_review path).
    file = await _upload_file(api_client, member, workspace_id, "secrecy-ready.pdf")
    trigger_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file['id']}/extractions",
        headers=member.auth_header,
    )
    assert trigger_response.status_code == 200, trigger_response.text
    assert trigger_response.json()["status"] == "ready_for_review"
    _assert_key_not_exposed(OPENAI_KEY, trigger_response.text)

    # The service layer did pass the real decrypted key to the provider call
    # (proving the RPC round-trip actually happened)...
    assert captured_keys == [OPENAI_KEY]
    # ...but never let it leak back out through the response or logs.
    captured_logs = "\n".join(record.getMessage() for record in caplog.records)
    assert OPENAI_KEY not in captured_logs
    assert OPENAI_KEY[:-4] not in captured_logs

    # Confirm.
    extraction_id = trigger_response.json()["id"]
    confirm_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}/confirm",
        headers=member.auth_header,
        json={"amount_minor": 4250, "occurred_on": "2026-07-01"},
    )
    assert confirm_response.status_code == 200, confirm_response.text
    assert confirm_response.json()["status"] == "confirmed"
    _assert_key_not_exposed(OPENAI_KEY, confirm_response.text)

    # Trigger + discard (ready_for_review -> discarded path).
    discard_file = await _upload_file(api_client, member, workspace_id, "secrecy-discard.pdf")
    discard_trigger = await api_client.post(
        f"/workspaces/{workspace_id}/files/{discard_file['id']}/extractions",
        headers=member.auth_header,
    )
    assert discard_trigger.status_code == 200, discard_trigger.text
    _assert_key_not_exposed(OPENAI_KEY, discard_trigger.text)

    discard_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{discard_trigger.json()['id']}/discard",
        headers=member.auth_header,
    )
    assert discard_response.status_code == 200, discard_response.text
    assert discard_response.json()["status"] == "discarded"
    _assert_key_not_exposed(OPENAI_KEY, discard_response.text)

    # Trigger that fails at the provider call -- the classified failure_reason
    # is safe to return, but the raw key must still never appear anywhere.
    _stub_extract_receipt(
        monkeypatch, ai_providers.ExtractionFailure(failure_reason=FailureReason.INVALID_KEY), []
    )
    failed_file = await _upload_file(api_client, member, workspace_id, "secrecy-failed.pdf")
    failed_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{failed_file['id']}/extractions",
        headers=member.auth_header,
    )
    assert failed_response.status_code == 200, failed_response.text
    assert failed_response.json()["status"] == "failed"
    _assert_key_not_exposed(OPENAI_KEY, failed_response.text)

    # GET list/get must not expose it either.
    list_response = await api_client.get(
        f"/workspaces/{workspace_id}/extractions", headers=member.auth_header
    )
    assert list_response.status_code == 200, list_response.text
    _assert_key_not_exposed(OPENAI_KEY, list_response.text)

    get_response = await api_client.get(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}", headers=member.auth_header
    )
    assert get_response.status_code == 200, get_response.text
    _assert_key_not_exposed(OPENAI_KEY, get_response.text)

    final_logs = "\n".join(record.getMessage() for record in caplog.records)
    assert OPENAI_KEY not in final_logs
    assert OPENAI_KEY[:-4] not in final_logs


async def test_forbidden_key_read_attempt_never_exposes_the_key_either(
    api_client, signup_user, db_connection, monkeypatch, caplog
) -> None:
    """A Viewer can never reach the trigger endpoint (403 before any key read
    occurs), but assert this explicitly rather than assuming it -- a
    regression here would be a Viewer's 403 response somehow still leaking
    a key that should never have been read for them in the first place."""
    caplog.set_level(logging.DEBUG)
    owner = await signup_user("extract-secrecy-viewer-owner")
    viewer = await signup_user("extract-secrecy-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)

    captured_keys: list[str] = []
    _stub_extract_receipt(monkeypatch, ai_providers.ExtractedFields(amount_minor=100), captured_keys)

    file = await _upload_file(api_client, owner, workspace_id, "secrecy-viewer.pdf")
    response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file['id']}/extractions",
        headers=viewer.auth_header,
    )
    assert response.status_code == 403, response.text
    _assert_key_not_exposed(OPENAI_KEY, response.text)
    assert captured_keys == []

    captured_logs = "\n".join(record.getMessage() for record in caplog.records)
    assert OPENAI_KEY not in captured_logs


async def test_only_key_read_rpc_function_ever_queries_vault_decrypted_secrets(
    db_connection,
) -> None:
    result = await db_connection.execute(
        text(
            """
            select p.proname
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.prokind = 'f'
              and pg_get_functiondef(p.oid) ilike '%vault.decrypted_secrets%'
            """
        )
    )
    names = {row.proname for row in result}
    assert names == {"get_workspace_ai_key_for_extraction"}
