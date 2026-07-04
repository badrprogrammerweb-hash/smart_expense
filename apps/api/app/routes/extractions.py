"""Routes for AI extraction trigger, review, confirm, and discard."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.auth import CurrentUser, get_current_user
from app.schemas.extractions import ExtractionRead
from app.services.extractions import trigger_extraction


router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["extractions"])


@router.post("/files/{file_id}/extractions", response_model=ExtractionRead)
async def trigger_workspace_extraction(
    workspace_id: UUID,
    file_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> ExtractionRead:
    return await trigger_extraction(workspace_id, file_id, current_user)
