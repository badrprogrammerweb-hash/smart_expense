"""Routes for AI extraction trigger, review, confirm, and discard."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import get_rls_session
from app.schemas.extractions import ConfirmExtractionRequest, ExtractionRead, ExtractionStatus
from app.services.extractions import (
    confirm_extraction,
    get_extraction,
    list_extractions,
    trigger_extraction,
)


router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["extractions"])


@router.post("/files/{file_id}/extractions", response_model=ExtractionRead)
async def trigger_workspace_extraction(
    workspace_id: UUID,
    file_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> ExtractionRead:
    return await trigger_extraction(workspace_id, file_id, current_user)


@router.get("/extractions", response_model=list[ExtractionRead])
async def list_workspace_extractions(
    workspace_id: UUID,
    status_filter: ExtractionStatus | None = Query(default=None, alias="status"),
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> list[ExtractionRead]:
    return await list_extractions(session, workspace_id, current_user.user_id, status_filter)


@router.get("/extractions/{extraction_id}", response_model=ExtractionRead)
async def get_workspace_extraction(
    workspace_id: UUID,
    extraction_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> ExtractionRead:
    return await get_extraction(session, workspace_id, extraction_id, current_user.user_id)


@router.post("/extractions/{extraction_id}/confirm", response_model=ExtractionRead)
async def confirm_workspace_extraction(
    workspace_id: UUID,
    extraction_id: UUID,
    request: ConfirmExtractionRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ExtractionRead:
    return await confirm_extraction(workspace_id, extraction_id, request, current_user)
