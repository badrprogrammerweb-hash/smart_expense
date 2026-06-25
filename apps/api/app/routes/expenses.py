from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import database_unavailable_exception, get_rls_session
from app.schemas.expenses import Expense, ExpenseCreateRequest, ExpenseUpdateRequest, ExpensesListResponse


router = APIRouter(prefix="/workspaces/{workspace_id}/expenses", tags=["expenses"])


def error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def not_found() -> HTTPException:
    return error(status.HTTP_404_NOT_FOUND, "not_found", "Workspace not found.")


def forbidden() -> HTTPException:
    return error(status.HTTP_403_FORBIDDEN, "forbidden", "You do not have permission to do that.")


def invalid_category() -> HTTPException:
    return error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "invalid_category",
        "Category is not valid for this workspace.",
    )


def category_archived() -> HTTPException:
    return error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "category_archived",
        "Category is archived.",
    )


def invalid_amount() -> HTTPException:
    return error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "invalid_amount",
        "Amount must be greater than zero.",
    )


def invalid_date() -> HTTPException:
    return error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "invalid_date",
        "Date is required.",
    )


def _expense_from_row(row) -> Expense:
    return Expense(
        id=row.id,
        amount_minor=row.amount_minor,
        currency=row.currency,
        occurred_on=row.occurred_on,
        category_id=row.category_id,
        description=row.description,
        merchant_name=row.merchant_name,
        status=row.status,
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
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


async def _expense(session: AsyncSession, workspace_id: UUID, expense_id: UUID):
    result = await session.execute(
        text(
            """
            select id, amount_minor, currency, occurred_on, category_id, description,
                   merchant_name, status, created_by, created_at, updated_at
            from public.expenses
            where workspace_id = :workspace_id
              and id = :expense_id
              and status = 'confirmed'
            """
        ),
        {"workspace_id": str(workspace_id), "expense_id": str(expense_id)},
    )
    return result.first()


def _can_mutate_expense(role: str, user_id: UUID, expense_row) -> bool:
    if role in {"owner", "admin"}:
        return True
    if role == "member" and str(expense_row.created_by) == str(user_id):
        return True
    return False


async def _validate_category(
    session: AsyncSession, workspace_id: UUID, category_id: UUID | None
) -> None:
    if category_id is None:
        return

    result = await session.execute(
        text(
            """
            select workspace_id, is_archived
            from public.categories
            where id = :category_id
            """
        ),
        {"category_id": str(category_id)},
    )
    row = result.first()
    if row is None or str(row.workspace_id) != str(workspace_id):
        raise invalid_category()
    if row.is_archived:
        raise category_archived()


def _raise_from_db_error(exc: SQLAlchemyError) -> None:
    message = str(exc).lower()
    if "category_archived" in message:
        raise category_archived() from exc
    if "category_not_in_workspace" in message or "foreign key" in message:
        raise invalid_category() from exc
    raise exc


def _raise_from_insert_error(exc: DBAPIError) -> None:
    message = str(exc).lower()
    if "category_archived" in message or "category_not_in_workspace" in message or "foreign key" in message:
        _raise_from_db_error(exc)
    raise database_unavailable_exception(exc) from exc


@router.get("", response_model=ExpensesListResponse)
async def list_expenses(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> ExpensesListResponse:
    await _workspace_role(session, workspace_id, current_user.user_id)
    try:
        result = await session.execute(
            text(
                """
                select id, amount_minor, currency, occurred_on, category_id, description,
                       merchant_name, status, created_by, created_at, updated_at
                from public.expenses
                where workspace_id = :workspace_id
                  and status = 'confirmed'
                order by occurred_on desc, created_at desc
                """
            ),
            {"workspace_id": str(workspace_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    return ExpensesListResponse(expenses=[_expense_from_row(row) for row in result])


@router.post("", response_model=Expense, status_code=status.HTTP_201_CREATED)
async def create_expense(
    workspace_id: UUID,
    request: ExpenseCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Expense:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if role not in {"owner", "admin", "member"}:
        raise forbidden()

    await _validate_category(session, workspace_id, request.category_id)

    try:
        result = await session.execute(
            text(
                """
                insert into public.expenses(
                    workspace_id, created_by, category_id, amount_minor, occurred_on,
                    description, merchant_name
                )
                values (
                    :workspace_id, :created_by, :category_id, :amount_minor, :occurred_on,
                    :description, :merchant_name
                )
                returning id, amount_minor, currency, occurred_on, category_id, description,
                          merchant_name, status, created_by, created_at, updated_at
                """
            ),
            {
                "workspace_id": str(workspace_id),
                "created_by": str(current_user.user_id),
                "category_id": str(request.category_id) if request.category_id else None,
                "amount_minor": request.amount_minor,
                "occurred_on": request.occurred_on,
                "description": request.description,
                "merchant_name": request.merchant_name,
            },
        )
    except DBAPIError as exc:
        _raise_from_insert_error(exc)
    except SQLAlchemyError as exc:
        _raise_from_db_error(exc)

    row = result.first()
    if row is None:
        raise not_found()
    return _expense_from_row(row)


@router.get("/{expense_id}", response_model=Expense)
async def get_expense(
    workspace_id: UUID,
    expense_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Expense:
    await _workspace_role(session, workspace_id, current_user.user_id)
    try:
        row = await _expense(session, workspace_id, expense_id)
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    if row is None:
        raise not_found()
    return _expense_from_row(row)


@router.patch("/{expense_id}", response_model=Expense)
async def update_expense(
    workspace_id: UUID,
    expense_id: UUID,
    request: ExpenseUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Expense:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if "amount_minor" in request.model_fields_set and request.amount_minor is None:
        raise invalid_amount()
    if "occurred_on" in request.model_fields_set and request.occurred_on is None:
        raise invalid_date()

    try:
        existing = await _expense(session, workspace_id, expense_id)
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    if existing is None:
        raise not_found()
    if not _can_mutate_expense(role, current_user.user_id, existing):
        raise forbidden()

    if (
        "category_id" in request.model_fields_set
        and str(request.category_id) != str(existing.category_id)
    ):
        await _validate_category(session, workspace_id, request.category_id)

    assignments: list[str] = []
    params = {"workspace_id": str(workspace_id), "expense_id": str(expense_id)}
    for field in ("amount_minor", "occurred_on", "category_id", "description", "merchant_name"):
        if field in request.model_fields_set:
            assignments.append(f"{field} = :{field}")
            value = getattr(request, field)
            params[field] = str(value) if field == "category_id" and value else value

    try:
        result = await session.execute(
            text(
                f"""
                update public.expenses
                set {", ".join(assignments)}
                where workspace_id = :workspace_id
                  and id = :expense_id
                  and status = 'confirmed'
                returning id, amount_minor, currency, occurred_on, category_id, description,
                          merchant_name, status, created_by, created_at, updated_at
                """
            ),
            params,
        )
    except DBAPIError as exc:
        _raise_from_insert_error(exc)
    except SQLAlchemyError as exc:
        _raise_from_db_error(exc)

    row = result.first()
    if row is None:
        raise not_found()
    return _expense_from_row(row)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    workspace_id: UUID,
    expense_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Response:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    try:
        existing = await _expense(session, workspace_id, expense_id)
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    if existing is None:
        raise not_found()
    if not _can_mutate_expense(role, current_user.user_id, existing):
        raise forbidden()

    try:
        result = await session.execute(
            text(
                """
                update public.expenses
                set status = 'deleted',
                    deleted_at = now()
                where workspace_id = :workspace_id
                  and id = :expense_id
                  and status = 'confirmed'
                returning id
                """
            ),
            {"workspace_id": str(workspace_id), "expense_id": str(expense_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    if result.first() is None:
        raise not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
