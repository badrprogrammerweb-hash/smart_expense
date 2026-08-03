import re
from pathlib import Path

import pytest
from sqlalchemy import text

from conftest import requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = (
    REPO_ROOT
    / "supabase"
    / "migrations"
    / "20260731000000_private_schema_privileged_functions.sql"
)
APP_ROOT = REPO_ROOT / "apps" / "api" / "app"
TARGET_FUNCTIONS = (
    "ensure_personal_workspace",
    "get_workspace_ai_key_for_extraction",
    "find_user_profile_by_email",
    "shares_workspace_with",
)


def _migration_sql() -> str:
    assert MIGRATION_PATH.is_file(), f"Missing Phase 3 migration: {MIGRATION_PATH}"
    return MIGRATION_PATH.read_text(encoding="utf-8")


def _without_sql_comments(sql: str) -> str:
    without_blocks = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    return re.sub(r"--[^\r\n]*", "", without_blocks)


async def _phase3_state(db_connection) -> tuple:
    functions = (
        await db_connection.execute(
            text(
                """
                select
                    n.nspname,
                    p.proname,
                    pg_get_function_identity_arguments(p.oid),
                    p.proacl::text,
                    p.proconfig,
                    p.prosrc
                from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
                where p.proname in (
                    'ensure_personal_workspace',
                    'get_workspace_ai_key_for_extraction',
                    'find_user_profile_by_email',
                    'shares_workspace_with',
                    'handle_new_user',
                    'workspace_role_for',
                    'is_workspace_member'
                )
                order by n.nspname, p.proname,
                         pg_get_function_identity_arguments(p.oid)
                """
            )
        )
    ).all()
    policy = (
        await db_connection.execute(
            text(
                """
                select pg_get_expr(polqual, polrelid)
                from pg_policy
                where polname = 'Members can read co-members profiles'
                """
            )
        )
    ).scalar_one()
    trigger = (
        await db_connection.execute(
            text(
                """
                select t.tgname, n.nspname, p.proname
                from pg_trigger t
                join pg_proc p on p.oid = t.tgfoid
                join pg_namespace n on n.oid = p.pronamespace
                where t.tgname = 'on_auth_user_created'
                  and not t.tgisinternal
                """
            )
        )
    ).one()
    schema_usage = (
        await db_connection.execute(
            text("select has_schema_privilege('authenticated', 'private', 'USAGE')")
        )
    ).scalar_one()
    return tuple(functions), policy, tuple(trigger), schema_usage


async def test_phase3_migration_is_idempotent(db_connection) -> None:
    migration_sql = _migration_sql()
    raw_connection = await db_connection.get_raw_connection()

    await raw_connection.driver_connection.execute(migration_sql)
    first_state = await _phase3_state(db_connection)
    await raw_connection.driver_connection.execute(migration_sql)
    second_state = await _phase3_state(db_connection)

    assert second_state == first_state


async def test_migration_contains_no_policy_or_table_ddl() -> None:
    executable_sql = _without_sql_comments(_migration_sql())
    prohibited = re.compile(
        r"\b(?:create|drop)\s+policy\b|\b(?:create|alter)\s+table\b",
        flags=re.IGNORECASE,
    )

    assert prohibited.search(executable_sql) is None


async def test_production_call_sites_do_not_use_old_public_qualifiers() -> None:
    matches: list[str] = []
    for path in APP_ROOT.rglob("*.py"):
        content = path.read_text(encoding="utf-8")
        for function_name in TARGET_FUNCTIONS:
            if f"public.{function_name}" in content:
                matches.append(f"{path.relative_to(REPO_ROOT)}: public.{function_name}")

    assert matches == []


async def test_signup_trigger_still_targets_public_handle_new_user(db_connection) -> None:
    row = (
        await db_connection.execute(
            text(
                """
                select t.tgname, n.nspname, p.proname
                from pg_trigger t
                join pg_proc p on p.oid = t.tgfoid
                join pg_namespace n on n.oid = p.pronamespace
                where t.tgname = 'on_auth_user_created'
                  and not t.tgisinternal
                """
            )
        )
    ).one()

    assert tuple(row) == ("on_auth_user_created", "public", "handle_new_user")
