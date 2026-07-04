from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import get_rls_session
from app.schemas.ai_settings import AiSettingsStatus, AiSettingsUpdateRequest
from app.services.ai_settings import clear_ai_settings, configure_ai_settings, get_ai_settings_status


router = APIRouter(prefix="/workspaces/{workspace_id}/ai-settings", tags=["ai-settings"])


@router.get("", response_model=AiSettingsStatus)
async def get_workspace_ai_settings(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> AiSettingsStatus:
    return await get_ai_settings_status(session, workspace_id, current_user.user_id)


@router.put("", response_model=AiSettingsStatus)
async def put_workspace_ai_settings(
    workspace_id: UUID,
    request: AiSettingsUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> AiSettingsStatus:
    return await configure_ai_settings(
        session,
        workspace_id,
        current_user.user_id,
        request.provider,
        request.api_key.get_secret_value(),
    )


@router.delete("", response_model=AiSettingsStatus)
async def delete_workspace_ai_settings(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> AiSettingsStatus:
    return await clear_ai_settings(session, workspace_id, current_user.user_id)
