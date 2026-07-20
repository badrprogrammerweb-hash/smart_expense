from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db import database_unavailable_exception
from app.schemas.history import ActivityHistoryItem, HistoryPage


async def list_history(
    workspace_id: UUID,
    limit: int,
    before: datetime | None,
    session,
) -> HistoryPage:
    clauses = ["h.workspace_id = :workspace_id"]
    params: dict[str, object] = {"workspace_id": str(workspace_id), "limit": limit}

    if before is not None:
        clauses.append("h.created_at < :before")
        params["before"] = before

    try:
        result = await session.execute(
            text(
                f"""
                select
                    h.id,
                    h.event_type,
                    h.actor_user_id,
                    coalesce(nullif(up.display_name, ''), up.email) as actor_display_name,
                    h.entity_table,
                    h.entity_id,
                    case
                        when h.summary ? 'amount_minor' then
                            h.summary || jsonb_build_object(
                                'currency',
                                coalesce(h.summary ->> 'currency', w.currency)
                            )
                        else h.summary
                    end as summary,
                    h.created_at
                from public.activity_history h
                join public.workspaces w on w.id = h.workspace_id
                left join public.user_profiles up on up.id = h.actor_user_id
                where {" and ".join(clauses)}
                order by h.created_at desc, h.id desc
                limit :limit
                """
            ),
            params,
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    items = [
        ActivityHistoryItem(
            id=row.id,
            event_type=row.event_type,
            actor_user_id=row.actor_user_id,
            actor_display_name=row.actor_display_name,
            entity_table=row.entity_table,
            entity_id=row.entity_id,
            summary=row.summary,
            created_at=row.created_at,
        )
        for row in result
    ]
    next_before = items[-1].created_at if len(items) == limit else None
    return HistoryPage(items=items, next_before=next_before)
