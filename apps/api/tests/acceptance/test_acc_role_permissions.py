from __future__ import annotations

import pytest
from sqlalchemy import text

from conftest import AI_STUB_KEY, period_date, requires_supabase


pytestmark = [pytest.mark.acceptance, pytest.mark.asyncio, requires_supabase]

PDF_BYTES = b"%PDF-1.7\nphase-ten-role-matrix"


def _assert_status(response, expected: int) -> None:
    assert response.status_code == expected, response.text


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": AI_STUB_KEY},
    )
    _assert_status(response, 200)


async def _workspace_state(db_connection, workspace_id: str) -> dict[str, int | bool]:
    row = (
        await db_connection.execute(
            text(
                """
                select
                    (select count(*) from public.incomes where workspace_id = :workspace_id)::int
                        as incomes,
                    (select count(*) from public.expenses where workspace_id = :workspace_id)::int
                        as expenses,
                    (select count(*) from public.categories where workspace_id = :workspace_id)::int
                        as categories,
                    (select count(*) from public.files where workspace_id = :workspace_id)::int
                        as files,
                    (select count(*) from public.ai_extractions where workspace_id = :workspace_id)::int
                        as ai_extractions,
                    (select count(*) from public.workspace_ai_settings where workspace_id = :workspace_id)::int
                        as ai_settings,
                    (select count(*) from public.activity_history where workspace_id = :workspace_id)::int
                        as history,
                    (select auto_delete_after_extraction
                       from public.workspaces
                      where id = :workspace_id) as auto_delete_after_extraction
                """
            ),
            {"workspace_id": workspace_id},
        )
    ).one()
    return dict(row._mapping)


async def test_owner_admin_member_viewer_action_matrix(
    api_client, acceptance_world, ai_provider_stub, monkeypatch
) -> None:
    workspace_id = acceptance_world.workspace_a.id
    roles = acceptance_world.roles

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    await _configure_ai(api_client, roles["owner"], workspace_id)

    for role, user in roles.items():
        for endpoint in ("incomes", "expenses", "categories", "files", "ai-settings"):
            response = await api_client.get(
                f"/workspaces/{workspace_id}/{endpoint}",
                headers=user.auth_header,
            )
            _assert_status(response, 200)

        workspace_response = await api_client.get(
            f"/workspaces/{workspace_id}", headers=user.auth_header
        )
        _assert_status(workspace_response, 200)
        assert workspace_response.json()["role"] == role

        history_response = await api_client.get(
            f"/workspaces/{workspace_id}/history", headers=user.auth_header
        )
        _assert_status(history_response, 200 if role in {"owner", "admin"} else 403)

    expected_by_action = {
        "income": {"owner": 201, "admin": 201, "member": 403, "viewer": 403},
        "expense": {"owner": 201, "admin": 201, "member": 201, "viewer": 403},
        "category": {"owner": 201, "admin": 201, "member": 403, "viewer": 403},
        "file": {"owner": 201, "admin": 201, "member": 201, "viewer": 403},
        "workspace_settings": {
            "owner": 200,
            "admin": 403,
            "member": 403,
            "viewer": 403,
        },
        "ai_settings": {"owner": 200, "admin": 403, "member": 403, "viewer": 403},
        "ai_summary": {"owner": 200, "admin": 200, "member": 200, "viewer": 403},
    }

    for role, user in roles.items():
        income = await api_client.post(
            f"/workspaces/{workspace_id}/incomes",
            headers=user.auth_header,
            json={
                "amount_minor": 1000,
                "occurred_on": period_date(8),
                "description": f"Acceptance {role} income",
            },
        )
        _assert_status(income, expected_by_action["income"][role])

        expense = await api_client.post(
            f"/workspaces/{workspace_id}/expenses",
            headers=user.auth_header,
            json={
                "amount_minor": 500,
                "occurred_on": period_date(8),
                "merchant_name": f"Acceptance {role} expense",
            },
        )
        _assert_status(expense, expected_by_action["expense"][role])

        category = await api_client.post(
            f"/workspaces/{workspace_id}/categories",
            headers=user.auth_header,
            json={"name": f"Phase 10 {role} category"},
        )
        _assert_status(category, expected_by_action["category"][role])

        upload = await api_client.post(
            f"/workspaces/{workspace_id}/files",
            headers=user.auth_header,
            files={
                "file": (
                    f"phase-ten-{role}.pdf",
                    PDF_BYTES,
                    "application/pdf",
                )
            },
        )
        _assert_status(upload, expected_by_action["file"][role])

        workspace_settings = await api_client.patch(
            f"/workspaces/{workspace_id}",
            headers=user.auth_header,
            json={"auto_delete_after_extraction": role == "owner"},
        )
        _assert_status(
            workspace_settings, expected_by_action["workspace_settings"][role]
        )

        ai_settings = await api_client.put(
            f"/workspaces/{workspace_id}/ai-settings",
            headers=user.auth_header,
            json={"provider": "openai", "api_key": AI_STUB_KEY},
        )
        _assert_status(ai_settings, expected_by_action["ai_settings"][role])

        ai_provider_stub.succeed()
        ai_summary = await api_client.post(
            f"/workspaces/{workspace_id}/reports/ai-summary",
            headers=user.auth_header,
            json={"period": "current_month", "locale": "en"},
        )
        _assert_status(ai_summary, expected_by_action["ai_summary"][role])


async def test_viewer_cannot_modify_any_record(
    api_client, acceptance_world, db_connection, monkeypatch
) -> None:
    workspace_id = acceptance_world.workspace_a.id
    owner = acceptance_world.user_for_role("owner")
    viewer = acceptance_world.user_for_role("viewer")

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def remove_object(key: str) -> None:
        raise AssertionError("Viewer denial must happen before storage deletion.")

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.remove_object", remove_object)
    await _configure_ai(api_client, owner, workspace_id)

    owner_upload = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=owner.auth_header,
        files={"file": ("viewer-denied.pdf", PDF_BYTES, "application/pdf")},
    )
    _assert_status(owner_upload, 201)
    file_id = owner_upload.json()["id"]

    before = await _workspace_state(db_connection, workspace_id)
    viewer_headers = viewer.auth_header
    category_id = acceptance_world.workspace_a.category_ids["groceries"]

    attempts = [
        await api_client.post(
            f"/workspaces/{workspace_id}/incomes",
            headers=viewer_headers,
            json={"amount_minor": 9999, "occurred_on": period_date(9)},
        ),
        await api_client.patch(
            f"/workspaces/{workspace_id}/incomes/{acceptance_world.records.confirmed_income_id}",
            headers=viewer_headers,
            json={"amount_minor": 9999},
        ),
        await api_client.post(
            f"/workspaces/{workspace_id}/expenses",
            headers=viewer_headers,
            json={"amount_minor": 9999, "occurred_on": period_date(9)},
        ),
        await api_client.delete(
            f"/workspaces/{workspace_id}/expenses/{acceptance_world.records.confirmed_expense_id}",
            headers=viewer_headers,
        ),
        await api_client.post(
            f"/workspaces/{workspace_id}/categories",
            headers=viewer_headers,
            json={"name": "Viewer forbidden category"},
        ),
        await api_client.patch(
            f"/workspaces/{workspace_id}/categories/{category_id}",
            headers=viewer_headers,
            json={"name": "Viewer forbidden rename"},
        ),
        await api_client.post(
            f"/workspaces/{workspace_id}/files",
            headers=viewer_headers,
            files={"file": ("viewer-upload.pdf", PDF_BYTES, "application/pdf")},
        ),
        await api_client.delete(
            f"/workspaces/{workspace_id}/files/{file_id}",
            headers=viewer_headers,
        ),
        await api_client.patch(
            f"/workspaces/{workspace_id}",
            headers=viewer_headers,
            json={"auto_delete_after_extraction": True},
        ),
        await api_client.put(
            f"/workspaces/{workspace_id}/ai-settings",
            headers=viewer_headers,
            json={"provider": "openai", "api_key": AI_STUB_KEY},
        ),
        await api_client.post(
            f"/workspaces/{workspace_id}/files/{file_id}/extractions",
            headers=viewer_headers,
        ),
        await api_client.post(
            f"/workspaces/{workspace_id}/reports/ai-summary",
            headers=viewer_headers,
            json={"period": "current_month", "locale": "en"},
        ),
    ]

    for response in attempts:
        _assert_status(response, 403)

    history = await api_client.get(
        f"/workspaces/{workspace_id}/history", headers=viewer_headers
    )
    _assert_status(history, 403)

    after = await _workspace_state(db_connection, workspace_id)
    assert after == before
