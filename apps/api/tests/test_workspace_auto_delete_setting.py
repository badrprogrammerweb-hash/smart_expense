import pytest
from sqlalchemy import text

from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

PDF_BYTES = b"%PDF-1.7\nauto-delete-setting"


async def _upload_file(api_client, caller, workspace_id: str):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=caller.auth_header,
        files={"file": ("receipt.pdf", PDF_BYTES, "application/pdf")},
    )


async def _file_counts(connection, workspace_id: str) -> tuple[int, int]:
    result = await connection.execute(
        text(
            """
            select
                count(*) filter (where status = 'active')::int as active_count,
                count(*) filter (where status = 'deleted')::int as deleted_count
            from public.files
            where workspace_id = :workspace_id
            """
        ),
        {"workspace_id": workspace_id},
    )
    row = result.one()
    return row.active_count, row.deleted_count


async def test_owner_updates_auto_delete_setting_and_it_remains_inert(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("auto-delete-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    removed_keys: list[str] = []

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def remove_object(key: str) -> None:
        removed_keys.append(key)

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.remove_object", remove_object)

    upload = await _upload_file(api_client, owner, workspace_id)
    assert upload.status_code == 201, upload.text
    assert await _file_counts(db_connection, workspace_id) == (1, 0)

    workspace_response = await api_client.get(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
    )
    assert workspace_response.status_code == 200, workspace_response.text
    assert workspace_response.json()["auto_delete_after_extraction"] is False

    list_response = await api_client.get("/workspaces", headers=owner.auth_header)
    assert list_response.status_code == 200, list_response.text
    listed_workspace = next(item for item in list_response.json()["workspaces"] if item["id"] == workspace_id)
    assert listed_workspace["auto_delete_after_extraction"] is False

    enable_response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"auto_delete_after_extraction": True},
    )
    assert enable_response.status_code == 200, enable_response.text
    assert enable_response.json() == {
        "id": workspace_id,
        "auto_delete_after_extraction": True,
    }

    workspace_response = await api_client.get(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
    )
    assert workspace_response.status_code == 200, workspace_response.text
    assert workspace_response.json()["auto_delete_after_extraction"] is True
    assert await _file_counts(db_connection, workspace_id) == (1, 0)
    assert removed_keys == []

    disable_response = await api_client.patch(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
        json={"auto_delete_after_extraction": False},
    )
    assert disable_response.status_code == 200, disable_response.text
    assert disable_response.json()["auto_delete_after_extraction"] is False

    workspace_response = await api_client.get(
        f"/workspaces/{workspace_id}",
        headers=owner.auth_header,
    )
    assert workspace_response.status_code == 200, workspace_response.text
    assert workspace_response.json()["auto_delete_after_extraction"] is False
    assert await _file_counts(db_connection, workspace_id) == (1, 0)
    assert removed_keys == []


async def test_non_owners_cannot_update_auto_delete_setting(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("auto-delete-role-owner")
    admin = await signup_user("auto-delete-role-admin")
    member = await signup_user("auto-delete-role-member")
    viewer = await signup_user("auto-delete-role-viewer")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    for caller in (admin, member, viewer):
        response = await api_client.patch(
            f"/workspaces/{workspace_id}",
            headers=caller.auth_header,
            json={"auto_delete_after_extraction": True},
        )

        assert response.status_code == 403, response.text
        assert response.json()["error"]["code"] == "forbidden"

    setting = (
        await db_connection.execute(
            text(
                """
                select auto_delete_after_extraction
                from public.workspaces
                where id = :workspace_id
                """
            ),
            {"workspace_id": workspace_id},
        )
    ).scalar_one()
    assert setting is False
