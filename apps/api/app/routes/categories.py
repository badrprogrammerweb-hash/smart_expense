from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
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
    CategoryTree,
    CategoryUpdateRequest,
)
from app.schemas.dashboard import RecordType


router = APIRouter(prefix="/workspaces/{workspace_id}/categories", tags=["categories"])


def error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def not_found() -> HTTPException:
    return error(status.HTTP_404_NOT_FOUND, "not_found", "Workspace not found.")


def category_not_found() -> HTTPException:
    return error(status.HTTP_404_NOT_FOUND, "not_found", "Category not found.")


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
        "Category order must include each sibling category exactly once.",
    )


def invalid_parent_category() -> HTTPException:
    return error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "invalid_parent_category",
        "Parent category is not valid for this workspace.",
    )


def category_has_references() -> HTTPException:
    return error(
        status.HTTP_409_CONFLICT,
        "category_has_references",
        "Category is referenced by records or still has subcategories.",
    )


def _category_from_row(row) -> Category:
    return Category(
        id=row.id,
        name=row.name,
        translation_key=row.translation_key,
        is_system=row.is_system,
        parent_id=row.parent_id,
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
            select id, name, translation_key, is_system, parent_id, sort_order, is_archived,
                   category_type
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
    *,
    category_type: str | None = None,
    parent_id: UUID | None = None,
    exclude_id: UUID | None = None,
) -> None:
    scope_filter = (
        "and parent_id = :parent_id"
        if parent_id is not None
        else "and parent_id is null and category_type = :category_type"
    )
    exclude_filter = "" if exclude_id is None else "and id <> cast(:exclude_id as uuid)"
    result = await session.execute(
        text(
            f"""
            select id
            from public.categories
            where workspace_id = :workspace_id
              and lower(name) = lower(:name)
              and not is_archived
              {scope_filter}
              {exclude_filter}
            """
        ),
        {
            "workspace_id": str(workspace_id),
            "name": name,
            "category_type": category_type,
            "parent_id": str(parent_id) if parent_id else None,
            "exclude_id": str(exclude_id) if exclude_id else None,
        },
    )
    if result.first() is not None:
        raise duplicate_category_name()


def _raise_from_db_error(exc: SQLAlchemyError) -> None:
    if "categories_unique_active_" in str(exc).lower():
        raise duplicate_category_name() from exc
    raise exc


async def _category_rows(session: AsyncSession, workspace_id: UUID, category_type: str):
    result = await session.execute(
        text(
            """
            select id, name, translation_key, is_system, parent_id, sort_order, is_archived
            from public.categories
            where workspace_id = :workspace_id
              and category_type = :category_type
            order by parent_id nulls first, sort_order asc, name asc
            """
        ),
        {"workspace_id": str(workspace_id), "category_type": category_type},
    )
    return list(result)


def _build_category_tree(rows, include_archived: bool) -> list[CategoryTree]:
    subcategories_by_parent: dict[UUID, list] = {}
    for row in rows:
        if row.parent_id is not None:
            subcategories_by_parent.setdefault(row.parent_id, []).append(row)

    tree: list[CategoryTree] = []
    for row in rows:
        if row.parent_id is not None:
            continue
        if not include_archived and row.is_archived:
            continue
        children = subcategories_by_parent.get(row.id, [])
        subcategories = [
            _category_from_row(child)
            for child in children
            if include_archived or not child.is_archived
        ]
        tree.append(
            CategoryTree(
                id=row.id,
                name=row.name,
                translation_key=row.translation_key,
                is_system=row.is_system,
                parent_id=row.parent_id,
                sort_order=row.sort_order,
                is_archived=row.is_archived,
                subcategories=subcategories,
            )
        )
    return tree


@router.get("", response_model=CategoriesListResponse)
async def list_categories(
    workspace_id: UUID,
    category_type: RecordType = Query(...),
    include_archived: bool = Query(default=True),
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> CategoriesListResponse:
    await _workspace_role(session, workspace_id, current_user.user_id)
    try:
        rows = await _category_rows(session, workspace_id, category_type)
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    return CategoriesListResponse(categories=_build_category_tree(rows, include_archived))


async def _resolve_parent_category_type(session: AsyncSession, workspace_id: UUID, parent_id: UUID) -> str:
    result = await session.execute(
        text(
            """
            select workspace_id, category_type, parent_id
            from public.categories
            where id = :parent_id
            """
        ),
        {"parent_id": str(parent_id)},
    )
    row = result.first()
    if row is None or str(row.workspace_id) != str(workspace_id) or row.parent_id is not None:
        raise invalid_parent_category()
    return row.category_type


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

    if request.parent_id is not None:
        parent_category_type = await _resolve_parent_category_type(session, workspace_id, request.parent_id)
        if request.category_type is not None and request.category_type != parent_category_type:
            raise invalid_parent_category()
        category_type = parent_category_type
    else:
        category_type = request.category_type

    await _ensure_unique_active_name(
        session, workspace_id, request.name, category_type=category_type, parent_id=request.parent_id
    )

    sibling_filter = (
        "parent_id = :parent_id"
        if request.parent_id is not None
        else "parent_id is null and category_type = :category_type"
    )
    params = {
        "workspace_id": str(workspace_id),
        "category_type": category_type,
        "parent_id": str(request.parent_id) if request.parent_id else None,
        "name": request.name,
    }

    try:
        await session.execute(
            text("select pg_advisory_xact_lock(hashtext(cast(:workspace_id as text)))"),
            {"workspace_id": str(workspace_id)},
        )
        result = await session.execute(
            text(
                f"""
                insert into public.categories(workspace_id, category_type, parent_id, name, sort_order)
                select :workspace_id,
                       :category_type,
                       cast(:parent_id as uuid),
                       :name,
                       coalesce(max(sort_order), -1) + 1
                from public.categories
                where workspace_id = :workspace_id
                  and {sibling_filter}
                returning id, name, translation_key, is_system, parent_id, sort_order, is_archived
                """
            ),
            params,
        )
    except DBAPIError as exc:
        message = str(exc).lower()
        if "categories_unique_active_" in message:
            raise duplicate_category_name() from exc
        if "invalid_parent_category" in message:
            raise invalid_parent_category() from exc
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
        raise category_not_found()
    if "name" in request.model_fields_set and request.name is not None:
        await _ensure_unique_active_name(
            session,
            workspace_id,
            request.name,
            category_type=existing.category_type,
            parent_id=existing.parent_id,
            exclude_id=category_id,
        )

    assignments: list[str] = []
    params = {"workspace_id": str(workspace_id), "category_id": str(category_id)}
    for field in ("name", "is_archived"):
        if field in request.model_fields_set:
            assignments.append(f"{field} = :{field}")
            params[field] = getattr(request, field)
    if "name" in request.model_fields_set and request.name is not None:
        # A rename supersedes the system default: keep resolving display text
        # from the (now customized) `name` column, never a stale translated
        # label, per FR-008 ("historical records show the current name, not
        # a frozen snapshot").
        assignments.append("translation_key = null")

    try:
        result = await session.execute(
            text(
                f"""
                update public.categories
                set {", ".join(assignments)}
                where workspace_id = :workspace_id
                  and id = :category_id
                returning id, name, translation_key, is_system, parent_id, sort_order, is_archived
                """
            ),
            params,
        )
    except DBAPIError as exc:
        if "categories_unique_active_" in str(exc).lower():
            raise duplicate_category_name() from exc
        raise database_unavailable_exception(exc) from exc
    except SQLAlchemyError as exc:
        _raise_from_db_error(exc)

    row = result.first()
    if row is None:
        raise category_not_found()
    return _category_from_row(row)


async def _reorder_scope_category_type(
    session: AsyncSession, workspace_id: UUID, request: CategoryReorderRequest
) -> str:
    if request.category_type is not None:
        return request.category_type
    result = await session.execute(
        text(
            "select category_type from public.categories where id = :parent_id and workspace_id = :workspace_id"
        ),
        {"parent_id": str(request.parent_id), "workspace_id": str(workspace_id)},
    )
    row = result.first()
    if row is None:
        raise invalid_order()
    return row.category_type


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

    order_values = ",".join(
        f"(CAST(:category_id_{index} AS uuid), CAST(:sort_order_{index} AS integer))"
        for index in range(len(requested_ids))
    )
    if request.parent_id is not None:
        sibling_filter = "parent_id = :parent_id"
    else:
        sibling_filter = "parent_id is null and category_type = :category_type"

    params = {
        "workspace_id": str(workspace_id),
        "category_type": request.category_type,
        "parent_id": str(request.parent_id) if request.parent_id else None,
    }
    for index, category_id_value in enumerate(requested_ids):
        params[f"category_id_{index}"] = category_id_value
        params[f"sort_order_{index}"] = index

    try:
        category_type = await _reorder_scope_category_type(session, workspace_id, request)

        result = await session.execute(
            text(
                f"""
                select id
                from public.categories
                where workspace_id = :workspace_id
                  and {sibling_filter}
                """
            ),
            params,
        )
        existing_ids = {str(row.id) for row in result}
        if set(requested_ids) != existing_ids:
            raise invalid_order()

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
        rows = await _category_rows(session, workspace_id, category_type)
    except HTTPException:
        raise
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    return CategoriesListResponse(categories=_build_category_tree(rows, True))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    workspace_id: UUID,
    category_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Response:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if role not in {"owner", "admin"}:
        raise forbidden()

    existing = await _category(session, workspace_id, category_id)
    if existing is None:
        raise category_not_found()

    try:
        result = await session.execute(
            text(
                """
                delete from public.categories
                where workspace_id = :workspace_id
                  and id = :category_id
                returning id
                """
            ),
            {"workspace_id": str(workspace_id), "category_id": str(category_id)},
        )
    except DBAPIError as exc:
        if "category_has_references" in str(exc).lower():
            raise category_has_references() from exc
        raise database_unavailable_exception(exc) from exc

    if result.first() is None:
        raise category_not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
