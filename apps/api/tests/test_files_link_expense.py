import pytest
from sqlalchemy import text

from conftest import add_member, create_expense, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

PDF_BYTES = b"%PDF-1.7\nlinked-receipt"


async def _upload_file(api_client, caller, workspace_id: str, filename: str = "receipt.pdf"):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=caller.auth_header,
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )


async def test_link_detach_expense_exposure_and_expense_delete_unlinks_file(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("files-link-owner")
    member = await signup_user("files-link-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    monkeypatch.setattr("app.services.storage.put_object", put_object)

    expense_response = await create_expense(
        api_client,
        member,
        workspace_id,
        {
            "amount_minor": 4500,
            "occurred_on": "2026-07-03",
            "description": "Team dinner",
        },
    )
    assert expense_response.status_code == 201, expense_response.text
    expense = expense_response.json()
    expense_id = expense["id"]

    upload_response = await _upload_file(api_client, member, workspace_id)
    assert upload_response.status_code == 201, upload_response.text
    file_id = upload_response.json()["id"]

    link_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file_id}/link",
        headers=member.auth_header,
        json={"expense_id": expense_id},
    )
    assert link_response.status_code == 200, link_response.text
    assert link_response.json()["expense_id"] == expense_id

    linked_expense = await api_client.get(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=member.auth_header,
    )
    assert linked_expense.status_code == 200, linked_expense.text
    linked_payload = linked_expense.json()
    assert linked_payload["amount_minor"] == expense["amount_minor"]
    assert linked_payload["currency"] == expense["currency"]
    assert linked_payload["occurred_on"] == expense["occurred_on"]
    assert [file["id"] for file in linked_payload["files"]] == [file_id]

    detach_response = await api_client.delete(
        f"/workspaces/{workspace_id}/files/{file_id}/link",
        headers=member.auth_header,
    )
    assert detach_response.status_code == 200, detach_response.text
    assert detach_response.json()["expense_id"] is None

    detached_expense = await api_client.get(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=member.auth_header,
    )
    assert detached_expense.status_code == 200, detached_expense.text
    assert detached_expense.json()["files"] == []

    relink_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file_id}/link",
        headers=member.auth_header,
        json={"expense_id": expense_id},
    )
    assert relink_response.status_code == 200, relink_response.text
    assert relink_response.json()["expense_id"] == expense_id

    delete_expense_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=member.auth_header,
    )
    assert delete_expense_response.status_code == 204, delete_expense_response.text

    file_after_expense_delete = await api_client.get(
        f"/workspaces/{workspace_id}/files/{file_id}",
        headers=member.auth_header,
    )
    assert file_after_expense_delete.status_code == 200, file_after_expense_delete.text
    assert file_after_expense_delete.json()["status"] == "active"
    assert file_after_expense_delete.json()["expense_id"] is None

    list_after_expense_delete = await api_client.get(
        f"/workspaces/{workspace_id}/files",
        headers=member.auth_header,
    )
    assert list_after_expense_delete.status_code == 200, list_after_expense_delete.text
    assert file_id in {file["id"] for file in list_after_expense_delete.json()["files"]}

    result = await db_connection.execute(
        text(
            """
            select e.amount_minor, e.currency, e.status as expense_status,
                   f.status as file_status, f.expense_id
            from public.expenses e
            join public.files f on f.id = :file_id
            where e.id = :expense_id
            """
        ),
        {"expense_id": expense_id, "file_id": file_id},
    )
    row = result.first()
    assert row is not None
    assert row.amount_minor == expense["amount_minor"]
    assert row.currency == expense["currency"]
    assert row.expense_status == "deleted"
    assert row.file_status == "active"
    assert row.expense_id is None


async def test_link_rejects_cross_workspace_deleted_file_and_viewer(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("files-link-rules-owner")
    viewer = await signup_user("files-link-rules-viewer")
    other_owner = await signup_user("files-link-rules-other")
    workspace = await create_team_workspace(api_client, owner, "Link Rules")
    other_workspace = await create_team_workspace(api_client, other_owner, "Other Link Rules")
    workspace_id = workspace["id"]
    other_workspace_id = other_workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    monkeypatch.setattr("app.services.storage.put_object", put_object)

    expense_response = await create_expense(api_client, owner, workspace_id)
    other_expense_response = await create_expense(api_client, other_owner, other_workspace_id)
    assert expense_response.status_code == 201, expense_response.text
    assert other_expense_response.status_code == 201, other_expense_response.text
    expense_id = expense_response.json()["id"]
    other_expense_id = other_expense_response.json()["id"]

    active_upload = await _upload_file(api_client, owner, workspace_id, "active.pdf")
    deleted_upload = await _upload_file(api_client, owner, workspace_id, "deleted.pdf")
    assert active_upload.status_code == 201, active_upload.text
    assert deleted_upload.status_code == 201, deleted_upload.text
    active_file_id = active_upload.json()["id"]
    deleted_file_id = deleted_upload.json()["id"]

    await db_connection.execute(
        text(
            """
            update public.files
            set status = 'deleted', deleted_at = now(), deleted_by = :deleted_by
            where id = :file_id
            """
        ),
        {"file_id": deleted_file_id, "deleted_by": owner.user_id},
    )
    await db_connection.commit()

    cross_workspace_link = await api_client.post(
        f"/workspaces/{workspace_id}/files/{active_file_id}/link",
        headers=owner.auth_header,
        json={"expense_id": other_expense_id},
    )
    assert cross_workspace_link.status_code == 422, cross_workspace_link.text
    assert cross_workspace_link.json()["error"]["code"] == "cross_workspace_link"

    deleted_file_link = await api_client.post(
        f"/workspaces/{workspace_id}/files/{deleted_file_id}/link",
        headers=owner.auth_header,
        json={"expense_id": expense_id},
    )
    assert deleted_file_link.status_code == 410, deleted_file_link.text
    assert deleted_file_link.json()["error"]["code"] == "file_deleted"

    viewer_link = await api_client.post(
        f"/workspaces/{workspace_id}/files/{active_file_id}/link",
        headers=viewer.auth_header,
        json={"expense_id": expense_id},
    )
    assert viewer_link.status_code == 403, viewer_link.text
    assert viewer_link.json()["error"]["code"] == "forbidden"


async def test_member_can_link_and_detach_a_file_uploaded_by_another_member(
    api_client, signup_user, monkeypatch
) -> None:
    """A member may link/detach any workspace file, not only ones they uploaded.

    Regression: the files UPDATE RLS policy used to be uploader-scoped, which is
    narrower than LINK_ROLES, so a member linking an owner-uploaded file was
    silently RLS-filtered and got a misleading 404.
    """
    owner = await signup_user("files-link-crossuploader-owner")
    member = await signup_user("files-link-crossuploader-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    monkeypatch.setattr("app.services.storage.put_object", put_object)

    # File is uploaded by the owner; the linking/detaching is done by the member.
    upload_response = await _upload_file(api_client, owner, workspace_id)
    assert upload_response.status_code == 201, upload_response.text
    file_id = upload_response.json()["id"]

    expense_response = await create_expense(api_client, member, workspace_id)
    assert expense_response.status_code == 201, expense_response.text
    expense_id = expense_response.json()["id"]

    link_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file_id}/link",
        headers=member.auth_header,
        json={"expense_id": expense_id},
    )
    assert link_response.status_code == 200, link_response.text
    assert link_response.json()["expense_id"] == expense_id

    detach_response = await api_client.delete(
        f"/workspaces/{workspace_id}/files/{file_id}/link",
        headers=member.auth_header,
    )
    assert detach_response.status_code == 200, detach_response.text
    assert detach_response.json()["expense_id"] is None


async def test_deleting_expense_unlinks_a_file_uploaded_by_another_member(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    """Soft-deleting an expense must unlink every linked file, regardless of
    uploader or who performs the delete.

    Regression: the cascade unlink used to run under the deleter's per-file
    UPDATE RLS and silently no-opped on files they had not uploaded, leaving a
    dangling expense_id on a soft-deleted expense.
    """
    owner = await signup_user("files-cascade-owner")
    member = await signup_user("files-cascade-member")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    monkeypatch.setattr("app.services.storage.put_object", put_object)

    # Owner uploads the file and links it to the member's expense.
    upload_response = await _upload_file(api_client, owner, workspace_id)
    assert upload_response.status_code == 201, upload_response.text
    file_id = upload_response.json()["id"]

    expense_response = await create_expense(api_client, member, workspace_id)
    assert expense_response.status_code == 201, expense_response.text
    expense_id = expense_response.json()["id"]

    link_response = await api_client.post(
        f"/workspaces/{workspace_id}/files/{file_id}/link",
        headers=owner.auth_header,
        json={"expense_id": expense_id},
    )
    assert link_response.status_code == 200, link_response.text

    # The member (not the uploader) deletes their own expense.
    delete_response = await api_client.delete(
        f"/workspaces/{workspace_id}/expenses/{expense_id}",
        headers=member.auth_header,
    )
    assert delete_response.status_code == 204, delete_response.text

    row = (
        await db_connection.execute(
            text("select expense_id, status from public.files where id = :file_id"),
            {"file_id": file_id},
        )
    ).first()
    assert row is not None
    assert row.status == "active"
    assert row.expense_id is None
