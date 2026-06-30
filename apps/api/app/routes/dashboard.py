from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import database_unavailable_exception, get_rls_session
from app.schemas.dashboard import DashboardData, DashboardPeriod, FinancialSummary
from app.services.dashboard import (
    get_category_breakdown,
    get_current_period,
    get_expense_total,
    get_income_total,
    get_pending_ai_count,
    get_recent_records,
)


router = APIRouter(prefix="/workspaces/{workspace_id}/dashboard", tags=["dashboard"])


def error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def not_found() -> HTTPException:
    return error(status.HTTP_404_NOT_FOUND, "not_found", "Workspace not found.")


async def _workspace_role(session: AsyncSession, workspace_id: UUID, user_id: UUID) -> str:
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
    return row.role


@router.get("", response_model=DashboardData)
async def get_dashboard(
    workspace_id: UUID,
    recent_limit: int = Query(default=5, ge=1, le=50),
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> DashboardData:
    await _workspace_role(session, workspace_id, current_user.user_id)
    period_start, period_end = get_current_period()
    try:
        income_total = await get_income_total(workspace_id, period_start, period_end, session)
        expense_total = await get_expense_total(workspace_id, period_start, period_end, session)
        category_breakdown = await get_category_breakdown(
            workspace_id, period_start, period_end, session
        )
        recent_records = await get_recent_records(
            workspace_id, period_start, period_end, recent_limit, session
        )
        pending_ai_count = await get_pending_ai_count(workspace_id, session)
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    return DashboardData(
        workspace_id=workspace_id,
        period=DashboardPeriod(start=period_start, end=period_end),
        summary=FinancialSummary(
            total_income_minor=income_total,
            total_expenses_minor=expense_total,
            remaining_balance_minor=income_total - expense_total,
        ),
        category_breakdown=category_breakdown,
        recent_records=recent_records,
        pending_ai_count=pending_ai_count,
    )
