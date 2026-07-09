import pytest

from conftest import period_date, requires_supabase


pytestmark = [pytest.mark.asyncio, pytest.mark.acceptance, requires_supabase]


DENIED_STATUS_CODES = {401, 403, 404}


def _assert_denied(response, expected_status: int | None = None) -> None:
    if expected_status is None:
        assert response.status_code in DENIED_STATUS_CODES, response.text
    else:
        assert response.status_code == expected_status, response.text

    payload = response.json()
    assert "error" in payload
    assert payload["error"]["code"] in {
        "forbidden",
        "not_authorized",
        "not_found",
        "unauthenticated",
    }


async def test_cross_workspace_read_denied_all_record_types(
    api_client,
    acceptance_world,
) -> None:
    workspace_b_id = acceptance_world.workspace_b.id
    workspace_a_user_headers = acceptance_world.auth_header_for_role("owner")
    workspace_b_owner_headers = acceptance_world.auth_header_for_workspace_b_owner()

    read_paths = [
        f"/workspaces/{workspace_b_id}/incomes",
        f"/workspaces/{workspace_b_id}/expenses",
        f"/workspaces/{workspace_b_id}/categories",
        f"/workspaces/{workspace_b_id}/files",
        f"/workspaces/{workspace_b_id}/reports",
        f"/workspaces/{workspace_b_id}/history",
    ]

    for path in read_paths:
        allowed = await api_client.get(path, headers=workspace_b_owner_headers)
        assert allowed.status_code == 200, allowed.text

        denied = await api_client.get(path, headers=workspace_a_user_headers)
        _assert_denied(denied, expected_status=404)


async def test_cross_workspace_write_denied(
    api_client,
    acceptance_world,
) -> None:
    workspace_b_id = acceptance_world.workspace_b.id
    workspace_a_user_headers = acceptance_world.auth_header_for_role("owner")

    write_attempts = [
        await api_client.post(
            f"/workspaces/{workspace_b_id}/incomes",
            headers=workspace_a_user_headers,
            json={"amount_minor": 2500, "occurred_on": period_date(14)},
        ),
        await api_client.patch(
            f"/workspaces/{workspace_b_id}/incomes/"
            f"{acceptance_world.records.workspace_b_income_id}",
            headers=workspace_a_user_headers,
            json={"amount_minor": 2600},
        ),
        await api_client.post(
            f"/workspaces/{workspace_b_id}/expenses",
            headers=workspace_a_user_headers,
            json={
                "amount_minor": 1700,
                "occurred_on": period_date(15),
                "merchant_name": "Cross Workspace Attempt",
            },
        ),
        await api_client.delete(
            f"/workspaces/{workspace_b_id}/expenses/"
            f"{acceptance_world.records.workspace_b_expense_id}",
            headers=workspace_a_user_headers,
        ),
        await api_client.post(
            f"/workspaces/{workspace_b_id}/categories",
            headers=workspace_a_user_headers,
            json={"name": "Cross Workspace Category"},
        ),
        await api_client.post(
            f"/workspaces/{workspace_b_id}/files",
            headers={**workspace_a_user_headers, "content-type": "text/plain"},
            content=b"not multipart; authorization must run first",
        ),
    ]

    for response in write_attempts:
        _assert_denied(response, expected_status=404)


async def test_unauthenticated_requests_denied(
    api_client,
    acceptance_world,
) -> None:
    workspace_id = acceptance_world.workspace_a.id

    protected_reads = [
        f"/workspaces/{workspace_id}/incomes",
        f"/workspaces/{workspace_id}/expenses",
        f"/workspaces/{workspace_id}/categories",
        f"/workspaces/{workspace_id}/files",
        f"/workspaces/{workspace_id}/reports",
        f"/workspaces/{workspace_id}/history",
    ]
    for path in protected_reads:
        response = await api_client.get(path)
        _assert_denied(response, expected_status=401)

    protected_writes = [
        await api_client.post(
            f"/workspaces/{workspace_id}/incomes",
            json={"amount_minor": 1000, "occurred_on": period_date(16)},
        ),
        await api_client.post(
            f"/workspaces/{workspace_id}/expenses",
            json={"amount_minor": 1000, "occurred_on": period_date(17)},
        ),
        await api_client.post(
            f"/workspaces/{workspace_id}/categories",
            json={"name": "Unauthenticated Category"},
        ),
        await api_client.post(
            f"/workspaces/{workspace_id}/files",
            headers={"content-type": "text/plain"},
            content=b"not multipart; authentication must run first",
        ),
    ]
    for response in protected_writes:
        _assert_denied(response, expected_status=401)


async def test_isolation_enforced_at_backend_or_rls_not_frontend(
    api_client,
    acceptance_world,
) -> None:
    workspace_b_id = acceptance_world.workspace_b.id
    workspace_a_user_headers = acceptance_world.auth_header_for_role("owner")

    direct_api_read = await api_client.get(
        f"/workspaces/{workspace_b_id}/reports",
        headers=workspace_a_user_headers,
    )
    _assert_denied(direct_api_read, expected_status=404)

    malformed_upload = await api_client.post(
        f"/workspaces/{workspace_b_id}/files",
        headers={**workspace_a_user_headers, "content-type": "text/plain"},
        content=b"this would be a 422 if the backend parsed it before authorization",
    )
    _assert_denied(malformed_upload, expected_status=404)
