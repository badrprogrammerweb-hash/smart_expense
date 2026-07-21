"""Full role-matrix test for AI extraction operations (SC-007): Viewer is
view-only everywhere; a Member may act (confirm/discard/edit) only on an
extraction they personally triggered; Owner/Admin may act on any extraction
in the workspace, regardless of who triggered it."""

import pytest

from app.services import ai_providers
from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nphase-eight-authorization"


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


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
    assert trigger.json()["status"] == "ready_for_review"
    return trigger.json()


async def _setup_workspace(api_client, signup_user, monkeypatch, prefix: str):
    owner = await signup_user(f"{prefix}-owner")
    admin = await signup_user(f"{prefix}-admin")
    member1 = await signup_user(f"{prefix}-member1")
    member2 = await signup_user(f"{prefix}-member2")
    viewer = await signup_user(f"{prefix}-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member1, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member2, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201
    await _configure_ai(api_client, owner, workspace_id)
    _stub_storage(monkeypatch)
    _stub_ready_extraction(monkeypatch)
    return workspace_id, owner, admin, member1, member2, viewer


async def test_viewer_can_view_everywhere_but_cannot_act_anywhere(
    api_client, signup_user, monkeypatch
) -> None:
    workspace_id, owner, admin, member1, member2, viewer = await _setup_workspace(
        api_client, signup_user, monkeypatch, "authz-viewer"
    )
    extraction = await _upload_and_trigger(api_client, member1, workspace_id, "viewer-view.pdf")
    extraction_id = extraction["id"]

    # Trigger: a Viewer cannot trigger extraction even on a file someone else
    # uploaded (Viewers cannot upload themselves either, but that is a Phase 6
    # concern already covered there -- this isolates the trigger-permission
    # check on an owner-uploaded file).
    owner_file = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=owner.auth_header,
        files={"file": ("viewer-trigger-2.pdf", PDF_BYTES, "application/pdf")},
    )
    assert owner_file.status_code == 201, owner_file.text
    viewer_trigger = await api_client.post(
        f"/workspaces/{workspace_id}/files/{owner_file.json()['id']}/extractions",
        headers=viewer.auth_header,
    )
    assert viewer_trigger.status_code == 403, viewer_trigger.text
    assert viewer_trigger.json()["error"]["code"] == "forbidden"

    # View: list + get both succeed, with the draft visible but can_edit /
    # can_discard both false (FR-010; Clarifications).
    list_response = await api_client.get(
        f"/workspaces/{workspace_id}/extractions", headers=viewer.auth_header
    )
    assert list_response.status_code == 200, list_response.text
    assert any(item["id"] == extraction_id for item in list_response.json())

    get_response = await api_client.get(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}", headers=viewer.auth_header
    )
    assert get_response.status_code == 200, get_response.text
    get_payload = get_response.json()
    assert get_payload["draft"] is not None
    assert get_payload["can_edit"] is False
    assert get_payload["can_discard"] is False

    # Act: confirm and discard both forbidden.
    confirm_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}/confirm",
        headers=viewer.auth_header,
        json={"amount_minor": 4250, "occurred_on": "2026-07-01"},
    )
    assert confirm_response.status_code == 403, confirm_response.text
    assert confirm_response.json()["error"]["code"] == "forbidden"

    discard_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}/discard",
        headers=viewer.auth_header,
    )
    assert discard_response.status_code == 403, discard_response.text
    assert discard_response.json()["error"]["code"] == "forbidden"


async def test_member_can_act_only_on_their_own_triggered_extraction(
    api_client, signup_user, monkeypatch
) -> None:
    workspace_id, owner, admin, member1, member2, viewer = await _setup_workspace(
        api_client, signup_user, monkeypatch, "authz-member"
    )

    # can_edit / can_discard as seen by the triggerer vs. a different Member.
    extraction = await _upload_and_trigger(api_client, member1, workspace_id, "member-own.pdf")
    extraction_id = extraction["id"]

    own_view = await api_client.get(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}", headers=member1.auth_header
    )
    assert own_view.status_code == 200, own_view.text
    assert own_view.json()["can_edit"] is True
    assert own_view.json()["can_discard"] is True

    other_view = await api_client.get(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}", headers=member2.auth_header
    )
    assert other_view.status_code == 200, other_view.text
    assert other_view.json()["can_edit"] is False
    assert other_view.json()["can_discard"] is False

    # Member2 cannot confirm or discard Member1's extraction.
    forbidden_confirm = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}/confirm",
        headers=member2.auth_header,
        json={"amount_minor": 4250, "occurred_on": "2026-07-01"},
    )
    assert forbidden_confirm.status_code == 403, forbidden_confirm.text

    forbidden_discard = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}/discard",
        headers=member2.auth_header,
    )
    assert forbidden_discard.status_code == 403, forbidden_discard.text

    # Member1 (the triggerer) can confirm their own.
    own_confirm = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{extraction_id}/confirm",
        headers=member1.auth_header,
        json={"amount_minor": 4250, "occurred_on": "2026-07-01"},
    )
    assert own_confirm.status_code == 200, own_confirm.text
    assert own_confirm.json()["status"] == "confirmed"

    # A second, separate own-triggered extraction: Member1 can discard it.
    second = await _upload_and_trigger(api_client, member1, workspace_id, "member-own-2.pdf")
    own_discard = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{second['id']}/discard",
        headers=member1.auth_header,
    )
    assert own_discard.status_code == 200, own_discard.text
    assert own_discard.json()["status"] == "discarded"


async def test_owner_and_admin_can_act_on_any_members_extraction(
    api_client, signup_user, monkeypatch
) -> None:
    workspace_id, owner, admin, member1, member2, viewer = await _setup_workspace(
        api_client, signup_user, monkeypatch, "authz-owner-admin"
    )

    owner_confirms = await _upload_and_trigger(api_client, member1, workspace_id, "owner-confirms.pdf")
    owner_confirm_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{owner_confirms['id']}/confirm",
        headers=owner.auth_header,
        json={"amount_minor": 5000, "occurred_on": "2026-07-02"},
    )
    assert owner_confirm_response.status_code == 200, owner_confirm_response.text
    assert owner_confirm_response.json()["status"] == "confirmed"

    admin_confirms = await _upload_and_trigger(api_client, member2, workspace_id, "admin-confirms.pdf")
    admin_confirm_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{admin_confirms['id']}/confirm",
        headers=admin.auth_header,
        json={"amount_minor": 6000, "occurred_on": "2026-07-03"},
    )
    assert admin_confirm_response.status_code == 200, admin_confirm_response.text
    assert admin_confirm_response.json()["status"] == "confirmed"

    owner_discards = await _upload_and_trigger(api_client, member1, workspace_id, "owner-discards.pdf")
    owner_discard_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{owner_discards['id']}/discard",
        headers=owner.auth_header,
    )
    assert owner_discard_response.status_code == 200, owner_discard_response.text
    assert owner_discard_response.json()["status"] == "discarded"

    admin_discards = await _upload_and_trigger(api_client, member2, workspace_id, "admin-discards.pdf")
    admin_discard_response = await api_client.post(
        f"/workspaces/{workspace_id}/extractions/{admin_discards['id']}/discard",
        headers=admin.auth_header,
    )
    assert admin_discard_response.status_code == 200, admin_discard_response.text
    assert admin_discard_response.json()["status"] == "discarded"

    # can_edit / can_discard for Owner and Admin on a still-active, other's
    # extraction are both true.
    active = await _upload_and_trigger(api_client, member1, workspace_id, "owner-admin-view.pdf")
    owner_view = await api_client.get(
        f"/workspaces/{workspace_id}/extractions/{active['id']}", headers=owner.auth_header
    )
    assert owner_view.json()["can_edit"] is True
    assert owner_view.json()["can_discard"] is True

    admin_view = await api_client.get(
        f"/workspaces/{workspace_id}/extractions/{active['id']}", headers=admin.auth_header
    )
    assert admin_view.json()["can_edit"] is True
    assert admin_view.json()["can_discard"] is True
