"""Tenant isolation test (SC-008): every extraction endpoint returns 404 for
a workspace/file/extraction the caller is not a member of (existence never
leaked), and anonymous requests are rejected with 401."""

from uuid import uuid4

import pytest

from app.services import ai_providers
from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nphase-eight-isolation"


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


def _stub_storage_and_provider(monkeypatch) -> None:
    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def get_object(key: str) -> bytes:
        return PDF_BYTES

    async def extract_receipt(provider, api_key, file_bytes, content_type, category_names=None):
        return ai_providers.ExtractedFields(amount_minor=4250, occurred_on="2026-07-01")

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.get_object", get_object)
    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)


async def _upload_and_trigger(api_client, actor, workspace_id: str, filename: str) -> dict:
    upload = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=actor.auth_header,
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )
    assert upload.status_code == 201, upload.text
    trigger = await api_client.post(
        f"/workspaces/{workspace_id}/files/{upload.json()['id']}/extractions",
        headers=actor.auth_header,
    )
    assert trigger.status_code == 200, trigger.text
    return {"file": upload.json(), "extraction": trigger.json()}


async def test_cross_workspace_requests_return_not_found_for_every_role(
    api_client, signup_user, monkeypatch
) -> None:
    source_owner = await signup_user("extract-isolation-source-owner")
    target_owner = await signup_user("extract-isolation-target-owner")
    target_admin = await signup_user("extract-isolation-target-admin")
    target_member = await signup_user("extract-isolation-target-member")
    target_viewer = await signup_user("extract-isolation-target-viewer")

    source_workspace = await create_team_workspace(api_client, source_owner, "Isolation Source")
    target_workspace = await create_team_workspace(api_client, target_owner, "Isolation Target")
    source_workspace_id = source_workspace["id"]
    target_workspace_id = target_workspace["id"]

    assert (
        await add_member(api_client, target_owner, target_workspace_id, target_admin, "admin")
    ).status_code == 201
    assert (
        await add_member(api_client, target_owner, target_workspace_id, target_member, "member")
    ).status_code == 201
    assert (
        await add_member(api_client, target_owner, target_workspace_id, target_viewer, "viewer")
    ).status_code == 201

    await _configure_ai(api_client, source_owner, source_workspace_id)
    _stub_storage_and_provider(monkeypatch)

    produced = await _upload_and_trigger(
        api_client, source_owner, source_workspace_id, "isolation-source.pdf"
    )
    source_file_id = produced["file"]["id"]
    source_extraction_id = produced["extraction"]["id"]

    callers = [
        (target_owner, "owner"),
        (target_admin, "admin"),
        (target_member, "member"),
        (target_viewer, "viewer"),
    ]
    for caller, role in callers:
        # Case A: caller is not a member of the source workspace at all.
        trigger = await api_client.post(
            f"/workspaces/{source_workspace_id}/files/{source_file_id}/extractions",
            headers=caller.auth_header,
        )
        assert trigger.status_code == 404, trigger.text

        listing = await api_client.get(
            f"/workspaces/{source_workspace_id}/extractions", headers=caller.auth_header
        )
        assert listing.status_code == 404, listing.text

        get_one = await api_client.get(
            f"/workspaces/{source_workspace_id}/extractions/{source_extraction_id}",
            headers=caller.auth_header,
        )
        assert get_one.status_code == 404, get_one.text

        confirm = await api_client.post(
            f"/workspaces/{source_workspace_id}/extractions/{source_extraction_id}/confirm",
            headers=caller.auth_header,
            json={"amount_minor": 4250, "occurred_on": "2026-07-01"},
        )
        assert confirm.status_code == 404, confirm.text

        discard = await api_client.post(
            f"/workspaces/{source_workspace_id}/extractions/{source_extraction_id}/discard",
            headers=caller.auth_header,
        )
        assert discard.status_code == 404, discard.text

        # Case B: caller IS a member of the workspace in the URL, but the
        # file/extraction id in the path belongs to the other workspace. A
        # Viewer is rejected at the role gate (403) before the file lookup
        # ever runs (FR-005); every other role reaches the lookup and gets
        # 404 for a file that doesn't belong to this workspace.
        cross_trigger = await api_client.post(
            f"/workspaces/{target_workspace_id}/files/{source_file_id}/extractions",
            headers=caller.auth_header,
        )
        expected_cross_trigger_status = 403 if role == "viewer" else 404
        assert cross_trigger.status_code == expected_cross_trigger_status, cross_trigger.text

        cross_get = await api_client.get(
            f"/workspaces/{target_workspace_id}/extractions/{source_extraction_id}",
            headers=caller.auth_header,
        )
        assert cross_get.status_code == 404, cross_get.text

        cross_confirm = await api_client.post(
            f"/workspaces/{target_workspace_id}/extractions/{source_extraction_id}/confirm",
            headers=caller.auth_header,
            json={"amount_minor": 4250, "occurred_on": "2026-07-01"},
        )
        assert cross_confirm.status_code == 404, cross_confirm.text

        cross_discard = await api_client.post(
            f"/workspaces/{target_workspace_id}/extractions/{source_extraction_id}/discard",
            headers=caller.auth_header,
        )
        assert cross_discard.status_code == 404, cross_discard.text

    # The source extraction is untouched by any of the above.
    still_source = await api_client.get(
        f"/workspaces/{source_workspace_id}/extractions/{source_extraction_id}",
        headers=source_owner.auth_header,
    )
    assert still_source.status_code == 200, still_source.text
    assert still_source.json()["status"] == "ready_for_review"


async def test_anonymous_requests_are_rejected_with_401(api_client) -> None:
    workspace_id = str(uuid4())
    file_id = str(uuid4())
    extraction_id = str(uuid4())

    trigger = await api_client.post(f"/workspaces/{workspace_id}/files/{file_id}/extractions")
    assert trigger.status_code == 401, trigger.text

    listing = await api_client.get(f"/workspaces/{workspace_id}/extractions")
    assert listing.status_code == 401, listing.text

    get_one = await api_client.get(f"/workspaces/{workspace_id}/extractions/{extraction_id}")
    assert get_one.status_code == 401, get_one.text

    confirm = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}/confirm",
        json={"amount_minor": 100, "occurred_on": "2026-07-01"},
    )
    assert confirm.status_code == 401, confirm.text

    discard = await api_client.post(f"/workspaces/{workspace_id}/extractions/{extraction_id}/discard")
    assert discard.status_code == 401, discard.text
