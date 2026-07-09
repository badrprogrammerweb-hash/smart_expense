from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import database_unavailable_exception
from app.schemas.ai_settings import AiProvider
from app.schemas.ai_summary import AiSummaryRequest, AiSummaryResponse
from app.services import ai_providers
from app.services.extractions import _sqlstate, workspace_role
from app.services.reports import get_report_data, resolve_report_period


ALLOWED_ROLES = frozenset({"owner", "admin", "member"})


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _not_authorized() -> HTTPException:
    return _error(
        status.HTTP_403_FORBIDDEN,
        "not_authorized",
        "Your current role cannot request an AI summary.",
    )


def _ai_not_configured() -> HTTPException:
    return _error(
        status.HTTP_409_CONFLICT,
        "ai_not_configured",
        "Configure an AI provider key before requesting an AI summary.",
    )


def _ai_key_invalid() -> HTTPException:
    return _error(
        status.HTTP_400_BAD_REQUEST,
        "ai_key_invalid",
        "The configured AI key could not be used.",
    )


def _ai_provider_error() -> HTTPException:
    return _error(
        status.HTTP_502_BAD_GATEWAY,
        "ai_provider_error",
        "The AI summary could not be generated right now.",
    )


async def _get_ai_key(session: AsyncSession, workspace_id: UUID) -> tuple[AiProvider, str] | None:
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
            raise _not_authorized() from exc
        raise database_unavailable_exception(exc) from exc

    row = result.first()
    if row is None:
        return None
    return AiProvider(str(row.provider)), str(row.api_key)


def _aggregate_payload(report) -> dict[str, Any]:
    return {
        "period": report.period.model_dump(mode="json"),
        "summary": report.summary.model_dump(mode="json"),
        "category_breakdown": [
            item.model_dump(mode="json") for item in report.category_breakdown
        ],
        "spending_trend": [item.model_dump(mode="json") for item in report.spending_trend],
        "top_merchants": [item.model_dump(mode="json") for item in report.top_merchants],
        "team_activity": [item.model_dump(mode="json") for item in report.team_activity],
        "pending_review_count": report.pending_review_count,
        "spending_summary": report.spending_summary.model_dump(mode="json"),
    }


async def generate_ai_summary(
    workspace_id: UUID,
    request: AiSummaryRequest,
    user_id: UUID,
    session: AsyncSession,
) -> AiSummaryResponse:
    role = await workspace_role(session, workspace_id, user_id)
    if role not in ALLOWED_ROLES:
        raise _not_authorized()

    key = await _get_ai_key(session, workspace_id)
    if key is None:
        raise _ai_not_configured()
    provider, api_key = key

    report_period = resolve_report_period(request.period, request.start, request.end)
    report = await get_report_data(workspace_id, report_period, session, recent_limit=1)
    aggregates = _aggregate_payload(report)

    try:
        text = await ai_providers.summarize_spending(
            provider,
            api_key,
            aggregates,
            request.locale.value,
        )
    except ai_providers.AiSummaryInvalidKeyError as exc:
        raise _ai_key_invalid() from exc
    except ai_providers.AiSummaryProviderError as exc:
        raise _ai_provider_error() from exc
    finally:
        api_key = ""

    return AiSummaryResponse(locale=request.locale, text=text)
