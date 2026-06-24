# Phase 2 Data Model: Authentication and Workspace Foundation

Three tables are introduced this phase, plus the Supabase-managed
`auth.users` table this design depends on but does not modify directly.
Every constraint below is enforced at the database level (RLS policy,
`CHECK` constraint, or trigger), per Research Decisions 4 and 8 — none of
these rules rely on FastAPI being the only caller.

## user_profiles

Maps 1:1 to a Supabase Auth user. Created by the signup trigger (Research
Decision 2), never created directly by application code.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Equal to `auth.users.id`; FK with `ON DELETE CASCADE` |
| `email` | text | Denormalized from `auth.users.email` for convenient display/lookup (FR-009: adding a member by email) |
| `display_name` | text, nullable | Optional; no UI exists yet to set it (Phase 5) |
| `created_at` | timestamptz | Set on insert |

**RLS**: `SELECT`/`UPDATE` of one's own row allowed where `id = auth.uid()`.
No `DELETE` policy (profile lifecycle follows the auth user, not an
app-level delete). Two additional, narrowly-scoped mechanisms cover the two
places this phase needs visibility into *another* user's profile, neither
of which allows unrestricted enumeration:

- Resolving a "by email" lookup during the add-member flow (FR-009) is
  implemented as a `find_user_profile_by_email()` `SECURITY DEFINER`
  function, not a `SELECT` policy — it returns at most one row for an exact
  email match, so it cannot be used to browse profiles.
- Listing a workspace's members (`GET /workspaces/{id}/members`, FR-020)
  needs each member's `email` from a plain join against
  `workspace_memberships`, which runs as the caller (not `SECURITY
  DEFINER`) and is therefore subject to RLS. A `SELECT` policy —
  `using (public.shares_workspace_with(user_profiles.id, auth.uid()))` —
  allows reading a profile only when the caller shares at least one
  workspace with that profile's owner. This is still bounded (FR-024): it
  grants visibility into co-members' profiles, not a global cross-row
  `SELECT`, so a user who shares no workspace with the caller remains
  invisible.

**Validation rules**: `email` non-null, unique (mirrors `auth.users`
uniqueness). One row per `auth.users` row (enforced by sharing the same PK,
not a separate uniqueness check).

## workspaces

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Generated on insert |
| `type` | text, `CHECK (type IN ('personal','team'))` | Fixed at creation; no FR allows changing type after creation |
| `name` | text | Display name; Owners/Admins may rename (FR-013/014) |
| `created_by` | uuid, FK → `user_profiles.id` | Audit field only — **not** an authority source; current ownership is always derived from `workspace_memberships` rows with `role = 'owner'`, never from this column |
| `created_at` | timestamptz | Set on insert |

There is deliberately no `owner_id` column: ownership is a membership fact
(possibly held by more than one row, since an Owner can promote a co-Owner
per FR-017/FR-031), not a workspace attribute. Keeping a single source of
truth avoids the two ever drifting out of sync.

**RLS**: `SELECT` allowed only where a `workspace_memberships` row exists
for `(id, auth.uid())` (FR-018, FR-019). `INSERT` allowed for any
authenticated user (creates the row; the `assign_workspace_owner()` trigger
— research.md Decision 2b — immediately inserts the creator's Owner
membership in the same transaction so the workspace is never briefly
member-less). `UPDATE` (name changes) allowed only where the
caller's membership role is `owner` or `admin`. **No `DELETE` policy
exists** — this directly enforces FR-029 (no deletion/archival capability
in this phase) at the database level, not just by omitting a route.

**Validation rules**: `name` non-empty. `type` immutable after insert
(enforced by a trigger rejecting `UPDATE` of the `type` column).

**State transitions**: none beyond creation — no archive/delete/restore
states exist this phase (FR-029).

## workspace_memberships

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Generated on insert |
| `workspace_id` | uuid, FK → `workspaces.id`, `ON DELETE CASCADE` | |
| `user_id` | uuid, FK → `user_profiles.id`, `ON DELETE CASCADE` | |
| `role` | text, `CHECK (role IN ('owner','admin','member','viewer'))` | FR-010, FR-011 |
| `created_at` | timestamptz | Set on insert |

`UNIQUE (workspace_id, user_id)` — a user has exactly one role per
workspace; this is also what makes the "duplicate add" clarification
(FR-032) enforceable at the constraint level (insert fails, FastAPI catches
the conflict and returns the clear non-sensitive message rather than a raw
constraint error).

**RLS**: `SELECT` allowed only where the caller has any membership row in
the same `workspace_id` (FR-018, FR-020). `INSERT` allowed only where the
caller's own membership role in that workspace is `owner` or `admin`, and
only with `role` in `('admin','member','viewer')` (Research Decision 7 —
Admins cannot grant Owner; only the `assign_workspace_owner()` trigger
(Decision 2b, fired by any `workspaces` insert) ever inserts the first
`owner` row, and only an existing Owner can later insert a co-Owner
row through the role-update path below). `UPDATE` of `role` allowed only
where: the caller's role is `owner` (may change any non-owner row to any
role, or promote to `owner`), or the caller's role is `admin` and the
target row's current and new role are both in
`('admin','member','viewer')` (Decision 7). `DELETE` allowed where the
caller's role is `owner`/`admin` and the target is not an `owner` row
(removal), **or** where the caller is deleting their own row and they are
not the workspace's sole remaining `owner` (voluntary leave, FR-031).

**Validation rules / triggers**:

- `BEFORE INSERT`: if the target workspace's `type = 'personal'`, reject
  unless this is the bootstrap insert for that workspace's only allowed
  member (enforces single-user personal workspaces, per spec Assumptions).
- `BEFORE INSERT`: if the target workspace's `type = 'team'` and it already
  has 10 membership rows, reject the insert (FR-030) and surface a
  member-limit error.
- `BEFORE DELETE` / `BEFORE UPDATE OF role`: if the row being removed or
  demoted has `role = 'owner'` and it is the only `owner` row for that
  `workspace_id`, reject (FR-017). The application layer checks
  `workspace.type` before issuing a self-delete (voluntary leave), so a
  personal workspace's sole member receives a distinct `403` ("not
  leavable") rather than reaching this trigger's generic `409` last-Owner
  denial — both deny the same row, but for two semantically different
  reasons (FR-031; see `contracts/workspace-members-api.md`).

**State transitions**: a row is created (add or bootstrap), its `role` may
change (promotion/demotion within the rules above), or it is deleted
(removal or voluntary leave). There is no "invited/pending" state in this
phase — adding a member is immediate, by email, against an existing
account only (spec Assumptions; FR-009).

## Out of scope for this phase

No `Income`, `Expense`, `Category`, `File`, `AI Settings`, `AI Extraction
Job`, `Report`, `Setting`, or `History` table is created here — those begin
in their respective later phases per the master implementation plan. No
workspace `DELETE` capability exists (FR-029). No invite-link or pending-
invitation state exists (spec Assumptions).
