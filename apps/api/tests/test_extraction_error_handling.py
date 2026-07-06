"""Backend tests for Phase 6 (US4): every provider/file failure mode must
produce a safe, classified `failed` extraction, never touch the source file,
never leak raw provider content or the API key, and always allow a
subsequent retry (research.md Decision 6; FR-019-FR-022; SC-005)."""

import logging

import httpx
import pytest

from app.services import storage
from conftest import create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nphase-six-error-handling"
RAW_PROVIDER_SECRET = "raw-provider-internal-detail-do-not-leak"


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


async def _trigger(api_client, user, workspace_id: str, file_id: str):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files/{file_id}/extractions",
        headers=user.auth_header,
    )


async def _file_state(db_connection, file_id: str):
    from sqlalchemy import text

    return (
        await db_connection.execute(
            text(
                "select status, expense_id, storage_path from public.files where id = :file_id"
            ),
            {"file_id": file_id},
        )
    ).one()


def _stub_get_object(monkeypatch, content: bytes = PDF_BYTES) -> None:
    async def get_object(key: str) -> bytes:
        return content

    monkeypatch.setattr("app.services.storage.get_object", get_object)


def _patch_provider_transport(monkeypatch, handler) -> None:
    """Route ai_providers' internal `httpx.AsyncClient(...)` calls through a
    `MockTransport` so the *real* `_extract_gemini`/`_extract_openai`
    classification logic runs against a canned HTTP response -- no live
    network call is made, and this is the exact hardened logic T028 covers."""
    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def patched_async_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", patched_async_client)


def _stub_successful_retry(monkeypatch) -> None:
    """Used only to prove a subsequent trigger succeeds after a failure --
    the classification path itself was already exercised by the failing
    trigger earlier in the same test."""
    from app.services import ai_providers

    async def extract_receipt(provider, api_key, file_bytes, content_type):
        return ai_providers.ExtractedFields(amount_minor=1000)

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)


async def _assert_file_unchanged(db_connection, file_id: str, before) -> None:
    after = await _file_state(db_connection, file_id)
    assert after.status == "active"
    assert after.expense_id is None
    assert after.storage_path == before.storage_path


def _assert_no_leak(response, caplog, *secrets: str) -> None:
    captured_logs = "\n".join(record.getMessage() for record in caplog.records)
    for secret in secrets:
        assert secret not in response.text
        assert secret not in captured_logs


@pytest.mark.parametrize(
    ("status_code", "expected_reason"),
    [(401, "invalid_key"), (403, "invalid_key"), (429, "rate_limited")],
)
async def test_provider_http_status_maps_to_classified_failure_reason(
    api_client, signup_user, db_connection, monkeypatch, caplog, status_code, expected_reason
) -> None:
    caplog.set_level(logging.WARNING)
    owner = await signup_user(f"extract-error-http-{status_code}")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    _stub_get_object(monkeypatch)

    # Upload before patching the transport: `httpx.AsyncClient` is patched
    # globally (ai_providers constructs its client inline), and the upload's
    # own storage.put_object call must not be routed through the fake
    # provider transport.
    file = await _upload_file(api_client, owner, workspace_id, f"error-{status_code}.pdf")
    before = await _file_state(db_connection, file["id"])

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json={"error": {"message": RAW_PROVIDER_SECRET}})

    _patch_provider_transport(monkeypatch, handler)

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["failure_reason"] == expected_reason
    assert payload["draft"] is None

    await _assert_file_unchanged(db_connection, file["id"], before)
    _assert_no_leak(response, caplog, RAW_PROVIDER_SECRET, OPENAI_KEY)

    _stub_successful_retry(monkeypatch)
    retry = await _trigger(api_client, owner, workspace_id, file["id"])
    assert retry.status_code == 200, retry.text
    assert retry.json()["status"] == "ready_for_review"


async def test_provider_timeout_or_connection_error_maps_to_timeout_reason(
    api_client, signup_user, db_connection, monkeypatch, caplog
) -> None:
    caplog.set_level(logging.WARNING)
    owner = await signup_user("extract-error-timeout")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    _stub_get_object(monkeypatch)

    file = await _upload_file(api_client, owner, workspace_id, "error-timeout.pdf")
    before = await _file_state(db_connection, file["id"])

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("simulated provider timeout", request=request)

    _patch_provider_transport(monkeypatch, handler)

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["failure_reason"] == "timeout"
    assert payload["draft"] is None

    await _assert_file_unchanged(db_connection, file["id"], before)
    _assert_no_leak(response, caplog, OPENAI_KEY)

    _stub_successful_retry(monkeypatch)
    retry = await _trigger(api_client, owner, workspace_id, file["id"])
    assert retry.status_code == 200, retry.text
    assert retry.json()["status"] == "ready_for_review"


async def test_unreadable_file_bytes_maps_to_unreadable_file_reason(
    api_client, signup_user, db_connection, monkeypatch, caplog
) -> None:
    caplog.set_level(logging.WARNING)
    owner = await signup_user("extract-error-unreadable")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)

    async def broken_get_object(key: str) -> bytes:
        raise storage.StorageError("simulated storage read failure")

    monkeypatch.setattr("app.services.storage.get_object", broken_get_object)

    provider_calls: list[object] = []

    async def extract_receipt(provider, api_key, file_bytes, content_type):
        provider_calls.append(provider)
        raise AssertionError("the provider must never be called when the file is unreadable")

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)

    file = await _upload_file(api_client, owner, workspace_id, "error-unreadable.pdf")
    before = await _file_state(db_connection, file["id"])

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "failed"
    assert payload["failure_reason"] == "unreadable_file"
    assert payload["draft"] is None
    assert provider_calls == []

    await _assert_file_unchanged(db_connection, file["id"], before)
    _assert_no_leak(response, caplog, OPENAI_KEY)

    _stub_get_object(monkeypatch)
    _stub_successful_retry(monkeypatch)
    retry = await _trigger(api_client, owner, workspace_id, file["id"])
    assert retry.status_code == 200, retry.text
    assert retry.json()["status"] == "ready_for_review"


async def test_malformed_provider_response_maps_to_malformed_response_reason(
    api_client, signup_user, db_connection, monkeypatch, caplog
) -> None:
    caplog.set_level(logging.WARNING)
    owner = await signup_user("extract-error-malformed")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    _stub_get_object(monkeypatch)

    # Upload both files before any provider-transport patch is applied, since
    # the patch is global and would otherwise intercept the uploads' own
    # storage.put_object call too.
    non_json_file = await _upload_file(api_client, owner, workspace_id, "error-non-json.pdf")
    non_json_before = await _file_state(db_connection, non_json_file["id"])
    mismatch_file = await _upload_file(api_client, owner, workspace_id, "error-schema.pdf")
    mismatch_before = await _file_state(db_connection, mismatch_file["id"])

    # Sub-case 1: the response body is not even valid JSON.
    def non_json_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=f"not json at all: {RAW_PROVIDER_SECRET}")

    _patch_provider_transport(monkeypatch, non_json_handler)

    non_json_response = await _trigger(api_client, owner, workspace_id, non_json_file["id"])
    assert non_json_response.status_code == 200, non_json_response.text
    non_json_payload = non_json_response.json()
    assert non_json_payload["status"] == "failed"
    assert non_json_payload["failure_reason"] == "malformed_response"
    await _assert_file_unchanged(db_connection, non_json_file["id"], non_json_before)
    _assert_no_leak(non_json_response, caplog, RAW_PROVIDER_SECRET, OPENAI_KEY)

    # Sub-case 2: valid JSON envelope, but the inner content does not match
    # the expected schema (research.md Decision 5: never partially trusted).
    def schema_mismatch_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"amount_minor": "not-a-number"}'}}]},
        )

    _patch_provider_transport(monkeypatch, schema_mismatch_handler)

    mismatch_response = await _trigger(api_client, owner, workspace_id, mismatch_file["id"])
    assert mismatch_response.status_code == 200, mismatch_response.text
    mismatch_payload = mismatch_response.json()
    assert mismatch_payload["status"] == "failed"
    assert mismatch_payload["failure_reason"] == "malformed_response"
    await _assert_file_unchanged(db_connection, mismatch_file["id"], mismatch_before)
    _assert_no_leak(mismatch_response, caplog, OPENAI_KEY)

    _stub_successful_retry(monkeypatch)
    retry = await _trigger(api_client, owner, workspace_id, non_json_file["id"])
    assert retry.status_code == 200, retry.text
    assert retry.json()["status"] == "ready_for_review"
