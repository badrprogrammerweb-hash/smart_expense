import pytest

from app.services.storage import SignedUrl
from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

PDF_BYTES = b"%PDF-1.7\nprivate-receipt"


async def _upload_file(api_client, caller, workspace_id: str, filename: str = "receipt.pdf"):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=caller.auth_header,
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )


async def test_members_can_list_and_get_short_lived_download_url(
    api_client, signup_user, monkeypatch
) -> None:
    owner = await signup_user("files-privacy-owner")
    viewer = await signup_user("files-privacy-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    stored_keys: list[str] = []
    signed_keys: list[tuple[str, int]] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        stored_keys.append(key)

    async def sign_url(key: str, ttl: int = 300) -> SignedUrl:
        signed_keys.append((key, ttl))
        return SignedUrl(url="https://storage.example/signed/receipt.pdf", expires_in=ttl)

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.sign_url", sign_url)

    upload_response = await _upload_file(api_client, owner, workspace_id)
    assert upload_response.status_code == 201, upload_response.text
    file_id = upload_response.json()["id"]
    assert stored_keys == [f"{workspace_id}/{file_id}"]

    list_response = await api_client.get(
        f"/workspaces/{workspace_id}/files",
        headers=viewer.auth_header,
    )
    assert list_response.status_code == 200, list_response.text
    files = list_response.json()["files"]
    assert [file["id"] for file in files] == [file_id]
    assert files[0]["status"] == "active"

    download_response = await api_client.get(
        f"/workspaces/{workspace_id}/files/{file_id}/download-url",
        headers=viewer.auth_header,
    )
    assert download_response.status_code == 200, download_response.text
    payload = download_response.json()
    assert payload["url"] == "https://storage.example/signed/receipt.pdf"
    assert payload["expires_in"] <= 300
    assert signed_keys == [(f"{workspace_id}/{file_id}", 300)]


async def test_non_member_and_anonymous_callers_do_not_receive_private_access(
    api_client, signup_user, monkeypatch
) -> None:
    owner = await signup_user("files-privacy-deny-owner")
    outsider = await signup_user("files-privacy-outsider")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    sign_calls: list[str] = []

    async def sign_url(key: str, ttl: int = 300) -> SignedUrl:
        sign_calls.append(key)
        return SignedUrl(url="https://storage.example/should-not-issue", expires_in=ttl)

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.sign_url", sign_url)

    upload_response = await _upload_file(api_client, owner, workspace_id)
    assert upload_response.status_code == 201, upload_response.text
    file_id = upload_response.json()["id"]

    non_member_list = await api_client.get(
        f"/workspaces/{workspace_id}/files",
        headers=outsider.auth_header,
    )
    assert non_member_list.status_code == 404, non_member_list.text

    non_member_download = await api_client.get(
        f"/workspaces/{workspace_id}/files/{file_id}/download-url",
        headers=outsider.auth_header,
    )
    assert non_member_download.status_code == 404, non_member_download.text

    anonymous_list = await api_client.get(f"/workspaces/{workspace_id}/files")
    assert anonymous_list.status_code == 401, anonymous_list.text

    anonymous_download = await api_client.get(
        f"/workspaces/{workspace_id}/files/{file_id}/download-url",
    )
    assert anonymous_download.status_code == 401, anonymous_download.text

    assert sign_calls == []
