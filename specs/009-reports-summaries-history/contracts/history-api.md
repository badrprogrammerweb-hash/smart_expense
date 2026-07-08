# Contract: Activity History API

FastAPI endpoint under the existing `/workspaces/{workspace_id}` prefix. Auth via
`get_current_user`, DB via `get_rls_session`, standard `{ "code", "message" }` error
envelope. Read-only (this phase adds no history write endpoint — entries are created
exclusively by database triggers, see history-schema.md).

---

## GET `/workspaces/{workspace_id}/history`

Return the workspace activity history, newest-first, paginated. **Owner/Admin only**
(FR-032).

**Query params**
| Param | Type | Rules |
|-------|------|-------|
| `limit` | int | default `50`, `ge=1`, `le=50` (FR-024a page size) |
| `before` | timestamptz (ISO) | optional keyset cursor; return entries strictly older than this `created_at` |

**Authorization**
- Resolve role via the existing membership lookup. Role ∈ {owner, admin} → allowed.
- Member/Viewer → `403 not_authorized` (FR-032). Backend check is defense-in-depth
  on top of the RLS `select` policy that already restricts the table to Owner/Admin.
- Non-member → `404 not_found` (do not reveal existence).

**Responses**
- `200` → `HistoryPage` `{ items: ActivityHistoryItem[], next_before: timestamptz | null }`
  - `ActivityHistoryItem = { id, event_type, actor_user_id, actor_display_name?,
    entity_table, entity_id, summary, created_at }`
  - Ordered `created_at desc, id desc` (keyset on the covering index).
  - `next_before` = the oldest returned entry's `created_at` when a full page was
    returned, else `null`.
- `401` → unauthenticated.
- `403 not_authorized` → Member/Viewer member.
- `404 not_found` → non-member.
- `503 database_unavailable` → DB error.

**Invariants**
- Every returned entry belongs to `workspace_id` (tenant isolation, FR-025, FR-030).
- Forward-only: entries exist only for mutations that occurred after the Phase 9
  migration; a workspace with only pre-migration records returns an empty page —
  **200 with `items: []`, not an error** (FR-022, SC — history empty state).
- `summary` carries only non-sensitive display context; never secrets/keys.
