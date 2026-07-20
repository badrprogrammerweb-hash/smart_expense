from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import database_unavailable_exception, get_rls_session
from app.schemas.users import LocaleUpdateRequest, LocaleUpdateResponse, UserProfile


router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserProfile)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> UserProfile:
    try:
        result = await session.execute(
            text(
                """
                select id, email, display_name, locale
                from public.user_profiles
                where id = :user_id
                """
            ),
            {"user_id": str(current_user.user_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    row = result.one()
    return UserProfile.model_validate(row._mapping)


@router.patch("/me", response_model=LocaleUpdateResponse)
async def update_me(
    request: LocaleUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_rls_session),
) -> LocaleUpdateResponse:
    try:
        result = await session.execute(
            text(
                """
                update public.user_profiles
                set locale = :locale
                where id = :user_id
                returning id, locale
                """
            ),
            {"locale": request.locale, "user_id": str(current_user.user_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    row = result.one()
    return LocaleUpdateResponse.model_validate(row._mapping)
