from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import get_rls_session
from app.schemas.reports import ReportData, ReportPreset
from app.services.extractions import workspace_role
from app.services.reports import get_report_data, resolve_report_period


router = APIRouter(prefix="/workspaces/{workspace_id}/reports", tags=["reports"])


@router.get("", response_model=ReportData)
async def get_workspace_report(
    workspace_id: UUID,
    period: ReportPreset = Query(default=ReportPreset.CURRENT_MONTH),
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    recent_limit: int = Query(default=5, ge=1, le=50),
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> ReportData:
    await workspace_role(session, workspace_id, current_user.user_id)
    report_period = resolve_report_period(period, start, end)
    return await get_report_data(workspace_id, report_period, session, recent_limit=recent_limit)
