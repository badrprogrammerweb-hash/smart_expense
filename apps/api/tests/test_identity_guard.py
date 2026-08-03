import json
import uuid
from typing import Any

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db import get_engine
from conftest import requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


@pytest_asyncio.fixture
async def phase4_user_factory(signup_user):
    async def _create(prefix: str):
        return await signup_user(prefix)

    return _create


async def _set_authenticated_claims(connection, user: Any) -> None:
    await connection.execute(text("set local role authenticated"))
    await connection.execute(
        text("select set_config('request.jwt.claims', :claims, true)"),
        {"claims": json.dumps({"sub": user.user_id, "email": user.email})},
    )
    caller_id = (await connection.execute(text("select auth.uid()"))).scalar_one()
    assert str(caller_id) == user.user_id


def _sqlstate(exc: DBAPIError) -> str | None:
    source = exc.orig
    return getattr(source, "sqlstate", None) or getattr(source, "pgcode", None)


async def test_mismatched_identity_is_refused_without_mutating_target(
    phase4_user_factory, db_connection
) -> None:
    caller = await phase4_user_factory("identity-guard-caller")
    target = await phase4_user_factory("identity-guard-target")
    attacker_email = f"attacker-{uuid.uuid4().hex}@example.invalid"
    original_email = (
        await db_connection.execute(
            text("select email from public.user_profiles where id = :user_id"),
            {"user_id": target.user_id},
        )
    ).scalar_one()

    await _set_authenticated_claims(db_connection, caller)
    savepoint = await db_connection.begin_nested()
    caught: DBAPIError | None = None
    try:
        await db_connection.execute(
            text(
                "select private.ensure_personal_workspace("
                "cast(:target_user_id as uuid), :target_email)"
            ),
            {
                "target_user_id": target.user_id,
                "target_email": attacker_email,
            },
        )
    except DBAPIError as exc:
        caught = exc
    finally:
        await savepoint.rollback()

    await db_connection.execute(text("reset role"))
    target_rows = (
        await db_connection.execute(
            text("select email from public.user_profiles where id = :user_id"),
            {"user_id": target.user_id},
        )
    ).scalars().all()

    assert target_rows == [original_email]
    assert caught is not None, "Cross-identity bootstrap call was accepted"
    assert _sqlstate(caught) == "42501"
    assert "identity_mismatch" in str(caught.orig)


async def test_matching_identity_succeeds_and_repairs_own_state(
    phase4_user_factory, db_connection
) -> None:
    caller = await phase4_user_factory("identity-guard-self")
    drifted_email = f"drifted-{uuid.uuid4().hex}@example.invalid"
    await db_connection.execute(
        text("update public.user_profiles set email = :email where id = :user_id"),
        {"email": drifted_email, "user_id": caller.user_id},
    )

    await _set_authenticated_claims(db_connection, caller)
    await db_connection.execute(
        text(
            "select private.ensure_personal_workspace("
            "cast(:target_user_id as uuid), :target_email)"
        ),
        {"target_user_id": caller.user_id, "target_email": caller.email},
    )
    await db_connection.execute(text("reset role"))

    row = (
        await db_connection.execute(
            text(
                """
                select up.email,
                       count(distinct w.id)::int as personal_workspaces,
                       count(distinct wm.id)::int as owner_memberships
                from public.user_profiles up
                left join public.workspaces w
                  on w.created_by = up.id and w.type = 'personal'
                left join public.workspace_memberships wm
                  on wm.workspace_id = w.id
                 and wm.user_id = up.id
                 and wm.role = 'owner'
                where up.id = :user_id
                group by up.email
                """
            ),
            {"user_id": caller.user_id},
        )
    ).one()

    assert tuple(row) == (caller.email, 1, 1)


async def test_null_caller_context_succeeds(
    phase4_user_factory, db_connection
) -> None:
    target = await phase4_user_factory("identity-guard-null-caller")
    drifted_email = f"null-context-{uuid.uuid4().hex}@example.invalid"
    await db_connection.execute(
        text("update public.user_profiles set email = :email where id = :user_id"),
        {"email": drifted_email, "user_id": target.user_id},
    )
    assert (await db_connection.execute(text("select auth.uid()"))).scalar_one() is None

    await db_connection.execute(
        text(
            "select private.ensure_personal_workspace("
            "cast(:target_user_id as uuid), :target_email)"
        ),
        {"target_user_id": target.user_id, "target_email": target.email},
    )
    repaired_email = (
        await db_connection.execute(
            text("select email from public.user_profiles where id = :user_id"),
            {"user_id": target.user_id},
        )
    ).scalar_one()

    assert repaired_email == target.email


async def test_auth_signup_trigger_creates_personal_owner_workspace(
    phase4_user_factory, db_connection
) -> None:
    user = await phase4_user_factory("identity-guard-trigger")
    row = (
        await db_connection.execute(
            text(
                """
                select count(distinct up.id)::int as profiles,
                       count(distinct w.id)::int as personal_workspaces,
                       count(distinct wm.id)::int as owner_memberships
                from public.user_profiles up
                left join public.workspaces w
                  on w.created_by = up.id and w.type = 'personal'
                left join public.workspace_memberships wm
                  on wm.workspace_id = w.id
                 and wm.user_id = up.id
                 and wm.role = 'owner'
                where up.id = :user_id
                """
            ),
            {"user_id": user.user_id},
        )
    ).one()

    assert tuple(row) == (1, 1, 1)


async def test_authenticated_repair_corrects_only_callers_email(
    phase4_user_factory, api_client
) -> None:
    caller = await phase4_user_factory("identity-guard-repair")
    other = await phase4_user_factory("identity-guard-other")
    drifted_email = f"repair-drift-{uuid.uuid4().hex}@example.invalid"
    engine = get_engine()
    async with engine.begin() as connection:
        await connection.execute(
            text("update public.user_profiles set email = :email where id = :user_id"),
            {"email": drifted_email, "user_id": caller.user_id},
        )
        other_before = (
            await connection.execute(
                text("select email from public.user_profiles where id = :user_id"),
                {"user_id": other.user_id},
            )
        ).scalar_one()

    response = await api_client.get("/workspaces", headers=caller.auth_header)

    async with engine.connect() as connection:
        emails = dict(
            (
                await connection.execute(
                    text(
                        "select id::text, email from public.user_profiles "
                        "where id in (:caller_id, :other_id)"
                    ),
                    {"caller_id": caller.user_id, "other_id": other.user_id},
                )
            ).all()
        )

    assert response.status_code == 200, response.text
    assert emails[caller.user_id] == caller.email
    assert emails[other.user_id] == other_before
