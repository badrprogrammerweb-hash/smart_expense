# Phase 3 Data Model: Income, Expense, and Category Core

Three tables are introduced this phase, all foreign-keyed to the
`workspaces` and `user_profiles` tables Phase 2 created. Every constraint
below is enforced at the database level (RLS policy, `CHECK` constraint,
unique index, or trigger), per this project's established pattern
(Phase 2 research.md Decisions 4 and 8) — none of these rules rely on
FastAPI being the only caller.

## categories

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Generated on insert |
| `workspace_id` | uuid, FK → `workspaces.id`, `ON DELETE CASCADE` | |
| `name` | text | Display label; `CHECK (length(btrim(name)) > 0)` |
| `sort_order` | integer, not null | Display order within the workspace (FR-022) |
| `is_archived` | boolean, not null, default `false` | Archived categories are hidden from new-expense selection but never hard-deleted (FR-020/FR-021) |
| `created_at` | timestamptz | Set on insert |
| `updated_at` | timestamptz | Bumped on every update (rename, archive, reorder) |

`create unique index categories_unique_active_name on categories
(workspace_id, lower(name)) where not is_archived` — enforces FR-018
(reject a duplicate name only among active categories; an archived
category's name can be reused) (research.md Decision 8).

**RLS**: `SELECT` allowed to any workspace member (FR-011). `INSERT` and
`UPDATE` (rename, archive/unarchive, `sort_order` change) allowed only
where the caller's `workspace_role_for()` is `owner` or `admin`
(research.md Decision 3). **No `DELETE` policy exists** — categories are
never hard-deleted this phase (FR-020).

**Validation rules**: `name` non-empty; unique (case-insensitive) among
active categories in the same workspace.

**State transitions**: created (default or custom) → may be renamed any
number of times → may be archived. An archived category cannot currently
be unarchived through any FR in this phase's spec, but the `is_archived`
boolean and its RLS `UPDATE` policy don't prevent adding that later
without a schema change.

**Seeding**: `seed_default_categories()` — a `SECURITY DEFINER` trigger
fires `AFTER INSERT` on `workspaces` (personal or team) and inserts the
constitution's 15-item Saudi-first default set (`sort_order` 0–14):
Restaurants, Groceries, Fuel, Transportation, Rent, Utilities, Internet &
Mobile, Health, Education, Family, Shopping, Entertainment, Travel,
Subscriptions, Other (research.md Decision 7).

## incomes

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Generated on insert |
| `workspace_id` | uuid, FK → `workspaces.id`, `ON DELETE CASCADE` | |
| `created_by` | uuid, FK → `user_profiles.id`, `ON DELETE RESTRICT` | Deliberately not `CASCADE` — research.md Decision 9 |
| `amount_minor` | bigint | `CHECK (amount_minor > 0)` (FR-025) |
| `currency` | text, not null, default `'SAR'` | `CHECK (currency = 'SAR')` this phase (FR-024) |
| `occurred_on` | date, not null | The income's date; no time-of-day component (FR-026) |
| `description` | text, nullable | Optional free text (FR-001) |
| `status` | text, not null, default `'confirmed'` | `CHECK (status in ('confirmed', 'deleted'))` — extensible for a future AI-extraction phase's draft/pending states (research.md Decision 4) |
| `deleted_at` | timestamptz, nullable | Set when `status` transitions to `'deleted'` |
| `created_at` | timestamptz | Set on insert |
| `updated_at` | timestamptz | Bumped on every edit, including soft-delete |

**RLS**: `SELECT` allowed to any workspace member (FR-011). `INSERT`
allowed only where the caller's `workspace_role_for()` is `owner` or
`admin` (FR-014, research.md Decision 2). `UPDATE` (edit any field,
including the soft-delete transition) allowed only where the caller's
role is `owner` or `admin` (FR-012) — Members have no income permissions
at all this phase, so no "own record" carve-out applies here, unlike
`expenses` below. **No hard `DELETE` policy exists**; deletion is always
the soft-delete `UPDATE` path (FR-007, Clarification 3: no restore).

**Validation rules**: `amount_minor > 0`; `occurred_on` required;
`currency = 'SAR'`.

**State transitions**: `confirmed` (on insert, immediately — FR-004) →
`deleted` (on soft-delete; terminal this phase, no restore path per
Clarification 3).

## expenses

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Generated on insert |
| `workspace_id` | uuid, FK → `workspaces.id`, `ON DELETE CASCADE` | |
| `created_by` | uuid, FK → `user_profiles.id`, `ON DELETE RESTRICT` | Deliberately not `CASCADE` — research.md Decision 9 |
| `category_id` | uuid, nullable, FK → `categories.id`, `ON DELETE RESTRICT` | Optional (FR-003); restricted rather than cascading because categories are never hard-deleted, so this should never fire in practice |
| `amount_minor` | bigint | `CHECK (amount_minor > 0)` (FR-025) |
| `currency` | text, not null, default `'SAR'` | `CHECK (currency = 'SAR')` this phase (FR-024) |
| `occurred_on` | date, not null | The expense's date (FR-026) |
| `description` | text, nullable | Optional free text (FR-002) |
| `merchant_name` | text, nullable | Distinct from `description` (FR-002, Clarification 1, research.md Decision 6) |
| `status` | text, not null, default `'confirmed'` | Same model as `incomes.status` (research.md Decision 4) |
| `deleted_at` | timestamptz, nullable | Set when `status` transitions to `'deleted'` |
| `created_at` | timestamptz | Set on insert |
| `updated_at` | timestamptz | Bumped on every edit, including soft-delete |

No `receipt_file_id` or similar column exists this phase (research.md
Decision 10) — Phase 6 adds that column when the `files` table exists.

**RLS**: `SELECT` allowed to any workspace member (FR-011). `INSERT`
allowed to any caller whose role is `owner`, `admin`, or `member` — not
`viewer` (FR-002, FR-013, FR-015). `UPDATE` (edit any field, including
the soft-delete transition) allowed where: the caller's role is `owner`
or `admin` (may edit/delete any expense in the workspace, FR-012), **or**
the caller's role is `member` and `expenses.created_by = auth.uid()` (may
edit/delete only the expense they created, FR-013). Viewers have no
`INSERT`/`UPDATE` access at all (FR-015). **No hard `DELETE` policy
exists**; deletion is always the soft-delete `UPDATE` path (FR-007,
Clarification 3: no restore). No row-level locking or `version` column
guards concurrent edits — the most recent committed `UPDATE` simply wins
(Clarification 2, research.md Decision 5).

**Validation rules**: `amount_minor > 0`; `occurred_on` required;
`currency = 'SAR'`; `category_id`, if newly set or changed, must reference
an active (non-archived) category in the same `workspace_id` (enforced by
a trigger, since a plain FK cannot compare two columns across tables, and
cannot express the "must not be archived" rule — see below).

**State transitions**: `confirmed` (on insert, immediately — FR-004) →
`deleted` (on soft-delete; terminal this phase, no restore path per
Clarification 3).

**Cross-table trigger**: `BEFORE INSERT OR UPDATE OF category_id` on
`expenses` — when `category_id` is being set or changed (on `INSERT`, or
on `UPDATE` where the new value differs from the old), reject
(`category_not_in_workspace`) unless a row exists in `categories` with
that `id` and the same `workspace_id` as the expense; reject
(`category_archived`) when that category exists in the right workspace
but `is_archived = true`. This prevents assigning a category from a
different workspace (impossible to express with a plain foreign key
alone) and enforces FR-021's "not selectable for new expenses" rule at
the database level, not only as a UI dropdown filter. Editing an expense
*without* changing `category_id` never re-triggers this check, so an
expense that already references a category before it was archived keeps
that reference untouched (FR-021's "keep ... intact" half).

## Out of scope for this phase

No `File`, `AI Settings`, `AI Extraction Job`, `Report`, `Setting`, or
`History` table is created here — those begin in their respective later
phases per the master implementation plan. No restore/undelete path
exists for `incomes` or `expenses` (Clarification 3). No
optimistic-locking/version column exists (Clarification 2). No
aggregation view, materialized total, or dashboard endpoint is created
this phase (research.md Decision 11) — Phase 4 owns computing remaining
balance and totals from the `confirmed`-status rows this phase produces.
