import pytest
from sqlalchemy import text

from app.services.storage import StorageError
from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

PDF_BYTES = b"%PDF-1.7\nfile-to-delete"


async def _upload_file(api_client, caller, workspace_id: str, filename: str):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=caller.auth_header,
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )


async def test_owner_and_admin_soft_delete_files_and_remove_storage_object(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("files-delete-owner")
    admin = await signup_user("files-delete-admin")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201

    stored_keys: list[str] = []
    removed_keys: list[str] = []
    signed_keys: list[str] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        stored_keys.append(key)

    async def remove_object(key: str) -> None:
        removed_keys.append(key)

    async def sign_url(key: str, ttl: int = 300):
        signed_keys.append(key)
        raise AssertionError("Deleted files must not receive signed URLs.")

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.remove_object", remove_object)
    monkeypatch.setattr("app.services.storage.sign_url", sign_url)

    owner_upload = await _upload_file(api_client, owner, workspace_id, "owner-file.pdf")
    admin_upload = await _upload_file(api_client, owner, workspace_id, "admin-file.pdf")
    assert owner_upload.status_code == 201, owner_upload.text
    assert admin_upload.status_code == 201, admin_upload.text
    owner_file_id = owner_upload.json()["id"]
    admin_file_id = admin_upload.json()["id"]

    owner_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/files/{owner_file_id}",
        headers=owner.auth_header,
    )
    assert owner_delete.status_code == 200, owner_delete.text
    owner_payload = owner_delete.json()
    assert owner_payload["id"] == owner_file_id
    assert owner_payload["status"] == "deleted"
    assert owner_payload["deleted_at"] is not None
    assert owner_payload["deleted_by"] == owner.user_id

    admin_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/files/{admin_file_id}",
        headers=admin.auth_header,
    )
    assert admin_delete.status_code == 200, admin_delete.text
    admin_payload = admin_delete.json()
    assert admin_payload["id"] == admin_file_id
    assert admin_payload["status"] == "deleted"
    assert admin_payload["deleted_at"] is not None
    assert admin_payload["deleted_by"] == admin.user_id

    assert stored_keys == [f"{workspace_id}/{owner_file_id}", f"{workspace_id}/{admin_file_id}"]
    assert removed_keys == [f"{workspace_id}/{owner_file_id}", f"{workspace_id}/{admin_file_id}"]

    list_response = await api_client.get(
        f"/workspaces/{workspace_id}/files",
        headers=owner.auth_header,
    )
    assert list_response.status_code == 200, list_response.text
    listed_ids = {file["id"] for file in list_response.json()["files"]}
    assert owner_file_id not in listed_ids
    assert admin_file_id not in listed_ids

    metadata_response = await api_client.get(
        f"/workspaces/{workspace_id}/files/{owner_file_id}",
        headers=owner.auth_header,
    )
    assert metadata_response.status_code == 200, metadata_response.text
    assert metadata_response.json()["status"] == "deleted"
    assert metadata_response.json()["deleted_by"] == owner.user_id

    download_response = await api_client.get(
        f"/workspaces/{workspace_id}/files/{owner_file_id}/download-url",
        headers=owner.auth_header,
    )
    assert download_response.status_code == 410, download_response.text
    assert download_response.json()["error"]["code"] == "file_deleted"
    assert signed_keys == []

    result = await db_connection.execute(
        text(
            """
            select id, status, deleted_at, deleted_by
            from public.files
            where id in (:owner_file_id, :admin_file_id)
            order by id
            """
        ),
        {"owner_file_id": owner_file_id, "admin_file_id": admin_file_id},
    )
    rows = result.fetchall()
    assert len(rows) == 2
    assert {str(row.id) for row in rows} == {owner_file_id, admin_file_id}
    assert all(row.status == "deleted" for row in rows)
    assert all(row.deleted_at is not None for row in rows)
    assert {str(row.deleted_by) for row in rows} == {owner.user_id, admin.user_id}


async def test_member_and_viewer_cannot_delete_files(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("files-delete-role-owner")
    member = await signup_user("files-delete-role-member")
    viewer = await signup_user("files-delete-role-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    removed_keys: list[str] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def remove_object(key: str) -> None:
        removed_keys.append(key)

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.remove_object", remove_object)

    member_upload = await _upload_file(api_client, member, workspace_id, "member-file.pdf")
    viewer_target_upload = await _upload_file(api_client, owner, workspace_id, "viewer-target.pdf")
    assert member_upload.status_code == 201, member_upload.text
    assert viewer_target_upload.status_code == 201, viewer_target_upload.text
    member_file_id = member_upload.json()["id"]
    viewer_target_file_id = viewer_target_upload.json()["id"]

    member_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/files/{member_file_id}",
        headers=member.auth_header,
    )
    assert member_delete.status_code == 403, member_delete.text
    assert member_delete.json()["error"]["code"] == "forbidden"

    viewer_delete = await api_client.delete(
        f"/workspaces/{workspace_id}/files/{viewer_target_file_id}",
        headers=viewer.auth_header,
    )
    assert viewer_delete.status_code == 403, viewer_delete.text
    assert viewer_delete.json()["error"]["code"] == "forbidden"

    assert removed_keys == []

    result = await db_connection.execute(
        text(
            """
            select id, status, deleted_at, deleted_by
            from public.files
            where id in (:member_file_id, :viewer_target_file_id)
            """
        ),
        {"member_file_id": member_file_id, "viewer_target_file_id": viewer_target_file_id},
    )
    rows = result.fetchall()
    assert len(rows) == 2
    assert all(row.status == "active" for row in rows)
    assert all(row.deleted_at is None for row in rows)
    assert all(row.deleted_by is None for row in rows)


async def test_storage_removal_failure_rolls_back_the_soft_delete(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    """If the storage object cannot be removed, the row must stay 'active'.

    Regression: the soft-delete UPDATE runs before `remove_object`, so a storage
    failure rolls the transaction back (via `session.begin()`) instead of
    leaving a visible 'active' row whose binary is already gone.
    """
    owner = await signup_user("files-delete-rollback-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def remove_object(key: str) -> None:
        raise StorageError("storage down")

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.remove_object", remove_object)

    upload = await _upload_file(api_client, owner, workspace_id, "keep-me.pdf")
    assert upload.status_code == 201, upload.text
    file_id = upload.json()["id"]

    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/files/{file_id}",
        headers=owner.auth_header,
    )
    assert delete_response.status_code == 503, delete_response.text
    assert delete_response.json()["error"]["code"] == "storage_unavailable"

    # The soft-delete must have rolled back: the row is still active.
    row = (
        await db_connection.execute(
            text("select status, deleted_at, deleted_by from public.files where id = :file_id"),
            {"file_id": file_id},
        )
    ).first()
    assert row is not None
    assert row.status == "active"
    assert row.deleted_at is None
    assert row.deleted_by is None

    # And it still appears in the active list (fully intact, delete retryable).
    listed = await api_client.get(
        f"/workspaces/{workspace_id}/files",
        headers=owner.auth_header,
    )
    assert listed.status_code == 200, listed.text
    assert file_id in {file["id"] for file in listed.json()["files"]}
