"""AI extraction orchestration: trigger, confirm, and discard workflows.

Role/own-record checks, the lazy stale-`processing` self-heal, the
three-phase trigger flow, and the confirm/discard orchestration all live
here (research.md Decisions 7-10).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.db import database_unavailable_exception, open_rls_session
from app.schemas.ai_settings import AiProvider
from app.schemas.extractions import ExtractionDraft, ExtractionRead, FailureReason
from app.services import ai_providers, storage


TRIGGER_ROLES = frozenset({"owner", "admin", "member"})
STALE_PROCESSING_INTERVAL = "2 minutes"
DRAFT_VISIBLE_STATUSES = frozenset({"ready_for_review", "confirmed"})
DISCARDABLE_STATUSES = frozenset({"ready_for_review", "failed"})


def error(status_code: int, code: str, message: str, **extra: object) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message, **extra})


def not_found() -> HTTPException:
    return error(status.HTTP_404_NOT_FOUND, "not_found", "Workspace not found.")


def forbidden() -> HTTPException:
    return error(status.HTTP_403_FORBIDDEN, "forbidden", "You do not have permission to do that.")


def ai_not_configured() -> HTTPException:
    return error(
        status.HTTP_409_CONFLICT,
        "ai_not_configured",
        "Configure an AI provider key before triggering extraction.",
    )


def extraction_in_progress() -> HTTPException:
    return error(
        status.HTTP_409_CONFLICT,
        "extraction_in_progress",
        "This file already has an extraction in progress.",
    )


def _sqlstate(exc: DBAPIError) -> str | None:
    source = getattr(exc, "orig", None)
    for attr in ("sqlstate", "pgcode"):
        value = getattr(source, attr, None)
        if value:
            return str(value)
    return None


async def workspace_role(session: AsyncSession, workspace_id: UUID, user_id: UUID) -> str:
    result = await session.execute(
        text(
            """
            select wm.role
            from public.workspaces w
            join public.workspace_memberships wm
              on wm.workspace_id = w.id
             and wm.user_id = :user_id
            where w.id = :workspace_id
            """
        ),
        {"workspace_id": str(workspace_id), "user_id": str(user_id)},
    )
    row = result.first()
    if row is None:
        raise not_found()
    return str(row.role)


async def _self_heal_stale_processing(session: AsyncSession, file_id: UUID) -> None:
    """Lazily convert an abandoned `processing` row to `failed`/`timeout`
    (research.md Decision 8) so FR-006 holds without a scheduler."""
    await session.execute(
        text(
            f"""
            update public.ai_extractions
            set status = 'failed', failure_reason = 'timeout', updated_at = now()
            where file_id = :file_id
              and status = 'processing'
              and triggered_at < now() - interval '{STALE_PROCESSING_INTERVAL}'
            """
        ),
        {"file_id": str(file_id)},
    )


async def _file_for_trigger(session: AsyncSession, workspace_id: UUID, file_id: UUID):
    result = await session.execute(
        text(
            """
            select id, status, expense_id, storage_path, content_type
            from public.files
            where workspace_id = :workspace_id
              and id = :file_id
            """
        ),
        {"workspace_id": str(workspace_id), "file_id": str(file_id)},
    )
    row = result.first()
    if row is None:
        raise not_found()
    return row


async def _has_active_extraction(session: AsyncSession, file_id: UUID) -> bool:
    result = await session.execute(
        text(
            """
            select 1
            from public.ai_extractions
            where file_id = :file_id
              and status in ('processing', 'ready_for_review')
            limit 1
            """
        ),
        {"file_id": str(file_id)},
    )
    return result.first() is not None


async def _get_ai_key(session: AsyncSession, workspace_id: UUID) -> tuple[str, str] | None:
    try:
        result = await session.execute(
            text(
                "select provider, api_key "
                "from public.get_workspace_ai_key_for_extraction(cast(:workspace_id as uuid))"
            ),
            {"workspace_id": str(workspace_id)},
        )
    except DBAPIError as exc:
        if _sqlstate(exc) == "42501":
            raise forbidden() from exc
        raise database_unavailable_exception(exc) from exc
    row = result.first()
    if row is None:
        return None
    return str(row.provider), str(row.api_key)


async def _insert_processing_row(
    session: AsyncSession, workspace_id: UUID, file_id: UUID, provider: str, user_id: UUID
) -> UUID:
    try:
        result = await session.execute(
            text(
                """
                insert into public.ai_extractions (workspace_id, file_id, provider, status, triggered_by)
                values (:workspace_id, :file_id, :provider, 'processing', :triggered_by)
                returning id
                """
            ),
            {
                "workspace_id": str(workspace_id),
                "file_id": str(file_id),
                "provider": provider,
                "triggered_by": str(user_id),
            },
        )
    except DBAPIError as exc:
        if _sqlstate(exc) == "23505":
            raise extraction_in_progress() from exc
        raise database_unavailable_exception(exc) from exc
    return result.scalar_one()


async def _persist_terminal_state(
    session: AsyncSession,
    extraction_id: UUID,
    outcome: ai_providers.ExtractedFields | ai_providers.ExtractionFailure,
) -> None:
    if isinstance(outcome, ai_providers.ExtractionFailure):
        await session.execute(
            text(
                """
                update public.ai_extractions
                set status = 'failed',
                    failure_reason = :failure_reason,
                    updated_at = now()
                where id = :id
                  and status = 'processing'
                """
            ),
            {"id": str(extraction_id), "failure_reason": outcome.failure_reason.value},
        )
        return

    await session.execute(
        text(
            """
            update public.ai_extractions
            set status = 'ready_for_review',
                amount_minor = :amount_minor,
                extracted_currency = :extracted_currency,
                occurred_on = :occurred_on,
                vendor_name = :vendor_name,
                suggested_category = :suggested_category,
                updated_at = now()
            where id = :id
              and status = 'processing'
            """
        ),
        {
            "id": str(extraction_id),
            "amount_minor": outcome.amount_minor,
            "extracted_currency": outcome.currency,
            "occurred_on": outcome.occurred_on,
            "vendor_name": outcome.vendor_name,
            "suggested_category": outcome.suggested_category,
        },
    )


async def _extraction_row(session: AsyncSession, extraction_id: UUID):
    result = await session.execute(
        text(
            """
            select id, workspace_id, file_id, provider, status, amount_minor, extracted_currency,
                   occurred_on, vendor_name, suggested_category, failure_reason,
                   triggered_by, triggered_at, confirmed_by, confirmed_at,
                   discarded_by, discarded_at, expense_id
            from public.ai_extractions
            where id = :id
            """
        ),
        {"id": str(extraction_id)},
    )
    row = result.first()
    if row is None:
        raise not_found()
    return row


def _extraction_read_from_row(row, current_user_id: UUID, role: str) -> ExtractionRead:
    draft = None
    if row.status in DRAFT_VISIBLE_STATUSES:
        draft = ExtractionDraft(
            amount_minor=row.amount_minor,
            extracted_currency=row.extracted_currency,
            occurred_on=row.occurred_on,
            vendor_name=row.vendor_name,
            suggested_category=row.suggested_category,
        )

    can_act = role in ("owner", "admin") or (
        role == "member" and str(row.triggered_by) == str(current_user_id)
    )
    can_edit = can_act and row.status == "ready_for_review"
    can_discard = can_act and row.status in DISCARDABLE_STATUSES

    return ExtractionRead(
        id=row.id,
        workspace_id=row.workspace_id,
        file_id=row.file_id,
        provider=row.provider,
        status=row.status,
        draft=draft,
        failure_reason=row.failure_reason,
        triggered_by=row.triggered_by,
        triggered_at=row.triggered_at,
        confirmed_by=row.confirmed_by,
        confirmed_at=row.confirmed_at,
        discarded_by=row.discarded_by,
        discarded_at=row.discarded_at,
        expense_id=row.expense_id,
        can_edit=can_edit,
        can_discard=can_discard,
    )


async def trigger_extraction(
    workspace_id: UUID,
    file_id: UUID,
    current_user: CurrentUser,
) -> ExtractionRead:
    user_id = current_user.user_id

    async with open_rls_session(current_user) as session:
        role = await workspace_role(session, workspace_id, user_id)
        if role not in TRIGGER_ROLES:
            raise forbidden()

        await _self_heal_stale_processing(session, file_id)

        file_row = await _file_for_trigger(session, workspace_id, file_id)
        if file_row.status != "active" or file_row.expense_id is not None:
            raise extraction_in_progress()
        if await _has_active_extraction(session, file_id):
            raise extraction_in_progress()

        key = await _get_ai_key(session, workspace_id)
        if key is None:
            raise ai_not_configured()
        provider, api_key = key

        extraction_id = await _insert_processing_row(session, workspace_id, file_id, provider, user_id)
        storage_path = file_row.storage_path
        content_type = file_row.content_type

    # No DB session held for the duration of the external provider call
    # (research.md Decision 7).
    try:
        file_bytes = await storage.get_object(storage_path)
    except storage.StorageError:
        outcome: ai_providers.ExtractedFields | ai_providers.ExtractionFailure = (
            ai_providers.ExtractionFailure(failure_reason=FailureReason.UNREADABLE_FILE)
        )
    else:
        outcome = await ai_providers.extract_receipt(
            AiProvider(provider), api_key, file_bytes, content_type
        )
    api_key = ""  # discard the decrypted key as soon as it is no longer needed

    async with open_rls_session(current_user) as session:
        await _persist_terminal_state(session, extraction_id, outcome)
        row = await _extraction_row(session, extraction_id)

    return _extraction_read_from_row(row, user_id, role)
