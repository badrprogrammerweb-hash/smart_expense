from uuid import uuid4

import pytest

from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

PDF_BYTES = b"%PDF-1.7\nworkspace-a-receipt"


async def _upload_file(api_client, caller, workspace_id: str):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=caller.auth_header,
        files={"file": ("receipt.pdf", PDF_BYTES, "application/pdf")},
    )


async def test_file_operations_return_not_found_for_another_workspace_file(
    api_client, signup_user, monkeypatch
) -> None:
    source_owner = await signup_user("files-isolation-source-owner")
    target_owner = await signup_user("files-isolation-target-owner")
    target_admin = await signup_user("files-isolation-target-admin")
    target_member = await signup_user("files-isolation-target-member")
    target_viewer = await signup_user("files-isolation-target-viewer")

    source_workspace = await create_team_workspace(api_client, source_owner, "Source Files")
    target_workspace = await create_team_workspace(api_client, target_owner, "Target Files")
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

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    sign_calls: list[str] = []

    async def sign_url(key: str, ttl: int = 300):
        sign_calls.append(key)
        raise AssertionError("Cross-workspace requests must not sign storage URLs.")

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.sign_url", sign_url)

    upload_response = await _upload_file(api_client, source_owner, source_workspace_id)
    assert upload_response.status_code == 201, upload_response.text
    source_file_id = upload_response.json()["id"]

    callers = [target_owner, target_admin, target_member, target_viewer]
    for caller in callers:
        source_list = await api_client.get(
            f"/workspaces/{source_workspace_id}/files",
            headers=caller.auth_header,
        )
        assert source_list.status_code == 404, source_list.text

        metadata = await api_client.get(
            f"/workspaces/{target_workspace_id}/files/{source_file_id}",
            headers=caller.auth_header,
        )
        assert metadata.status_code == 404, metadata.text

        download = await api_client.get(
            f"/workspaces/{target_workspace_id}/files/{source_file_id}/download-url",
            headers=caller.auth_header,
        )
        assert download.status_code == 404, download.text

        link = await api_client.post(
            f"/workspaces/{target_workspace_id}/files/{source_file_id}/link",
            headers=caller.auth_header,
            json={"expense_id": str(uuid4())},
        )
        assert link.status_code == 404, link.text

        delete = await api_client.delete(
            f"/workspaces/{target_workspace_id}/files/{source_file_id}",
            headers=caller.auth_header,
        )
        assert delete.status_code == 404, delete.text

    assert sign_calls == []
