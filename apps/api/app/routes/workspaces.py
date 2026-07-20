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
    WorkspaceSettingsResponse,
    WorkspaceUpdateRequest,
    WorkspacesListResponse,
)


router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": "Workspace not found."},
    )


def forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "forbidden", "message": "You do not have permission to do that."},
    )


def currency_locked() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "currency_locked",
            "message": "Workspace currency is locked once income or expense records exist.",
        },
    )


def _workspace_from_row(row) -> Workspace:
    return Workspace(
        id=row.id,
        type=row.type,
        name=row.name,
        role=row.role,
        currency=row.currency,
        auto_delete_after_extraction=row.auto_delete_after_extraction,
        currency_locked=row.currency_locked,
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
                select
                    w.id,
                    w.type,
                    w.name,
                    w.currency,
                    w.auto_delete_after_extraction,
                    (
                        exists (select 1 from public.incomes i where i.workspace_id = w.id)
                        or exists (select 1 from public.expenses e where e.workspace_id = w.id)
                    ) as currency_locked,
                    wm.role
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
            select
                w.id,
                w.type,
                w.name,
                w.currency,
                w.auto_delete_after_extraction,
                false as currency_locked,
                wm.role
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


@router.patch("/{workspace_id}", response_model=WorkspaceSettingsResponse)
async def update_workspace(
    workspace_id: UUID,
    request: WorkspaceUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> WorkspaceSettingsResponse:
    role_result = await session.execute(
        text(
            """
            select wm.role, w.currency
            from public.workspaces w
            join public.workspace_memberships wm
              on wm.workspace_id = w.id
             and wm.user_id = :user_id
            where w.id = :workspace_id
            """
        ),
        {"workspace_id": str(workspace_id), "user_id": str(current_user.user_id)},
    )
    role_row = role_result.first()
    if role_row is None:
        raise not_found()
    if role_row.role != "owner":
        raise forbidden()

    if (
        "currency" in request.model_fields_set
        and request.currency is not None
        and request.currency != role_row.currency
    ):
        try:
            lock_result = await session.execute(
                text(
                    """
                    select exists (
                        select 1
                        from public.incomes
                        where workspace_id = :workspace_id
                    ) or exists (
                        select 1
                        from public.expenses
                        where workspace_id = :workspace_id
                    ) as has_records
                    """
                ),
                {"workspace_id": str(workspace_id)},
            )
        except DBAPIError as exc:
            raise database_unavailable_exception(exc) from exc

        if lock_result.scalar_one():
            raise currency_locked()

    assignments: list[str] = []
    params = {"workspace_id": str(workspace_id)}
    if (
        "auto_delete_after_extraction" in request.model_fields_set
        and request.auto_delete_after_extraction is not None
    ):
        assignments.append("auto_delete_after_extraction = :auto_delete_after_extraction")
        params["auto_delete_after_extraction"] = request.auto_delete_after_extraction
    if "currency" in request.model_fields_set and request.currency is not None:
        assignments.append("currency = :currency")
        params["currency"] = request.currency

    try:
        update_result = await session.execute(
            text(
                f"""
                update public.workspaces
                set {", ".join(assignments)}
                where id = :workspace_id
                returning id, currency, auto_delete_after_extraction
                """
            ),
            params,
        )
    except DBAPIError as exc:
        if "workspace currency is locked" in str(exc).lower():
            raise currency_locked() from exc
        raise database_unavailable_exception(exc) from exc

    row = update_result.first()
    if row is None:
        raise not_found()
    return WorkspaceSettingsResponse(
        id=row.id,
        currency=row.currency,
        auto_delete_after_extraction=row.auto_delete_after_extraction,
    )


@router.get("/{workspace_id}", response_model=Workspace, response_model_exclude_none=True)
async def get_workspace(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Workspace:
    result = await session.execute(
        text(
            """
            select
                w.id,
                w.type,
                w.name,
                w.currency,
                w.auto_delete_after_extraction,
                (
                    exists (select 1 from public.incomes i where i.workspace_id = w.id)
                    or exists (select 1 from public.expenses e where e.workspace_id = w.id)
                ) as currency_locked,
                wm.role,
                count(all_members.id)::int as member_count
            from public.workspaces w
            join public.workspace_memberships wm
              on wm.workspace_id = w.id
             and wm.user_id = :user_id
            left join public.workspace_memberships all_members
              on all_members.workspace_id = w.id
            where w.id = :workspace_id
            group by w.id, w.type, w.name, w.currency, w.auto_delete_after_extraction, wm.role
            """
        ),
        {"workspace_id": str(workspace_id), "user_id": str(current_user.user_id)},
    )
    row = result.first()
    if row is None:
        raise not_found()
    return _workspace_from_row(row)
