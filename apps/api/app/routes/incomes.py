from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import database_unavailable_exception, get_rls_session
from app.schemas.incomes import Income, IncomeCreateRequest, IncomeUpdateRequest, IncomesListResponse


router = APIRouter(prefix="/workspaces/{workspace_id}/incomes", tags=["incomes"])


def error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def not_found() -> HTTPException:
    return error(status.HTTP_404_NOT_FOUND, "not_found", "Workspace not found.")


def forbidden() -> HTTPException:
    return error(status.HTTP_403_FORBIDDEN, "forbidden", "You do not have permission to do that.")


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


def _income_from_row(row) -> Income:
    return Income(
        id=row.id,
        amount_minor=row.amount_minor,
        currency=row.currency,
        occurred_on=row.occurred_on,
        description=row.description,
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


async def _income(session: AsyncSession, workspace_id: UUID, income_id: UUID):
    result = await session.execute(
        text(
            """
            select id, amount_minor, currency, occurred_on, description, status,
                   created_by, created_at, updated_at
            from public.incomes
            where workspace_id = :workspace_id
              and id = :income_id
              and status = 'confirmed'
            """
        ),
        {"workspace_id": str(workspace_id), "income_id": str(income_id)},
    )
    return result.first()


@router.get("", response_model=IncomesListResponse)
async def list_incomes(
    workspace_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> IncomesListResponse:
    await _workspace_role(session, workspace_id, current_user.user_id)
    try:
        result = await session.execute(
            text(
                """
                select id, amount_minor, currency, occurred_on, description, status,
                       created_by, created_at, updated_at
                from public.incomes
                where workspace_id = :workspace_id
                  and status = 'confirmed'
                order by occurred_on desc, created_at desc
                """
            ),
            {"workspace_id": str(workspace_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    return IncomesListResponse(incomes=[_income_from_row(row) for row in result])


@router.post("", response_model=Income, status_code=status.HTTP_201_CREATED)
async def create_income(
    workspace_id: UUID,
    request: IncomeCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Income:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if role not in {"owner", "admin"}:
        raise forbidden()
    if request.amount_minor <= 0:
        raise invalid_amount()

    try:
        result = await session.execute(
            text(
                """
                insert into public.incomes(
                    workspace_id, created_by, amount_minor, currency, occurred_on, description
                )
                values (
                    :workspace_id,
                    :created_by,
                    :amount_minor,
                    (select currency from public.workspaces where id = :workspace_id),
                    :occurred_on,
                    :description
                )
                returning id, amount_minor, currency, occurred_on, description, status,
                          created_by, created_at, updated_at
                """
            ),
            {
                "workspace_id": str(workspace_id),
                "created_by": str(current_user.user_id),
                "amount_minor": request.amount_minor,
                "occurred_on": request.occurred_on,
                "description": request.description,
            },
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    except SQLAlchemyError as exc:
        raise database_unavailable_exception() from exc

    row = result.first()
    if row is None:
        raise not_found()
    return _income_from_row(row)


@router.get("/{income_id}", response_model=Income)
async def get_income(
    workspace_id: UUID,
    income_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Income:
    await _workspace_role(session, workspace_id, current_user.user_id)
    try:
        row = await _income(session, workspace_id, income_id)
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    if row is None:
        raise not_found()
    return _income_from_row(row)


@router.patch("/{income_id}", response_model=Income)
async def update_income(
    workspace_id: UUID,
    income_id: UUID,
    request: IncomeUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Income:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if role not in {"owner", "admin"}:
        raise forbidden()
    if "amount_minor" in request.model_fields_set and (
        request.amount_minor is None or request.amount_minor <= 0
    ):
        raise invalid_amount()
    if "occurred_on" in request.model_fields_set and request.occurred_on is None:
        raise invalid_date()

    assignments: list[str] = []
    params = {"workspace_id": str(workspace_id), "income_id": str(income_id)}
    for field in ("amount_minor", "occurred_on", "description"):
        if field in request.model_fields_set:
            assignments.append(f"{field} = :{field}")
            params[field] = getattr(request, field)

    try:
        result = await session.execute(
            text(
                f"""
                update public.incomes
                set {", ".join(assignments)}
                where workspace_id = :workspace_id
                  and id = :income_id
                  and status = 'confirmed'
                returning id, amount_minor, currency, occurred_on, description, status,
                          created_by, created_at, updated_at
                """
            ),
            params,
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    row = result.first()
    if row is None:
        raise not_found()
    return _income_from_row(row)


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(
    workspace_id: UUID,
    income_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> Response:
    role = await _workspace_role(session, workspace_id, current_user.user_id)
    if role not in {"owner", "admin"}:
        raise forbidden()

    try:
        result = await session.execute(
            text(
                """
                update public.incomes
                set status = 'deleted',
                    deleted_at = now()
                where workspace_id = :workspace_id
                  and id = :income_id
                  and status = 'confirmed'
                returning id
                """
            ),
            {"workspace_id": str(workspace_id), "income_id": str(income_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    if result.first() is None:
        raise not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
