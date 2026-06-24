from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import get_rls_session
from app.schemas.workspaces import (
    MemberAddRequest,
    MemberRoleUpdateRequest,
    WorkspaceMember,
    WorkspaceMembersListResponse,
)


router = APIRouter(prefix="/workspaces/{workspace_id}/members", tags=["workspace-members"])
ROLES = {"owner", "admin", "member", "viewer"}
ADDABLE_ROLES = {"admin", "member", "viewer"}


def error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def not_found() -> HTTPException:
    return error(status.HTTP_404_NOT_FOUND, "not_found", "Workspace not found.")


def forbidden() -> HTTPException:
    return error(status.HTTP_403_FORBIDDEN, "forbidden", "You do not have permission to do that.")


def invalid_role() -> HTTPException:
    return error(status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_role", "Role is not valid.")


def _member_from_row(row) -> WorkspaceMember:
    return WorkspaceMember(user_id=row.user_id, email=row.email, role=row.role)


async def _workspace_context(
    session: AsyncSession, workspace_id: UUID, user_id: UUID
) -> tuple[str, str]:
    result = await session.execute(
        text(
            """
            select w.type, wm.role
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
    return row.type, row.role


async def _member(
    session: AsyncSession, workspace_id: UUID, user_id: UUID
):
    result = await session.execute(
        text(
            """
            select wm.user_id, up.email, wm.role
            from public.workspace_memberships wm
            join public.user_profiles up on up.id = wm.user_id
            where wm.workspace_id = :workspace_id
              and wm.user_id = :user_id
            """
        ),
        {"workspace_id": str(workspace_id), "user_id": str(user_id)},
    )
    return result.first()


def _raise_from_db_error(exc: SQLAlchemyError) -> None:
    message = str(exc).lower()
    if "last_owner_protected" in message:
        raise error(status.HTTP_409_CONFLICT, "last_owner_protected", "Every workspace must keep an owner.") from exc
    if "member_limit_reached" in message:
        raise error(status.HTTP_409_CONFLICT, "member_limit_reached", "Workspace member limit reached.") from exc
    if "personal_workspace_single_member" in message:
        raise forbidden() from exc
    if "unique" in message or "duplicate" in message:
        raise error(status.HTTP_409_CONFLICT, "already_a_member", "User is already a member.") from exc
    raise exc


@router.get("", response_model=WorkspaceMembersListResponse)
async def list_members(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> WorkspaceMembersListResponse:
    await _workspace_context(session, workspace_id, current_user.user_id)
    result = await session.execute(
        text(
            """
            select wm.user_id, up.email, wm.role
            from public.workspace_memberships wm
            join public.user_profiles up on up.id = wm.user_id
            where wm.workspace_id = :workspace_id
            order by
                case wm.role
                    when 'owner' then 0
                    when 'admin' then 1
                    when 'member' then 2
                    else 3
                end,
                up.email asc
            """
        ),
        {"workspace_id": str(workspace_id)},
    )
    return WorkspaceMembersListResponse(members=[_member_from_row(row) for row in result])


@router.post("", response_model=WorkspaceMember, status_code=status.HTTP_201_CREATED)
async def add_member(
    workspace_id: UUID,
    request: MemberAddRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> WorkspaceMember:
    workspace_type, caller_role = await _workspace_context(session, workspace_id, current_user.user_id)

    role = request.role.strip().lower()
    if role not in ADDABLE_ROLES:
        raise invalid_role()

    if workspace_type == "personal" or caller_role not in {"owner", "admin"}:
        raise forbidden()

    lookup = await session.execute(
        text("select id, email from public.find_user_profile_by_email(:email)"),
        {"email": request.email.strip().lower()},
    )
    profile = lookup.first()
    if profile is None:
        raise error(status.HTTP_404_NOT_FOUND, "user_not_found", "User not found.")

    existing = await _member(session, workspace_id, profile.id)
    if existing is not None:
        raise error(status.HTTP_409_CONFLICT, "already_a_member", "User is already a member.")

    count_result = await session.execute(
        text("select count(*)::int from public.workspace_memberships where workspace_id = :workspace_id"),
        {"workspace_id": str(workspace_id)},
    )
    if count_result.scalar_one() >= 10:
        raise error(status.HTTP_409_CONFLICT, "member_limit_reached", "Workspace member limit reached.")

    try:
        await session.execute(
            text(
                """
                insert into public.workspace_memberships(workspace_id, user_id, role)
                values (:workspace_id, :user_id, :role)
                """
            ),
            {"workspace_id": str(workspace_id), "user_id": str(profile.id), "role": role},
        )
    except SQLAlchemyError as exc:
        _raise_from_db_error(exc)

    row = await _member(session, workspace_id, profile.id)
    if row is None:
        raise not_found()
    return _member_from_row(row)


@router.patch("/{user_id}", response_model=WorkspaceMember)
async def update_member_role(
    workspace_id: UUID,
    user_id: UUID,
    request: MemberRoleUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> WorkspaceMember:
    _, caller_role = await _workspace_context(session, workspace_id, current_user.user_id)

    new_role = request.role.strip().lower()
    if new_role not in ROLES:
        raise invalid_role()

    target = await _member(session, workspace_id, user_id)
    if target is None:
        raise not_found()

    if caller_role == "owner":
        pass
    elif caller_role == "admin" and target.role != "owner" and new_role != "owner":
        pass
    else:
        raise forbidden()

    try:
        await session.execute(
            text(
                """
                update public.workspace_memberships
                set role = :role
                where workspace_id = :workspace_id
                  and user_id = :user_id
                """
            ),
            {"workspace_id": str(workspace_id), "user_id": str(user_id), "role": new_role},
        )
    except SQLAlchemyError as exc:
        _raise_from_db_error(exc)

    row = await _member(session, workspace_id, user_id)
    if row is None:
        raise not_found()
    return _member_from_row(row)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def leave_workspace(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Response:
    workspace_type, _ = await _workspace_context(session, workspace_id, current_user.user_id)
    if workspace_type == "personal":
        raise forbidden()

    try:
        await session.execute(
            text(
                """
                delete from public.workspace_memberships
                where workspace_id = :workspace_id
                  and user_id = :user_id
                """
            ),
            {"workspace_id": str(workspace_id), "user_id": str(current_user.user_id)},
        )
    except SQLAlchemyError as exc:
        _raise_from_db_error(exc)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: UUID,
    user_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Response:
    _, caller_role = await _workspace_context(session, workspace_id, current_user.user_id)
    target = await _member(session, workspace_id, user_id)
    if target is None:
        raise not_found()

    if caller_role == "owner":
        pass
    elif caller_role == "admin" and target.role != "owner":
        pass
    else:
        raise forbidden()

    try:
        await session.execute(
            text(
                """
                delete from public.workspace_memberships
                where workspace_id = :workspace_id
                  and user_id = :user_id
                """
            ),
            {"workspace_id": str(workspace_id), "user_id": str(user_id)},
        )
    except SQLAlchemyError as exc:
        _raise_from_db_error(exc)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
