from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import get_rls_session
from app.schemas.history import HistoryPage
from app.services.history import list_history


router = APIRouter(prefix="/workspaces/{workspace_id}/history", tags=["history"])


def not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": "Workspace not found."},
    )


def not_authorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "not_authorized",
            "message": "Only owners and admins can view activity history.",
        },
    )


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
    return str(row.role)


@router.get("", response_model=HistoryPage)
async def get_workspace_history(
    workspace_id: UUID,
    limit: int = Query(default=50, ge=1, le=50),
    before: datetime | None = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> HistoryPage:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if role not in {"owner", "admin"}:
        raise not_authorized()

    return await list_history(workspace_id, limit, before, session)
