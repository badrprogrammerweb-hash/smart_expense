import pytest

from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"


async def _put(api_client, caller, workspace_id: str):
    return await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=caller.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )


async def _delete(api_client, caller, workspace_id: str):
    return await api_client.delete(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=caller.auth_header,
    )


async def test_role_authorization_and_workspace_isolation(api_client, signup_user) -> None:
    owner = await signup_user("ai-auth-owner")
    admin = await signup_user("ai-auth-admin")
    member = await signup_user("ai-auth-member")
    viewer = await signup_user("ai-auth-viewer")
    outsider = await signup_user("ai-auth-outsider")
    other_owner = await signup_user("ai-auth-other-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    other_workspace = await create_team_workspace(api_client, other_owner)
    other_workspace_id = other_workspace["id"]

    assert (await add_member(api_client, owner, workspace_id, admin, "admin")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, member, "member")).status_code == 201
    assert (await add_member(api_client, owner, workspace_id, viewer, "viewer")).status_code == 201

    configure = await _put(api_client, owner, workspace_id)
    assert configure.status_code == 200, configure.text

    for caller in (owner, admin, member, viewer):
        response = await api_client.get(
            f"/workspaces/{workspace_id}/ai-settings",
            headers=caller.auth_header,
        )
        assert response.status_code == 200, response.text
        assert response.json()["configured"] is True

    for caller in (admin, member, viewer):
        put_response = await _put(api_client, caller, workspace_id)
        delete_response = await _delete(api_client, caller, workspace_id)

        assert put_response.status_code == 403, put_response.text
        assert put_response.json()["error"]["code"] == "forbidden"
        assert delete_response.status_code == 403, delete_response.text
        assert delete_response.json()["error"]["code"] == "forbidden"

    for method in ("get", "put", "delete"):
        request = getattr(api_client, method)
        kwargs = {"headers": outsider.auth_header}
        if method == "put":
            kwargs["json"] = {"provider": "openai", "api_key": OPENAI_KEY}
        response = await request(f"/workspaces/{workspace_id}/ai-settings", **kwargs)

        assert response.status_code == 404, response.text
        assert response.json()["error"]["code"] == "not_found"

    anon_response = await api_client.get(f"/workspaces/{workspace_id}/ai-settings")
    assert anon_response.status_code == 401, anon_response.text

    for method in ("get", "put", "delete"):
        request = getattr(api_client, method)
        kwargs = {"headers": owner.auth_header}
        if method == "put":
            kwargs["json"] = {"provider": "openai", "api_key": OPENAI_KEY}
        response = await request(f"/workspaces/{other_workspace_id}/ai-settings", **kwargs)

        assert response.status_code == 404, response.text
        assert response.json()["error"]["code"] == "not_found"
