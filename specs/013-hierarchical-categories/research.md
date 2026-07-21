# Phase 13 Research: Hierarchical Categories

All items below were previously open design questions; each is now resolved
so `/speckit-tasks` can proceed without further discovery. Format:
Decision / Rationale / Alternatives considered.

## 1. Storage shape: one FK column vs. separate main+subcategory columns on records

**Decision**: Keep exactly one nullable `category_id` column on `incomes` and
`expenses` (already exists on `expenses`; added to `incomes`). It points to
whichever level the user actually picked — a main-category row (`parent_id
is null`) or a subcategory row (`parent_id is not null`). The "effective
main category" for a record whose `category_id` points to a subcategory is
derived by resolving `parent_id` at query time (`coalesce(c.parent_id,
c.id)`).

**Rationale**: The user-facing model only ever has one meaningful level of
specificity per record (FR-004: a subcategory implies its parent; a record
never needs both stored independently since the relationship is
deterministic and capped at one level, per FR-002). One FK column is the
smallest change to `expenses` (no migration of existing data beyond adding
new columns to `categories`) and avoids a second column that could
disagree with the first (e.g., a subcategory whose `parent_id` doesn't
match a separately-stored main category id).

**Alternatives considered**: Two columns (`category_id` +
`subcategory_id`) on each record — rejected because it introduces a
consistency rule ("subcategory's parent must equal category_id") that the
single-column design gets for free from the `categories.parent_id` FK, and
because it would require a data migration to backfill `subcategory_id =
null` on every existing expense row for no behavioral gain.

## 2. Hierarchy depth enforcement

**Decision**: `categories.parent_id` is a nullable self-referencing FK. A
trigger (`validate_category_hierarchy`) enforces on insert/update of
`parent_id`: the parent must exist, must belong to the same workspace, must
have the same `category_type`, and must itself have `parent_id IS NULL`
(i.e., a subcategory can never become a parent — caps nesting at exactly
one level, FR-002).

**Rationale**: Postgres `CHECK` constraints cannot reference other rows, so
a trigger is required for cross-row invariants (consistent with the
existing `validate_expense_category` trigger pattern from Phase 3).

**Alternatives considered**: A separate `subcategories` table instead of
self-referencing `categories` — rejected as unnecessary duplication; a
single table with `parent_id` reuses all existing RLS policies, indexes,
and the archive/rename/reorder code paths for both levels, at the cost of
one small trigger.

## 3. Record type separation (income vs. expense trees)

**Decision**: Add `categories.category_type` (`'income' | 'expense'`,
`CHECK`, not null, no default carried over from Phase 3 — every row must
state its type explicitly going forward). A subcategory inherits its
parent's `category_type` (enforced by the same hierarchy trigger from
Decision 2); it is not stored redundantly-editable.

**Rationale**: Matches FR-001/FR-002 directly and lets existing per-record
validation triggers add a one-column equality check rather than needing a
parallel table.

## 4. Translated names for system-provided categories

**Decision**: Add `categories.is_system` (boolean, default `false`) and
`categories.translation_key` (nullable text, set only when `is_system` is
`true`, e.g. `restaurants`, `restaurants.dining_out`,
`salary`, `salary.primary_job`). `categories.name` continues to hold a
literal display string in all cases — for system rows it is the English
canonical name (fallback/history-display value); for user-created rows it
is the exact text the user typed. The backend API returns both `name` and
`translation_key` unchanged; the **frontend** resolves display text by
looking up `translation_key` in a new `categories.catalog.<key>` /
`categories.catalog.sub.<key>` namespace in `apps/web/messages/{en,ar}.json`
when present, falling back to `name` when `translation_key` is null.

**Rationale**: Every existing i18n string in this codebase (Phase 12) is
rendered client-side through `next-intl` message catalogs — there is no
precedent for the backend translating strings server-side, and introducing
one here would be a new, larger pattern for a single feature. Reusing the
existing client-rendering approach keeps this phase consistent with Phase
12's established architecture and requires zero new i18n infrastructure
(Assumption in spec.md).

**Alternatives considered**: Backend resolves the locale from
`user_profiles.locale` (or `Accept-Language`) and returns pre-translated
`name` strings — rejected: it would be the first server-rendered UI string
in the product, duplicates the message catalogs the frontend already
owns, and would need cache-busting whenever a user's locale changes
mid-session.

## 5. Effective availability when a parent is disabled

**Decision**: A subcategory is selectable only when both it and its parent
main category have `is_archived = false`. This is enforced at two layers:
(a) the `GET .../categories` listing endpoint filters out subcategories
whose parent is archived when `include_archived=false`; (b) the per-record
validation trigger (Decision 6) re-checks the parent's `is_archived` state
at write time regardless of what the client sent, so this can never be
bypassed by a stale client. Disabling a main category does **not** write to
its subcategories' own `is_archived` column — re-enabling the parent
instantly restores whichever subcategories were still individually active
(spec Clarification 2).

**Rationale**: Directly implements the accepted clarification; keeping the
child rows' own flags untouched avoids an expensive cascade write and
avoids losing information about which subcategories were already disabled
independently before the parent was disabled.

## 6. Per-record category validation triggers

**Decision**: Replace the single `validate_expense_category` trigger with
two triggers sharing one new helper function
`public.validate_category_assignment(category_id, workspace_id,
expected_type)`: `validate_expense_category` (expected_type = `'expense'`)
and `validate_income_category` (expected_type = `'income'`, new). Each
raises `category_not_in_workspace`, `category_type_mismatch`, or
`category_archived` (the last one covers both "category itself archived"
and "category's parent archived", per Decision 5).

**Rationale**: Mirrors the exact pattern already proven in Phase 3
(`validate_expense_category`), extended by one type check and one parent
lookup; a shared SQL function avoids duplicating the archived/parent logic
between the two triggers.

## 7. Uniqueness constraints

**Decision**: Two partial unique indexes replace the single Phase 3 index:
`categories_unique_active_main_name` on `(workspace_id, category_type,
lower(name))` where `parent_id is null and not is_archived`, and
`categories_unique_active_sub_name` on `(workspace_id, parent_id,
lower(name))` where `parent_id is not null and not is_archived`.

**Rationale**: Matches FR-012 exactly — duplicate names are only rejected
among active siblings at the same level under the same parent (main
categories of the same type, or subcategories of the same parent); an
archived category's name (at either level) can be reused, exactly as
Phase 3 already allowed for the flat list.

## 8. Default catalog seeding and existing-workspace backfill

**Decision**: Extend the existing `seed_default_categories()` trigger
(fires `AFTER INSERT` on `workspaces`) to insert both trees — the 15
existing expense main categories (unchanged names, now with `category_type
= 'expense'`, `is_system = true`, and a `translation_key` per category) plus
their default subcategories, and the new 5 income main categories with
their default subcategories (full list in data-model.md) — for **new**
workspaces. Separately, the migration script performs a **one-time
backfill** for every existing workspace: (a) it identifies each existing
category row whose `lower(name)` exactly matches one of the 15 original
default names and stamps it `is_system = true` with the matching
`translation_key` (rows that don't match, including anything already
renamed, are left as `is_system = false`, i.e. treated as user-created —
safe under-tagging per spec Edge Cases); (b) for every workspace, it
inserts the new default subcategories under whichever row currently
carries each matched `translation_key` (not by name, so a subsequent
rename never breaks the linkage established at migration time); (c) for
every workspace, it inserts the entire new income tree exactly as a new
workspace would receive it. This directly implements
FR-015a / Clarification 1.

**Rationale**: A single migration script keeps "new workspace" and
"existing workspace" on the same seed data, satisfying the clarified
requirement that every workspace — old or new — ends up with the same
expanded catalog, while never guessing at (and never overwriting) a
category a user has already renamed or archived.

**Alternatives considered**: Only seeding new workspaces and leaving
existing ones with the old flat expense list and no income categories —
rejected per Clarification 1 (would create a two-tier product experience
based on signup date).

## 9. AI extraction category suggestions

**Decision**: `ExtractionDraft` gains `suggested_category_id: UUID | None`
alongside the existing free-text `suggested_category: str | None` (kept for
backward-compatible display of the model's raw text when no confident
match exists). The extraction service passes the workspace's currently
*active* category catalog (main + subcategory names, scoped to the
record's type) into the AI prompt as the closed set of valid choices, and
asks the model to pick zero, one (main only), or two (main + sub) names
from that exact list. The backend resolves the model's chosen name(s) to
the corresponding active category/subcategory id via an exact
case-insensitive match against that same active catalog snapshot; if the
model returns something outside the list, `suggested_category_id` stays
`null` and only the raw text is kept for the user's reference.
`ConfirmExtractionRequest.category_id` is unchanged (already generic — it
accepts whichever level, main or sub, the user confirms).

**Rationale**: Constraining the prompt to the workspace's own active
catalog makes FR-020 ("never pre-fill a disabled suggestion") true by
construction — a disabled category is never in the candidate list offered
to the model — rather than needing a second filtering pass after the
model responds. This is the same "manual review before confirm" boundary
already governed by Constitution Principle V; nothing about that guarantee
changes.

**Alternatives considered**: Free-text fuzzy matching against the full
(including disabled) catalog post-hoc — rejected as more complex and
strictly weaker (it can still surface a disabled category name that
happens to fuzzy-match, requiring the exact filter this decision avoids
needing).

## 10. Reports category breakdown and subcategory drill-down

**Decision**: `dashboard.get_category_breakdown` (reused by both the
dashboard and reports endpoints) is rewritten to group by the *resolved
main category* (`coalesce(c.parent_id, c.id)`), not the raw stored
`category_id`, joining twice (once to the record's own category row, once
to that row's parent when it has one) to get the main category's name.
Expense and income breakdowns are computed and returned separately
(`category_breakdown` stays expense-focused as today; a new
`income_category_breakdown` list is added to `ReportData` with the same
item shape) rather than merged into one list, since expense and income
categories are different trees. A new endpoint,
`GET /workspaces/{workspace_id}/reports/category-breakdown/{main_category_id}/subcategories`,
returns the same period's amounts grouped by subcategory under that one
main category, including an explicit `subcategory_id: null,
subcategory_name: "<localized 'No subcategory'>"` bucket for records whose
`category_id` points directly at the main category with no subcategory
chosen (FR-016).

**Rationale**: Keeping expense/income breakdowns as two separate lists
avoids conflating two independent trees into one ambiguous
`category_name` list; a dedicated drill-down endpoint keeps the main
reports payload small (most users never open a drill-down) while still
satisfying "reports can summarize by main category and drill into
subcategories" (exit criteria) for both record types.

**Alternatives considered**: Returning the full subcategory breakdown
inline for every main category on every report load — rejected as
unnecessary payload growth for a detail view most requests won't use.

## 11. Deletion of unused categories/subcategories

**Decision**: Add a `DELETE` RLS policy (owner/admin only, same role gate
as create/update) plus a `BEFORE DELETE` trigger
(`prevent_referenced_category_delete`) that raises
`category_has_references` if any `incomes`/`expenses` row references the
category, or (for a main category) if it still has any child subcategory
row (of any archived state) — the caller must remove/reassign children
first. The API layer surfaces this as `409 category_has_references`.

**Rationale**: Implements FR-014 minimally — this is a safety-valve for
genuinely unused rows (e.g., a typo fixed by deleting-and-recreating
rather than renaming), not a bulk-cleanup feature, matching the spec's
Assumptions note that this is expected to be rarely used.

## 12. History tracking for the newly-introduced hard delete

**Decision**: Extend the existing `public.record_activity()` trigger function's
`categories` branch with a `tg_op = 'DELETE'` check (evaluated before the
existing archive/update checks, matching the pattern already used for
`workspace_memberships`) that sets `v_event_type := 'category_deleted'`, add
`'category_deleted'` to the `public.activity_history.event_type` `CHECK`
constraint, and add `ActivityEventType.CATEGORY_DELETED = "category_deleted"`
to `apps/api/app/schemas/history.py`. Subcategories reuse the same
`category_created`/`category_updated`/`category_archived`/`category_deleted`
event types as main categories (no separate `subcategory_*` events) — the
existing `entity_table`/`entity_id`/`summary` columns already identify which
row changed.

**Rationale**: `record_activity()`'s `categories` branch (Phase 9,
`20260708000000_reports_history.sql`) currently has no `DELETE` case, so
`v_event_type` stays `null` and the function's `if v_event_type is null then
... return; end if;` guard silently skips writing any history row. That was
harmless before this phase because no endpoint ever hard-deleted a category
(Phase 3 explicitly had "no `DELETE` policy"). This phase introduces exactly
that capability (FR-014, research.md Decision 11), so leaving the trigger
unchanged would create a silent gap in the audit trail the moment a category
is deleted — violating Constitution Principle XII's requirement to track
"record created, updated, deleted" practically. `incomes`, `expenses`, and
`files` all already have an explicit delete-related branch; `categories`
must gain the same to stay consistent.

## 13. Delete-guard must not block workspace-cascade teardown

**Decision**: `prevent_referenced_category_delete()` first checks whether
the category's own `workspace_id` still exists in `public.workspaces`; if
not, it returns immediately without raising, allowing the delete to
proceed. The `category_has_references` guard only applies when the
workspace itself still exists (i.e., a standalone delete through the
category-management API).

**Rationale**: Discovered by direct testing against the local stack during
implementation (not by static review): `workspaces` cascades `ON DELETE
CASCADE` to `categories` (and to `incomes`/`expenses`/`workspace_memberships`
etc.), which is the mechanism behind account deletion
(`auth.users` → `user_profiles` → `workspaces`, all `ON DELETE CASCADE`).
Every seeded workspace has main categories with subcategory children by
construction (this phase's own default catalog), so an unqualified
"has children → block" guard would deterministically abort **every**
workspace-cascade teardown, 100% of the time — not a rare edge case. The
fix confines the guard to its intended purpose (protecting a single
category from being deleted out from under other data through the
management API) without weakening it: FR-014 is still fully enforced for
every path that matters (the workspace is not simultaneously being torn
down).

**Discovered, out-of-scope risk (not fixed here)**: The same local testing
surfaced two **pre-existing**, Phase-13-unrelated gaps that would also
block a full workspace-cascade teardown if one were ever triggered: (1)
`workspace_memberships_protect_last_owner_delete` (Phase 2) has no
"workspace already gone" escape hatch, so it blocks the cascade delete of
the last owner's membership row; (2) `record_activity()` (Phase 9) attempts
to `INSERT INTO activity_history(workspace_id, ...)` for `DELETE`-triggered
events (`member_removed`, `file_deleted`, and now `category_deleted`)
without checking whether the workspace row is still present, which
violates `activity_history_workspace_id_fkey` once the workspace row is
already gone mid-cascade. Neither is exercised today because no
application-level "delete workspace" or "delete account" endpoint exists
yet, but both would need the same "workspace already gone → skip" fix
applied here before any future phase adds one. Flagged for whichever phase
introduces account/workspace deletion, not fixed in Phase 13 (out of this
phase's declared scope — Phase 2 and Phase 9 code, not Phase 13's).

## 14. Existing endpoint/tests inventory touched this phase

**Decision**: Confirmed by reading current source — `apps/api/app/routes/
categories.py`, `apps/api/app/schemas/categories.py`,
`apps/api/app/routes/incomes.py`, `apps/api/app/schemas/incomes.py`,
`apps/api/app/schemas/extractions.py`, `apps/api/app/services/
dashboard.py`, `apps/api/app/schemas/dashboard.py`, `apps/api/app/schemas/
reports.py`, `apps/web/lib/api/categories.ts`, `apps/web/hooks/
use-categories.ts`, `apps/web/components/category/*`, `apps/web/messages/
{en,ar}.json`. No new third-party dependency is introduced in either app;
this phase is schema + endpoint + UI + message-catalog work on the existing
FastAPI/Next.js/Supabase Postgres stack.
