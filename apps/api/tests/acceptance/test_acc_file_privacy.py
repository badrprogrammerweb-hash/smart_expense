from __future__ import annotations

import pytest
from sqlalchemy import text

from app.services.storage import SignedUrl
from conftest import requires_supabase


pytestmark = [pytest.mark.acceptance, pytest.mark.asyncio, requires_supabase]

PDF_BYTES = b"%PDF-1.7\nphase-ten-private-file"
FORBIDDEN_METADATA_KEYS = {"url", "public_url", "publicUrl", "storage_path"}


def _assert_status(response, expected: int) -> None:
    assert response.status_code == expected, response.text


def _assert_private_metadata(payload: dict) -> None:
    assert FORBIDDEN_METADATA_KEYS.isdisjoint(payload)
    assert all("/storage/v1/object/" not in str(value) for value in payload.values())


async def _upload(api_client, owner, workspace_id: str, filename: str = "private.pdf"):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=owner.auth_header,
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )


async def test_files_private_no_public_url(
    api_client, acceptance_world, db_connection, monkeypatch
) -> None:
    workspace_id = acceptance_world.workspace_a.id
    owner = acceptance_world.user_for_role("owner")
    stored_keys: list[str] = []
    signed_keys: list[tuple[str, int]] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        stored_keys.append(key)

    async def sign_url(key: str, ttl: int = 300) -> SignedUrl:
        signed_keys.append((key, ttl))
        return SignedUrl(
            url=f"https://storage.example/storage/v1/object/sign/receipts/{key}?token=short-lived",
            expires_in=ttl,
        )

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.sign_url", sign_url)

    bucket_public = (
        await db_connection.execute(
            text("select public from storage.buckets where id = 'receipts'")
        )
    ).scalar_one()
    assert bucket_public is False

    upload = await _upload(api_client, owner, workspace_id)
    _assert_status(upload, 201)
    metadata = upload.json()
    file_id = metadata["id"]
    storage_key = f"{workspace_id}/{file_id}"
    assert stored_keys == [storage_key]
    _assert_private_metadata(metadata)

    listing = await api_client.get(
        f"/workspaces/{workspace_id}/files", headers=owner.auth_header
    )
    _assert_status(listing, 200)
    listed = next(item for item in listing.json()["files"] if item["id"] == file_id)
    _assert_private_metadata(listed)

    detail = await api_client.get(
        f"/workspaces/{workspace_id}/files/{file_id}", headers=owner.auth_header
    )
    _assert_status(detail, 200)
    _assert_private_metadata(detail.json())

    download = await api_client.get(
        f"/workspaces/{workspace_id}/files/{file_id}/download-url",
        headers=owner.auth_header,
    )
    _assert_status(download, 200)
    signed_payload = download.json()
    assert "/storage/v1/object/sign/receipts/" in signed_payload["url"]
    assert "/storage/v1/object/public/" not in signed_payload["url"]
    assert signed_payload["expires_in"] <= 300
    assert signed_keys == [(storage_key, 300)]


async def test_file_access_scoped_to_membership(
    api_client, acceptance_world, monkeypatch
) -> None:
    workspace_id = acceptance_world.workspace_a.id
    owner = acceptance_world.user_for_role("owner")
    outsider = acceptance_world.workspace_b.owner
    sign_calls: list[str] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def sign_url(key: str, ttl: int = 300) -> SignedUrl:
        sign_calls.append(key)
        return SignedUrl(
            url=f"https://storage.example/storage/v1/object/sign/receipts/{key}?token=member-only",
            expires_in=ttl,
        )

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.sign_url", sign_url)

    upload = await _upload(api_client, owner, workspace_id, "membership-scoped.pdf")
    _assert_status(upload, 201)
    file_id = upload.json()["id"]
    storage_key = f"{workspace_id}/{file_id}"

    for role, member in acceptance_world.roles.items():
        listing = await api_client.get(
            f"/workspaces/{workspace_id}/files", headers=member.auth_header
        )
        detail = await api_client.get(
            f"/workspaces/{workspace_id}/files/{file_id}", headers=member.auth_header
        )
        download = await api_client.get(
            f"/workspaces/{workspace_id}/files/{file_id}/download-url",
            headers=member.auth_header,
        )

        _assert_status(listing, 200)
        _assert_status(detail, 200)
        _assert_status(download, 200)
        assert file_id in {item["id"] for item in listing.json()["files"]}, role
        assert download.json()["url"].endswith(
            f"{storage_key}?token=member-only"
        )

    for path in (
        f"/workspaces/{workspace_id}/files",
        f"/workspaces/{workspace_id}/files/{file_id}",
        f"/workspaces/{workspace_id}/files/{file_id}/download-url",
    ):
        outsider_response = await api_client.get(path, headers=outsider.auth_header)
        anonymous_response = await api_client.get(path)
        _assert_status(outsider_response, 404)
        _assert_status(anonymous_response, 401)

    assert sign_calls == [storage_key] * len(acceptance_world.roles)
