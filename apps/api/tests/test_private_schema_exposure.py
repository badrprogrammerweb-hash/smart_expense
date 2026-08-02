import json
import os
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import httpx
import pytest
from sqlalchemy import text

from conftest import add_member, create_team_workspace, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

SYNTHETIC_OPENAI_KEY = "sk-phase18-local-0000000000000000abcd"
TARGET_FUNCTIONS = (
    "ensure_personal_workspace(uuid,text)",
    "get_workspace_ai_key_for_extraction(uuid)",
    "find_user_profile_by_email(text)",
    "shares_workspace_with(uuid,uuid)",
)
RLS_HELPERS = (
    "workspace_role_for(uuid,uuid)",
    "is_workspace_member(uuid,uuid)",
)
REPO_ROOT = Path(__file__).resolve().parents[3]


def _local_supabase_url() -> str:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    hostname = urlparse(url).hostname
    assert hostname in {"127.0.0.1", "localhost"}, "Exposure tests must use local Supabase"
    return url


def _local_anon_key() -> str:
    configured = os.getenv("SUPABASE_ANON_KEY", "").strip()
    if configured:
        return configured

    npx = shutil.which("npx")
    if not npx:
        raise RuntimeError("Local Supabase anon key is unavailable")
    completed = subprocess.run(
        [npx, "--no-install", "supabase", "status", "-o", "json"],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if completed.returncode != 0:
        raise RuntimeError("Could not read the local Supabase anon key")
    try:
        anon_key = json.loads(completed.stdout)["ANON_KEY"]
    except (KeyError, json.JSONDecodeError) as exc:
        raise RuntimeError("Local Supabase status omitted the anon key") from exc
    assert anon_key
    return anon_key


async def _postgrest_rpc(user, function_name: str, payload: dict) -> httpx.Response:
    headers = {
        "apikey": _local_anon_key(),
        "Authorization": f"Bearer {user.token}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(
        base_url=_local_supabase_url(), timeout=10, trust_env=False
    ) as client:
        return await client.post(
            f"/rest/v1/rpc/{function_name}",
            headers=headers,
            json=payload,
        )


def _local_user_headers(user) -> dict[str, str]:
    return {
        "apikey": _local_anon_key(),
        "Authorization": f"Bearer {user.token}",
    }


async def test_relocated_privileged_rpcs_are_not_published(signup_user) -> None:
    caller = await signup_user("private-rpc-caller")
    target = await signup_user("private-rpc-target")

    attempts = {
        "ensure_personal_workspace": {
            "target_user_id": target.user_id,
            "target_email": target.email,
        },
        "get_workspace_ai_key_for_extraction": {
            "p_workspace_id": "00000000-0000-0000-0000-000000000000"
        },
        "find_user_profile_by_email": {"lookup_email": target.email},
        "shares_workspace_with": {
            "target_user_id": target.user_id,
            "viewer_id": caller.user_id,
        },
    }

    for function_name, payload in attempts.items():
        response = await _postgrest_rpc(caller, function_name, payload)
        assert response.status_code == 404, (
            f"{function_name} remains published through local PostgREST "
            f"(status={response.status_code})"
        )


async def test_still_public_safe_rpc_proves_postgrest_harness(api_client, signup_user) -> None:
    owner = await signup_user("private-rpc-control")
    workspace = await create_team_workspace(api_client, owner, "Phase 18 RPC control")

    response = await _postgrest_rpc(
        owner,
        "clear_workspace_ai_key",
        {"p_workspace_id": workspace["id"]},
    )

    assert response.status_code != 404, "PostgREST control RPC unexpectedly returned 404"


async def test_member_cannot_retrieve_configured_byok_key_over_postgrest(
    api_client, signup_user
) -> None:
    owner = await signup_user("private-rpc-key-owner")
    member = await signup_user("private-rpc-key-member")
    workspace = await create_team_workspace(api_client, owner, "Phase 18 key secrecy")
    workspace_id = workspace["id"]
    add_response = await add_member(api_client, owner, workspace_id, member, "member")
    assert add_response.status_code == 201, add_response.text
    configure_response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": SYNTHETIC_OPENAI_KEY},
    )
    assert configure_response.status_code == 200, configure_response.text

    response = await _postgrest_rpc(
        member,
        "get_workspace_ai_key_for_extraction",
        {"p_workspace_id": workspace_id},
    )

    assert response.status_code == 404, (
        "get_workspace_ai_key_for_extraction remains published through local PostgREST "
        f"(status={response.status_code})"
    )
    assert SYNTHETIC_OPENAI_KEY not in response.text
    assert "sk-" not in response.text
    assert "AIza" not in response.text


async def test_private_function_privileges_are_preserved(db_connection) -> None:
    private_rows = (
        await db_connection.execute(
            text(
                """
                select
                    p.proname,
                    regexp_replace(
                        pg_get_function_identity_arguments(p.oid),
                        '(^|, )[[:alnum:]_"]+ ', chr(92) || '1', 'g'
                    ) as identity_arguments,
                    n.nspname,
                    has_function_privilege(
                        'authenticated', p.oid, 'EXECUTE'
                    ) as authenticated_execute
                from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'private'
                  and p.proname in (
                      'ensure_personal_workspace',
                      'get_workspace_ai_key_for_extraction',
                      'find_user_profile_by_email',
                      'shares_workspace_with'
                  )
                order by p.proname
                """
            )
        )
    ).mappings().all()
    actual_signatures = {
        f"{row['proname']}({row['identity_arguments'].replace(', ', ',')})"
        for row in private_rows
    }
    schema_usage = (
        await db_connection.execute(
            text(
                """
                select case
                    when to_regnamespace('private') is null then false
                    else has_schema_privilege(
                        'authenticated', to_regnamespace('private'), 'USAGE'
                    )
                end
                """
            )
        )
    ).scalar_one()

    assert schema_usage is True
    assert actual_signatures == set(TARGET_FUNCTIONS)
    assert all(row["authenticated_execute"] for row in private_rows)

    helper_rows = (
        await db_connection.execute(
            text(
                """
                select
                    p.proname,
                    regexp_replace(
                        pg_get_function_identity_arguments(p.oid),
                        '(^|, )[[:alnum:]_"]+ ', chr(92) || '1', 'g'
                    ) as identity_arguments,
                    n.nspname,
                    has_function_privilege(
                        'authenticated', p.oid, 'EXECUTE'
                    ) as authenticated_execute,
                    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
                    exists (
                        select 1
                        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                        where acl.grantee = 0
                          and acl.privilege_type = 'EXECUTE'
                    ) as public_execute
                from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
                where p.proname in ('workspace_role_for', 'is_workspace_member')
                order by p.proname
                """
            )
        )
    ).mappings().all()
    assert {
        f"{row['nspname']}.{row['proname']}"
        f"({row['identity_arguments'].replace(', ', ',')})"
        for row in helper_rows
    } == {f"private.{signature}" for signature in RLS_HELPERS}
    assert all(row["authenticated_execute"] for row in helper_rows)
    assert all(not row["anon_execute"] for row in helper_rows)
    assert all(not row["public_execute"] for row in helper_rows)


async def test_phase9_rls_helpers_are_not_published(api_client, signup_user) -> None:
    owner = await signup_user("private-rls-helper-owner")
    workspace = await create_team_workspace(api_client, owner, "Phase 18 RLS helper control")
    payload = {
        "target_workspace_id": workspace["id"],
        "target_user_id": owner.user_id,
    }

    for function_name in ("workspace_role_for", "is_workspace_member"):
        response = await _postgrest_rpc(owner, function_name, payload)
        assert response.status_code == 404, (
            f"{function_name} remains published through local PostgREST "
            f"(status={response.status_code})"
        )


async def test_phase9_policy_dependencies_follow_helpers_and_rls_still_filters(
    api_client, signup_user, db_connection
) -> None:
    owner = await signup_user("private-rls-policy-owner")
    member = await signup_user("private-rls-policy-member")
    outsider = await signup_user("private-rls-policy-outsider")
    workspace = await create_team_workspace(api_client, owner, "Phase 18 policy OID control")
    assert (
        await add_member(api_client, owner, workspace["id"], member, "member")
    ).status_code == 201

    dependency_rows = (
        await db_connection.execute(
            text(
                """
                select n.nspname, p.proname, count(*) as dependency_count
                from pg_depend d
                join pg_policy pol
                  on d.classid = 'pg_policy'::regclass
                 and d.objid = pol.oid
                join pg_proc p on p.oid = d.refobjid
                join pg_namespace n on n.oid = p.pronamespace
                where p.proname in ('workspace_role_for', 'is_workspace_member')
                group by n.nspname, p.proname
                order by p.proname
                """
            )
        )
    ).mappings().all()
    assert {(row["nspname"], row["proname"]) for row in dependency_rows} == {
        ("private", "workspace_role_for"),
        ("private", "is_workspace_member"),
    }
    assert all(row["dependency_count"] > 0 for row in dependency_rows)

    for user, should_see_workspace in (
        (owner, True),
        (member, True),
        (outsider, False),
    ):
        response = await api_client.get("/workspaces", headers=user.auth_header)
        assert response.status_code == 200, response.text
        visible_ids = {item["id"] for item in response.json()["workspaces"]}
        assert (workspace["id"] in visible_ids) is should_see_workspace


async def test_phase9_residual_public_function_grants_are_tightened(db_connection) -> None:
    rows = (
        await db_connection.execute(
            text(
                """
                select
                    n.nspname,
                    p.proname,
                    regexp_replace(
                        pg_get_function_identity_arguments(p.oid),
                        '(^|, )[[:alnum:]_"]+ ', chr(92) || '1', 'g'
                    ) as identity_arguments,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE')
                        as authenticated_execute,
                    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
                    exists (
                        select 1
                        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                        where acl.grantee = 0
                          and acl.privilege_type = 'EXECUTE'
                    ) as public_execute
                from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public'
                  and (
                    (p.proname = 'receipt_object_workspace_id'
                     and regexp_replace(
                        pg_get_function_identity_arguments(p.oid),
                        '(^|, )[[:alnum:]_"]+ ', chr(92) || '1', 'g'
                     ) = 'text')
                    or
                    (p.proname = 'validate_category_assignment'
                     and regexp_replace(
                        pg_get_function_identity_arguments(p.oid),
                        '(^|, )[[:alnum:]_"]+ ', chr(92) || '1', 'g'
                     ) = 'uuid, uuid, text')
                  )
                order by p.proname
                """
            )
        )
    ).mappings().all()

    assert {
        f"{row['nspname']}.{row['proname']}"
        f"({row['identity_arguments'].replace(', ', ',')})"
        for row in rows
    } == {
        "public.receipt_object_workspace_id(text)",
        "public.validate_category_assignment(uuid,uuid,text)",
    }
    assert all(row["authenticated_execute"] for row in rows)
    assert all(not row["anon_execute"] for row in rows)
    assert all(not row["public_execute"] for row in rows)


async def test_phase9_receipt_storage_policy_still_allows_members_and_denies_outsiders(
    api_client, signup_user
) -> None:
    owner = await signup_user("private-storage-policy-owner")
    outsider = await signup_user("private-storage-policy-outsider")
    workspace = await create_team_workspace(api_client, owner, "Phase 18 storage policy control")
    object_name = f"{workspace['id']}/phase9-policy-proof.txt"
    object_body = b"phase9 local storage policy proof"

    async with httpx.AsyncClient(
        base_url=_local_supabase_url(), timeout=10, trust_env=False
    ) as client:
        upload = await client.post(
            f"/storage/v1/object/receipts/{object_name}",
            headers={**_local_user_headers(owner), "Content-Type": "text/plain"},
            content=object_body,
        )
        assert upload.status_code in {200, 201}, upload.text

        owner_read = await client.get(
            f"/storage/v1/object/authenticated/receipts/{object_name}",
            headers=_local_user_headers(owner),
        )
        assert owner_read.status_code == 200, owner_read.text
        assert owner_read.content == object_body

        outsider_read = await client.get(
            f"/storage/v1/object/authenticated/receipts/{object_name}",
            headers=_local_user_headers(outsider),
        )
        assert outsider_read.status_code in {400, 401, 403, 404}

        cleanup = await client.request(
            "DELETE",
            "/storage/v1/object/receipts",
            headers={**_local_user_headers(owner), "Content-Type": "application/json"},
            json={"prefixes": [object_name]},
        )
        assert cleanup.status_code in {200, 204}, cleanup.text
