import pytest
from sqlalchemy import text

from app.services.files import MAX_FILE_SIZE_BYTES
from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

PNG_BYTES = b"\x89PNG\r\n\x1a\nvalid-png"
JPEG_BYTES = b"\xff\xd8\xff\xe0valid-jpeg"
WEBP_BYTES = b"RIFF\x10\x00\x00\x00WEBPvalid-webp"
PDF_BYTES = b"%PDF-1.7\nvalid-pdf"


async def _file_count(db_connection, workspace_id: str) -> int:
    result = await db_connection.execute(
        text("select count(*) from public.files where workspace_id = :workspace_id"),
        {"workspace_id": workspace_id},
    )
    return int(result.scalar_one())


async def _upload(api_client, user, workspace_id: str, filename: str, content: bytes):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=user.auth_header,
        files={"file": (filename, content, "application/octet-stream")},
    )


async def test_upload_valid_supported_files_creates_metadata_and_stores_objects(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("files-upload-owner")
    member = await signup_user("files-upload-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    stored_objects: list[dict[str, object]] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        stored_objects.append({"key": key, "content": content, "content_type": content_type})

    monkeypatch.setattr("app.services.storage.put_object", put_object)

    cases = [
        ("receipt.png", PNG_BYTES, "image/png"),
        ("receipt.jpg", JPEG_BYTES, "image/jpeg"),
        ("receipt.webp", WEBP_BYTES, "image/webp"),
        ("receipt.pdf", PDF_BYTES, "application/pdf"),
    ]

    for filename, content, expected_type in cases:
        response = await _upload(api_client, member, workspace_id, filename, content)
        assert response.status_code == 201, response.text
        payload = response.json()
        assert payload["original_filename"] == filename
        assert payload["content_type"] == expected_type
        assert payload["size_bytes"] == len(content)
        assert payload["expense_id"] is None
        assert payload["uploaded_by"] == member.user_id
        assert payload["status"] == "active"

        storage_path = f"{workspace_id}/{payload['id']}"
        assert stored_objects[-1] == {
            "key": storage_path,
            "content": content,
            "content_type": expected_type,
        }

        result = await db_connection.execute(
            text(
                """
                select original_filename, content_type, size_bytes, storage_path, uploaded_by, status
                from public.files
                where id = :file_id
                """
            ),
            {"file_id": payload["id"]},
        )
        row = result.first()
        assert row is not None
        assert row.original_filename == filename
        assert row.content_type == expected_type
        assert row.size_bytes == len(content)
        assert row.storage_path == storage_path
        assert str(row.uploaded_by) == member.user_id
        assert row.status == "active"

    assert len(stored_objects) == len(cases)


async def test_upload_rejects_unsupported_oversize_and_empty_files_before_storing(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("files-upload-invalid-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    storage_calls: list[object] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        storage_calls.append((key, content, content_type))

    monkeypatch.setattr("app.services.storage.put_object", put_object)

    invalid_cases = [
        ("renamed.pdf", b"MZnot-a-real-pdf", 415, "unsupported_file_type"),
        ("document.docx", b"PK\x03\x04not-supported", 415, "unsupported_file_type"),
        ("large.pdf", b"%PDF-" + b"x" * MAX_FILE_SIZE_BYTES, 413, "file_too_large"),
        ("empty.pdf", b"", 422, "empty_file"),
    ]

    for filename, content, expected_status, expected_code in invalid_cases:
        response = await _upload(api_client, owner, workspace_id, filename, content)
        assert response.status_code == expected_status, response.text
        assert response.json()["error"]["code"] == expected_code

    assert storage_calls == []
    assert await _file_count(db_connection, workspace_id) == 0


async def test_upload_rejects_viewer_role(api_client, signup_user, db_connection, monkeypatch) -> None:
    owner = await signup_user("files-upload-role-owner")
    viewer = await signup_user("files-upload-role-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201
    storage_calls: list[object] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        storage_calls.append((key, content, content_type))

    monkeypatch.setattr("app.services.storage.put_object", put_object)

    response = await _upload(api_client, viewer, workspace_id, "receipt.pdf", PDF_BYTES)
    assert response.status_code == 403, response.text
    assert response.json()["error"]["code"] == "forbidden"
    assert storage_calls == []
    assert await _file_count(db_connection, workspace_id) == 0
