from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import database_unavailable_exception, get_rls_session
from app.schemas.categories import (
    CategoriesListResponse,
    Category,
    CategoryCreateRequest,
    CategoryReorderRequest,
    CategoryUpdateRequest,
)


router = APIRouter(prefix="/workspaces/{workspace_id}/categories", tags=["categories"])


def error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def not_found() -> HTTPException:
    return error(status.HTTP_404_NOT_FOUND, "not_found", "Workspace not found.")


def forbidden() -> HTTPException:
    return error(status.HTTP_403_FORBIDDEN, "forbidden", "You do not have permission to do that.")


def duplicate_category_name() -> HTTPException:
    return error(
        status.HTTP_409_CONFLICT,
        "duplicate_category_name",
        "An active category already uses that name.",
    )


def invalid_order() -> HTTPException:
    return error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "invalid_order",
        "Category order must include each workspace category exactly once.",
    )


def invalid_archive_state() -> HTTPException:
    return error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "invalid_archive_state",
        "Categories can only be archived in this phase.",
    )


def _category_from_row(row) -> Category:
    return Category(
        id=row.id,
        name=row.name,
        sort_order=row.sort_order,
        is_archived=row.is_archived,
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
    return row.role


async def _category(session: AsyncSession, workspace_id: UUID, category_id: UUID):
    result = await session.execute(
        text(
            """
            select id, name, sort_order, is_archived
            from public.categories
            where workspace_id = :workspace_id
              and id = :category_id
            """
        ),
        {"workspace_id": str(workspace_id), "category_id": str(category_id)},
    )
    return result.first()


async def _ensure_unique_active_name(
    session: AsyncSession,
    workspace_id: UUID,
    name: str,
    category_id: UUID | None = None,
) -> None:
    exclude_current = (
        ""
        if category_id is None
        else "and id <> cast(:category_id as uuid)"
    )
    result = await session.execute(
        text(
            f"""
            select id
            from public.categories
            where workspace_id = :workspace_id
              and lower(name) = lower(:name)
              and not is_archived
              {exclude_current}
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "name": name,
            "category_id": str(category_id) if category_id else None,
        },
    )
    if result.first() is not None:
        raise duplicate_category_name()


def _raise_from_db_error(exc: SQLAlchemyError) -> None:
    if "categories_unique_active_name" in str(exc).lower():
        raise duplicate_category_name() from exc
    raise exc


async def _categories(
    session: AsyncSession, workspace_id: UUID, include_archived: bool = True
) -> list[Category]:
    archived_filter = "" if include_archived else "and not is_archived"
    result = await session.execute(
        text(
            f"""
            select id, name, sort_order, is_archived
            from public.categories
            where workspace_id = :workspace_id
              {archived_filter}
            order by sort_order asc, name asc
            """
        ),
        {"workspace_id": str(workspace_id)},
    )
    return [_category_from_row(row) for row in result]


@router.get("", response_model=CategoriesListResponse)
async def list_categories(
    workspace_id: UUID,
    include_archived: bool = Query(default=True),
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> CategoriesListResponse:
    await _workspace_role(session, workspace_id, current_user.user_id)
    try:
        categories = await _categories(session, workspace_id, include_archived)
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    return CategoriesListResponse(categories=categories)


@router.post("", response_model=Category, status_code=status.HTTP_201_CREATED)
async def create_category(
    workspace_id: UUID,
    request: CategoryCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Category:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if role not in {"owner", "admin"}:
        raise forbidden()

    await _ensure_unique_active_name(session, workspace_id, request.name)

    try:
        result = await session.execute(
            text(
                """
                insert into public.categories(workspace_id, name, sort_order)
                select :workspace_id,
                       :name,
                       coalesce(max(sort_order), -1) + 1
                from public.categories
                where workspace_id = :workspace_id
                returning id, name, sort_order, is_archived
                """
            ),
            {"workspace_id": str(workspace_id), "name": request.name},
        )
    except DBAPIError as exc:
        if "categories_unique_active_name" in str(exc).lower():
            raise duplicate_category_name() from exc
        raise database_unavailable_exception(exc) from exc
    except SQLAlchemyError as exc:
        _raise_from_db_error(exc)

    row = result.first()
    if row is None:
        raise not_found()
    return _category_from_row(row)


@router.patch("/{category_id}", response_model=Category)
async def update_category(
    workspace_id: UUID,
    category_id: UUID,
    request: CategoryUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Category:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if role not in {"owner", "admin"}:
        raise forbidden()

    existing = await _category(session, workspace_id, category_id)
    if existing is None:
        raise not_found()
    if "is_archived" in request.model_fields_set and request.is_archived is False:
        raise invalid_archive_state()
    if "name" in request.model_fields_set and request.name is not None:
        await _ensure_unique_active_name(session, workspace_id, request.name, category_id)

    assignments: list[str] = []
    params = {"workspace_id": str(workspace_id), "category_id": str(category_id)}
    for field in ("name", "is_archived"):
        if field in request.model_fields_set:
            assignments.append(f"{field} = :{field}")
            params[field] = getattr(request, field)

    try:
        result = await session.execute(
            text(
                f"""
                update public.categories
                set {", ".join(assignments)}
                where workspace_id = :workspace_id
                  and id = :category_id
                returning id, name, sort_order, is_archived
                """
            ),
            params,
        )
    except DBAPIError as exc:
        if "categories_unique_active_name" in str(exc).lower():
            raise duplicate_category_name() from exc
        raise database_unavailable_exception(exc) from exc
    except SQLAlchemyError as exc:
        _raise_from_db_error(exc)

    row = result.first()
    if row is None:
        raise not_found()
    return _category_from_row(row)


@router.put("/order", response_model=CategoriesListResponse)
async def reorder_categories(
    workspace_id: UUID,
    request: CategoryReorderRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> CategoriesListResponse:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if role not in {"owner", "admin"}:
        raise forbidden()

    requested_ids = [str(category_id) for category_id in request.category_ids]
    if len(requested_ids) != len(set(requested_ids)):
        raise invalid_order()

    result = await session.execute(
        text(
            """
            select id
            from public.categories
            where workspace_id = :workspace_id
            """
        ),
        {"workspace_id": str(workspace_id)},
    )
    existing_ids = {str(row.id) for row in result}
    if set(requested_ids) != existing_ids:
        raise invalid_order()

    order_values = ",".join(
        f"(CAST(:category_id_{index} AS uuid), CAST(:sort_order_{index} AS integer))"
        for index in range(len(requested_ids))
    )
    params = {"workspace_id": str(workspace_id)}
    for index, category_id_value in enumerate(requested_ids):
        params[f"category_id_{index}"] = category_id_value
        params[f"sort_order_{index}"] = index

    try:
        await session.execute(
            text(
                f"""
                update public.categories as categories
                set sort_order = ordered.sort_order
                from (values {order_values}) as ordered(id, sort_order)
                where categories.workspace_id = :workspace_id
                  and categories.id = ordered.id
                """
            ),
            params,
        )
        categories = await _categories(session, workspace_id)
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    return CategoriesListResponse(categories=categories)
