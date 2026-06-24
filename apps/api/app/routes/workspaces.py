from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import database_unavailable_exception, get_rls_session
from app.schemas.workspaces import (
    Workspace,
    WorkspaceCreateRequest,
    WorkspacesListResponse,
)


router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": "Workspace not found."},
    )


def _workspace_from_row(row) -> Workspace:
    return Workspace(
        id=row.id,
        type=row.type,
        name=row.name,
        role=row.role,
        member_count=getattr(row, "member_count", None),
    )


@router.get("", response_model=WorkspacesListResponse, response_model_exclude_none=True)
async def list_workspaces(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> WorkspacesListResponse:
    try:
        result = await session.execute(
            text(
                """
                select w.id, w.type, w.name, wm.role
                from public.workspaces w
                join public.workspace_memberships wm on wm.workspace_id = w.id
                where wm.user_id = :user_id
                order by case when w.type = 'personal' then 0 else 1 end, w.created_at asc
                """
            ),
            {"user_id": str(current_user.user_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    return WorkspacesListResponse(workspaces=[_workspace_from_row(row) for row in result])


@router.post(
    "",
    response_model=Workspace,
    status_code=status.HTTP_201_CREATED,
    response_model_exclude_none=True,
)
async def create_workspace(
    request: WorkspaceCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Workspace:
    name = request.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "invalid_request", "message": "Workspace name is required."},
        )

    # gen_random_uuid() default can't be used here: with RLS enabled, "insert
    # ... returning id" requires the new row to also pass the table's SELECT
    # policy (is_workspace_member), but the owner membership is only created
    # by an AFTER INSERT trigger that hasn't run yet at that point, so
    # Postgres raises a row security violation. Generating the id up front
    # avoids needing RETURNING on the insert.
    workspace_id = uuid4()
    await session.execute(
        text(
            """
            insert into public.workspaces(id, type, name, created_by)
            values (:workspace_id, 'team', :name, :created_by)
            """
        ),
        {"workspace_id": str(workspace_id), "name": name, "created_by": str(current_user.user_id)},
    )
    result = await session.execute(
        text(
            """
            select w.id, w.type, w.name, wm.role
            from public.workspaces w
            join public.workspace_memberships wm on wm.workspace_id = w.id
            where w.created_by = :user_id
              and w.type = 'team'
              and wm.user_id = :user_id
              and w.id = :workspace_id
            """
        ),
        {"user_id": str(current_user.user_id), "workspace_id": str(workspace_id)},
    )
    row = result.first()
    if row is None:
        raise not_found()
    return _workspace_from_row(row)


@router.get("/{workspace_id}", response_model=Workspace, response_model_exclude_none=True)
async def get_workspace(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Workspace:
    result = await session.execute(
        text(
            """
            select w.id, w.type, w.name, wm.role, count(all_members.id)::int as member_count
            from public.workspaces w
            join public.workspace_memberships wm
              on wm.workspace_id = w.id
             and wm.user_id = :user_id
            left join public.workspace_memberships all_members
              on all_members.workspace_id = w.id
            where w.id = :workspace_id
            group by w.id, w.type, w.name, wm.role
            """
        ),
        {"workspace_id": str(workspace_id), "user_id": str(current_user.user_id)},
    )
    row = result.first()
    if row is None:
        raise not_found()
    return _workspace_from_row(row)
