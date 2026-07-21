---

description: "Task list for Phase 13 — Hierarchical Categories"
---

# Tasks: Hierarchical Categories

**Input**: Design documents from `/specs/013-hierarchical-categories/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included. The constitution's Testing Requirements principle (XIV) mandates coverage for
this phase's risk areas (category hierarchy validation, tenant/type isolation, the
existing-workspace migration backfill, and non-regression of financial totals and AR/EN
behavior), and every prior phase (003–012) in this project included test tasks as a matter of
course.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to US1–US4 from spec.md
- File paths are exact and repo-relative

## Path Conventions

Existing web-application monolith: `apps/api/app/**` (FastAPI backend), `apps/api/tests/**`
(pytest), `apps/web/**` (Next.js frontend), `supabase/migrations/**` (tracked SQL). No new
top-level directories are introduced.

---

## Phase 1: Setup

**Purpose**: Confirm the local environment matches the tracked schema baseline before adding new
schema, and gather the real pre-migration data shape the backfill logic must handle.

- [X] T001 Reconcile any local Supabase migration drift against the tracked history (per the known
      Phase 8 stray-DB-state note: local `psql`-applied changes are not always reflected in
      `supabase migration up`) so the local stack's applied schema exactly matches
      `supabase/migrations/20260720010000_ai_extraction_confirm_workspace_currency.sql` before this
      phase's migration is written.
- [X] T002 [P] Query every local test workspace's current `public.categories` rows (name,
      `is_archived`, `sort_order`) to confirm which ones still match the 15 constitution default
      names verbatim vs. which have been renamed/archived, validating the backfill matching
      assumption in research.md Decision 8 before writing the migration.

**Checkpoint**: Local schema state and pre-migration category data shape are known before Phase 2
begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, triggers, seed data, and shared backend/frontend types every user story in
this phase depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Write migration `supabase/migrations/20260722000000_hierarchical_categories.sql`,
      part 1: add `category_type text not null` (`CHECK` in `('income','expense')`, backfilled to
      `'expense'` for existing rows), `parent_id uuid null references categories(id) on delete
      restrict`, `is_system boolean not null default false`, `translation_key text null` to
      `public.categories`, per data-model.md "categories (altered)".
- [X] T004 In the same migration, part 2: add the `validate_category_hierarchy` trigger
      (`BEFORE INSERT OR UPDATE OF parent_id, category_type`) enforcing same-workspace,
      same-`category_type`, and parent-has-no-parent (depth ≤ 2), raising
      `invalid_parent_category` — data-model.md "Hierarchy integrity", research.md Decision 2.
- [X] T005 In the same migration, part 3: drop the Phase 3
      `categories_unique_active_name` index and create
      `categories_unique_active_main_name` and `categories_unique_active_sub_name` partial unique
      indexes exactly as specified in data-model.md "Uniqueness".
- [X] T006 In the same migration, part 4: add `public.incomes.category_id uuid null references
      categories(id) on delete restrict`.
- [X] T007 In the same migration, part 5: create the shared SQL function
      `validate_category_assignment(category_id uuid, workspace_id uuid, expected_type text)`
      (checks workspace match, `category_type` match, own `is_archived`, and parent's
      `is_archived` when the category is a subcategory — data-model.md, research.md Decisions 5–6),
      then rewrite `validate_expense_category` and add `validate_income_category` as thin triggers
      calling it with `expected_type` `'expense'`/`'income'` respectively.
- [X] T008 In the same migration, part 6: add the `prevent_referenced_category_delete`
      `BEFORE DELETE` trigger (raises `category_has_references` if any `incomes`/`expenses` row
      references the category or it still has a child subcategory row, but only when the owning
      workspace still exists — a no-op during workspace-cascade teardown, since every seeded
      workspace has main categories with children by construction and would otherwise
      deterministically break account/workspace deletion; research.md Decision 13, found by direct
      testing during implementation) and a `DELETE` RLS policy on `public.categories` gated to
      `owner`/`admin`, per research.md Decision 11. In the same
      migration part, add `'category_deleted'` to the `public.activity_history.event_type` `CHECK`
      constraint and add a `tg_op = 'DELETE'` branch (checked first, before the existing
      archive/update checks) to the `categories` section of `public.record_activity()` that emits
      it — the existing Phase 9 trigger has no `DELETE` case for `categories` and would otherwise
      silently skip logging the newly-introduced hard delete (research.md Decision 12). Also add
      `CATEGORY_DELETED = "category_deleted"` to `ActivityEventType` in
      `apps/api/app/schemas/history.py` to match.
- [X] T009 In the same migration, part 7: rewrite `seed_default_categories()` so it seeds, for
      every **newly inserted** workspace, both trees with `is_system = true` and the matching
      `translation_key` on every row: the 15 expense main categories plus their default
      subcategories, and the 5 income main categories plus their default subcategories — the
      exact list and slugs in data-model.md "Default catalog".
- [X] T010 In the same migration, part 8 (one-time data migration, not a trigger): for every
      **existing** workspace, (a) stamp `is_system = true` + the matching `translation_key` on any
      category row whose `lower(name)` exactly matches one of the 15 default expense names, (b)
      insert the missing default subcategories under whichever row now carries each matched
      `translation_key`, (c) insert the entire default income tree fresh — per data-model.md
      "Existing-workspace backfill" and research.md Decision 8. Must not alter any existing
      `expenses.category_id` value.
- [X] T011 Apply the migration to the local Supabase stack via `psql` (per this project's
      established pattern — not `supabase migration up`, per the known Phase 8 stray-DB-state
      note) against a database containing at least one pre-existing seeded workspace with
      confirmed expenses, and verify: the workspace's original 15 category rows are unchanged in
      `id`/`name`, its confirmed expenses' `category_id` values are unchanged, it now has the new
      subcategories and the full income tree, and a freshly created workspace also receives both
      full trees immediately. Verified against workspace `9f5b0858-...` (9833 pre-existing
      workspaces total, 147,896 pre-migration category rows; dry run + real run row counts matched
      expected math exactly: 147,495 stamped, 334,322 expense subcategories inserted, 49,165 +
      58,998 income main/sub rows inserted). Also verified the hierarchy-depth trigger, the
      cross-type-parent trigger, the delete-guard trigger, and the new `category_deleted` history
      event all fire correctly on a disposable test workspace (cleaned up after). Found and fixed a
      real bug during this verification: the delete-guard trigger as originally written would have
      blocked workspace-cascade teardown entirely — fixed per research.md Decision 13.
- [X] T012 [P] Rewrite `apps/api/app/schemas/categories.py`: reuse the existing
      `RecordType = Literal["income", "expense"]` alias already defined in
      `apps/api/app/schemas/dashboard.py` for the new `category_type` field (do not introduce a
      duplicate `CategoryType` alias with identical values), add `parent_id`, `is_system`,
      `translation_key` fields to the `Category` model, add a `CategoryTree` response node with a
      `subcategories: list[Category]` field, update `CategoryCreateRequest` to accept
      `category_type` (for main categories) or `parent_id` (for subcategories), and update
      `CategoryReorderRequest` to accept `category_type`/`parent_id` scoping fields, per
      contracts/categories-api.md.
- [X] T013 [P] Extend `apps/api/app/schemas/incomes.py`: add `category_id: UUID | None` to
      `Income`, `IncomeCreateRequest`, and `IncomeUpdateRequest`, per contracts/records-api.md.
- [X] T014 [P] Backend test: migration backfill correctness — existing workspace ends up with
      `is_system`/`translation_key` stamped correctly, the expanded expense subcategories, the
      full income tree, and every pre-existing confirmed expense's `category_id` unchanged, in
      `apps/api/tests/test_categories_migration_backfill.py`. Implemented as a portable
      simulate-then-reapply test (a fresh CI database has no incidental pre-existing data to test
      against): creates a workspace, resets it to the exact pre-migration flat shape, simulates a
      user-renamed category (must stay `is_system=false`) and a user-archived default category
      (must still get stamped), attaches a confirmed expense, re-runs the migration's exact Part 8
      SQL scoped to that workspace, and asserts the full resulting shape plus the expense's
      `category_id` is unchanged. Passing (verified 3x consecutively, no flake).

**Checkpoint**: Schema, triggers, seed data, and shared schemas exist — user story implementation
can now begin.

---

## Phase 3: User Story 1 - Categorize a record with a main category and subcategory (Priority: P1) 🎯 MVP

**Goal**: Income and expense records can be saved with a main category alone, or a main category
plus one of its subcategories, validated against the correct tree (income vs. expense) and against
disabled/parent-disabled state.

**Independent Test**: Create an expense selecting a main category + subcategory, and a second
expense with only a main category; create an income record the same way against the income tree;
edit a record's main category and confirm any mismatched subcategory selection is cleared. All
without needing category-management UI or reports/AI-extraction changes (quickstart.md Section 2).

### Tests for User Story 1

- [X] T015 [P] [US1] Backend test: income create/update with `category_id` (main and subcategory,
      valid and invalid: wrong workspace, wrong type, archived category, archived parent) in
      `apps/api/tests/test_incomes_category.py`. 6 tests, all passing.
- [X] T016 [P] [US1] Backend test: expense `category_id` against the new type/parent-archived
      validation rules (extending the existing expense category tests) in
      `apps/api/tests/test_expenses_hierarchical_category.py`. 4 tests, all passing.
- [X] T017 [P] [US1] Backend test: `GET /workspaces/{workspace_id}/categories?category_type=...`
      returns a correctly nested tree, with `include_archived=false` excluding both archived items
      and subcategories whose parent is archived, in
      `apps/api/tests/test_categories_tree_read.py`. 3 tests, all passing.

### Implementation for User Story 1

- [X] T018 [US1] Rewrite the `_categories`/`_category_from_row` query and response-building logic
      in `apps/api/app/routes/categories.py`'s `GET` handler to accept a required `category_type`
      query param and return the nested tree shape (main categories with `subcategories: [...]`),
      applying the effective-availability rule from research.md Decision 5 when
      `include_archived=false`, per contracts/categories-api.md. Also widened `_category_from_row`
      and every SELECT/RETURNING column list that feeds it (`_category`, `_categories`, `POST`,
      `PATCH`) to include the new columns, and fixed a latent regression from Phase 2's index
      rename (T005): the duplicate-name error mapping still checked for the old
      `categories_unique_active_name` constraint-name substring, which no longer matches either new
      index name (`categories_unique_active_main_name`/`_sub_name`) — updated to the common prefix.
- [X] T019 [US1] Update `apps/api/app/routes/incomes.py`: accept `category_id` on create and
      update, call the new `validate_income_category` path (via the DB trigger; map its raised
      errors `category_not_in_workspace`/`category_type_mismatch`/`category_archived` to the same
      HTTP error shapes `expenses.py` already uses), and include `category_id` in every returned
      `Income`.
- [X] T020 [US1] Update `apps/api/app/routes/expenses.py`'s error mapping to additionally surface
      `category_type_mismatch` (unchanged endpoint shape/field — only new error codes from the
      rewritten trigger need mapping).
- [X] T021 [P] [US1] Update `apps/web/lib/api/categories.ts`: replace the flat `Category` type with
      a tree-shaped `MainCategory`/`Subcategory` pair (`subcategories` nested), add
      `category_type` to `getCategories`, per contracts/categories-api.md. Kept `Category` exported
      as a deprecated alias for `Subcategory` so the not-yet-updated Phase 4/6 consumers
      (`CategoryList.tsx`, `ExtractionReviewForm.tsx`) keep compiling unchanged.
- [X] T022 [P] [US1] Update `apps/web/lib/api/incomes.ts` and `apps/web/lib/api/expenses.ts`:
      add `category_id` to the create/update request and response types. (`expenses.ts` already had
      it from before this phase — no change needed there.)
- [X] T023 [US1] Create `apps/web/components/category/CategoryPicker.tsx`: a two-step main
      category → subcategory `<select>` pair (subcategory options limited to the chosen main
      category's active children) that clears the subcategory value whenever the main category
      selection changes (spec Acceptance Scenario 5).
- [X] T024 [US1] Replace the single `category_id` `<select>` in
      `apps/web/components/expense/ExpenseForm.tsx` (around line 134) with `CategoryPicker`,
      passing `category_type="expense"`.
- [X] T025 [US1] Add category selection to `apps/web/components/income/IncomeForm.tsx` using
      `CategoryPicker` with `category_type="income"` (this form currently has no category field at
      all).
- [X] T026 [P] [US1] Frontend unit test for `CategoryPicker`'s main-change-clears-subcategory
      behavior in `apps/web/components/category/__tests__/category-picker.test.tsx`. 3 tests, all
      passing; full frontend unit suite re-run clean (20 files, 68 tests, no regressions).
- [X] T027 [US1] Playwright e2e covering quickstart.md Section 2 (expense with main+sub, expense
      with main only, income with main+sub, edit clearing a stale subcategory) in
      `apps/web/e2e/hierarchical-categories.spec.ts`. Passing, verified 2x consecutively (not
      flaky). Also found and fixed a genuine display regression while building this: the
      `ExpenseHistoryList.tsx` category-name lookup map only indexed top-level categories, so any
      expense referencing a subcategory would silently show blank — fixed to also index
      subcategories. Re-ran `extraction.spec.ts`, `workspace-currency-formatting.spec.ts`,
      `acc-role-permissions.spec.ts`, `files.spec.ts`, and `acc-localization-rtl.spec.ts` — all
      still pass, no regressions from this story's changes.

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently — every
income/expense flow supports the new hierarchy even before category-management UI exists (new
workspaces/backfilled workspaces already have the seeded catalog from Phase 2).

---

## Phase 4: User Story 2 - Manage the category catalog (create, edit, disable, organize) (Priority: P1)

**Goal**: Workspace owners/admins can create, rename, disable/re-enable, reorder, and (when
unused) delete main categories and subcategories in either tree; viewers can only read.

**Independent Test**: As owner/admin, create a main category and a subcategory under it, rename,
disable/re-enable, reorder, and delete an unused one; confirm a viewer can read but not mutate
(quickstart.md Section 3).

### Tests for User Story 2

- [X] T028 [P] [US2] Backend test: `POST` main category and subcategory (success, wrong role,
      empty name, invalid/foreign `parent_id`, duplicate active sibling name) in
      `apps/api/tests/test_categories_hierarchy_manage.py`. 5 tests, all passing.
- [X] T029 [P] [US2] Backend test: `PATCH` rename and archive/unarchive at both levels, including
      that disabling a main category hides its subcategories from
      `include_archived=false` listings without altering their own `is_archived` column, and that
      re-enabling the parent restores them, in the same
      `apps/api/tests/test_categories_hierarchy_manage.py`. 2 tests, all passing.
- [X] T030 [P] [US2] Backend test: `PUT .../order` reordering main categories and, separately,
      subcategories within one parent (success and mismatched-id-set rejection) in the same file.
      1 test, passing.
- [X] T031 [P] [US2] Backend test: `DELETE` — succeeds only with zero historical references and no
      child subcategories, returns `409 category_has_references` otherwise, and a successful delete
      writes a `category_deleted` row to `public.activity_history` (Constitution Principle XII),
      in the same file. 2 tests, passing.
- [X] T032 [P] [US2] Backend test: Viewer/Member receive `403 forbidden` on `POST`/`PATCH`/
      `PUT .../order`/`DELETE` but `200` on `GET`, in the same file. 1 test, passing. (11 tests
      total in the file; re-run twice, no flakiness.)

### Implementation for User Story 2

- [X] T033 [US2] Update `apps/api/app/routes/categories.py`'s `POST` handler: accept
      `category_type` (main category) or `parent_id` (subcategory, type inherited), append after
      the current max `sort_order` among the correct sibling set, and surface
      `invalid_parent_category`/`duplicate_category_name` per contracts/categories-api.md. Also
      reinstated the `category_type`-required-for-main-category schema validator (removed in Phase
      2 to keep old call sites compiling) now that this route correctly enforces it, and updated
      the `create_category` test helper to default `category_type: "expense"` when neither field is
      given, preserving every old test call site.
- [X] T034 [US2] Update the `PATCH` handler: unchanged `name`/`is_archived` semantics now also
      support **unarchiving** (`is_archived: false` is no longer rejected — remove the Phase 3
      `invalid_archive_state` restriction per FR-009). Also fixed `_ensure_unique_active_name`'s
      scope: it previously checked for a duplicate name across the *entire* workspace regardless of
      level; now scoped correctly to siblings under the same parent (subcategories) or the same
      `category_type` at the top level (main categories), per FR-012.
- [X] T035 [US2] Rewrite the `PUT .../order` handler to scope reordering to one sibling set at a
      time (`category_type` + `parent_id: null` for main categories, or a specific `parent_id` for
      subcategories), validating the submitted ID set exactly matches that sibling set. Also
      reinstated the reorder-scope-required schema validator, updated the two Phase 3 tests that
      exercised the *old* flat, whole-workspace reorder shape to use the new scoped request body —
      this was the exact "known Phase 3→4 boundary" documented in the previous session, now
      resolved. Also fixed a second, previously-undiscovered instance of the same
      missing-`category_type`-query-param issue in `test_role_permissions_phase3.py`'s
      cross-workspace-isolation loop.
- [X] T036 [US2] Add a `DELETE /workspaces/{workspace_id}/categories/{category_id}` handler:
      owner/admin only, relies on the `prevent_referenced_category_delete` trigger and maps its
      raised exception to `409 category_has_references`.
- [X] T037 [P] [US2] Update `apps/web/hooks/use-categories.ts`: adapt to the tree response shape,
      add mutations for subcategory create, unarchive, per-level reorder, and delete. Also extended
      `lib/api/categories.ts` with `createCategory`'s new `{name, categoryType?, parentId?}` input
      shape and the previously-missing `reorderCategories`/`deleteCategory` client functions.
- [X] T038 [US2] Update `apps/web/components/category/CategoryForm.tsx`: add
      `category_type`/`parent_id` selection for creating a main category vs. a subcategory.
      Redesigned as one form per tree (a `categoryType` prop, set by the page's tab), with a single
      "Parent category" select whose first option ("New main category") means create as a main
      category — simpler than a combined type+mode switcher in one form.
- [X] T039 [US2] Update `apps/web/components/category/CategoryList.tsx`: render nested
      subcategory rows under each main category, support expand/collapse, and support per-level
      reorder (main list and, within an expanded main category, its subcategories) and delete
      actions (disabled/tooltipped when the category has references or children). Reorder uses
      simple Move up/down buttons (not drag-and-drop) — simpler, keyboard-accessible, and easy to
      test. The "disabled when blocked" delete guard only covers the client-visible "has children"
      case (`subcategories.length > 0`); "has record references" isn't knowable client-side without
      a new API field outside T036's scope, so that case surfaces via the existing inline
      rowError pattern when the DELETE call returns `409 category_has_references`.
- [X] T040 [US2] Update `apps/web/app/[locale]/w/[workspaceId]/categories/page.tsx` to fetch and
      display both the expense tree and the income tree (e.g. as two tabs or sections), each using
      the updated `CategoryList`/`CategoryForm`. Implemented as a simple two-button tab switcher.
- [X] T041 [US2] Playwright e2e covering quickstart.md Section 3 (create main+sub, rename, disable
      cascade/re-enable restore, reorder both levels, viewer read-only, duplicate-name rejection,
      delete-blocked-then-succeeds) in `apps/web/e2e/category-management.spec.ts`. Passing, verified
      2x consecutively. Found and fixed two real bugs while building this: (1) a genuine backend
      regression — nothing wrong with the route logic itself, but a stale, non-reloading `uvicorn`
      process (started before the T033-036 edits) meant every manual/curl verification during this
      task was silently hitting pre-Phase-4 code; restarting it confirmed the actual route code was
      already correct — a process-hygiene lesson, not a code fix; (2) added `aria-label`s to the
      rename `<input>` and to the `CategoryPicker` selects (already done in Phase 3) — native
      `<label>`-wrapped `<select>`/`<input>` elements compute their accessible name from all
      wrapped content, which collides once row text becomes an input value or "Category" vs
      "Subcategory" substring-match. Re-ran `hierarchical-categories.spec.ts`, `extraction.spec.ts`,
      and `acc-role-permissions.spec.ts` — all still pass, no regressions.

**Checkpoint**: User Stories 1 and 2 both work independently — the full category lifecycle is
manageable and every income/expense flow already respects it.

---

## Phase 5: User Story 3 - Drill into reports by main category and subcategory (Priority: P2)

**Goal**: Reports group confirmed expense/income totals by main category and can drill into one
main category's subcategory split, including disabled/renamed categories' historical totals.

**Independent Test**: With records spread across main categories and subcategories, confirm the
top-level report groups by main category and a drill-down call returns the correct subcategory
split with an explicit "no subcategory" bucket (quickstart.md Section 4).

### Tests for User Story 3

- [X] T042 [P] [US3] Backend test: `get_category_breakdown` groups a subcategory-tagged expense
      under its resolved main category, and a disabled/renamed category's historical total still
      appears under its current name, in `apps/api/tests/test_dashboard_category_breakdown.py`
      (extend existing file). 2 new tests added (3 total in file), all passing. The
      disabled/renamed-category assertion already passed against the pre-existing (unmodified)
      query — that guarantee was already true via live join, not a new behavior.
- [X] T043 [P] [US3] Backend test: the new subcategory drill-down endpoint returns per-subcategory
      totals plus an explicit `subcategory_id: null` "no subcategory" bucket, and `404`s for an
      unknown or non-main `main_category_id`, in
      `apps/api/tests/test_reports_category_drilldown.py`. 3 tests, all passing.
- [X] T044 [P] [US3] Backend test: `income_category_breakdown` on the reports endpoint groups
      confirmed income by resolved main income category, in
      `apps/api/tests/test_reports_income_category_breakdown.py`. 1 test, passing.

### Implementation for User Story 3

- [X] T045 [US3] Rewrite `get_category_breakdown` in `apps/api/app/services/dashboard.py` to join
      through `parent_id` (`coalesce(c.parent_id, c.id)` as the grouping key) so amounts roll up to
      the resolved main category, per research.md Decision 10. Generalized with a `table` kwarg
      (defaulting to `"expenses"`, unchanged for the existing dashboard route call site) so the
      same function serves both the expense and income breakdowns.
- [X] T046 [US3] Add `SubcategoryBreakdownItem` to `apps/api/app/schemas/dashboard.py` and a new
      `get_subcategory_breakdown(workspace_id, main_category_id, period_start, period_end, conn)`
      service function in `apps/api/app/services/dashboard.py`, including the explicit
      "no subcategory" bucket. Also added `get_main_category()` to validate/resolve the drill-down
      target and its `category_type`.
- [X] T047 [US3] Add `income_category_breakdown` to `ReportData` in
      `apps/api/app/schemas/reports.py`, and compute it in `apps/api/app/routes/reports.py` /
      `apps/api/app/services/reports.py` using the same resolved-main-category grouping applied to
      confirmed incomes.
- [X] T048 [US3] Add the new route
      `GET /workspaces/{workspace_id}/reports/category-breakdown/{main_category_id}/subcategories`
      in `apps/api/app/routes/reports.py`, per contracts/reports-api.md (period query params,
      `404` for unknown/non-main category id).
- [X] T049 [P] [US3] Update `apps/web/lib/api/dashboard.ts` and `apps/web/lib/api/reports.ts`:
      add `SubcategoryBreakdownItem`/`income_category_breakdown` types and a
      `getSubcategoryBreakdown` client function.
- [X] T050 [US3] Update `apps/web/components/dashboard/CategoryBreakdown.tsx` to support an
      optional drill-down interaction (click a main category row to fetch and display its
      subcategory split inline or in a popover). Made `workspaceId`/`period` optional props so the
      component stays backward-compatible; wired both the dashboard page and reports page to pass
      them, enabling drill-down in both places, not just reports.
- [X] T051 [US3] Update `apps/web/components/reports/ReportSummary.tsx` (or add a sibling
      component in `apps/web/components/reports/`) to render `income_category_breakdown`
      alongside the existing expense breakdown. Reused `CategoryBreakdown` itself (added an
      optional `title` override prop) rather than a new component, since the shape and
      drill-down behavior are identical.
- [X] T052 [US3] Playwright e2e covering quickstart.md Section 4 (grouped totals, drill-down
      subcategory split with "no subcategory" bucket, disabled/renamed category still totals
      correctly) in `apps/web/e2e/reports-category-drilldown.spec.ts`. Passing, verified 2x
      consecutively. Hit the same "stale backend process" class of issue as Phase 4 — this time
      `uvicorn --reload` itself was the cause (its reload supervisor ended up serving from a stale
      worker), not a missing restart; killed all python processes and restarted **without**
      `--reload` to get a reliably fresh server. Re-ran the full backend reports/dashboard suite
      (21 tests), full frontend unit suite (68 tests), and `hierarchical-categories.spec.ts` /
      `workspace-currency-formatting.spec.ts` e2e — all still pass, no regressions.

**Checkpoint**: User Stories 1–3 all work independently; reports fully reflect the new hierarchy
for both record types.

---

## Phase 6: User Story 4 - AI extraction suggests a subcategory for review (Priority: P3)

**Goal**: AI extraction proposes a main category and, where determinable, a subcategory drawn only
from the workspace's active expense catalog, always subject to manual review before confirmation.

**Independent Test**: Run extraction on a receipt with clear merchant context and confirm a
suggested main category (and subcategory where applicable) is pre-filled but editable; confirm a
disabled category is never pre-filled as a suggestion (quickstart.md Section 5).

### Tests for User Story 4

- [X] T053 [P] [US4] Backend test: extraction resolves `suggested_category_id` only when the
      model's returned name exactly (case-insensitively) matches an entry in the active-catalog
      snapshot passed to the prompt, leaves it `null` otherwise while still preserving the raw
      `suggested_category` text, and never offers a disabled category as a prompt candidate, in
      `apps/api/tests/test_extraction_category_suggestion.py`. 5 tests, all passing.
- [X] T054 [P] [US4] Backend test: `ConfirmExtractionRequest.category_id` still accepts any active
      main/sub category id regardless of the original suggestion, and the confirmed expense
      reflects the reviewer's final choice (extend existing extraction confirm tests) in
      `apps/api/tests/test_extraction_confirm_workspace_currency.py` or a new adjacent test file if
      clearer. Added to `test_extraction_confirm.py` instead (more topically fitting — the
      `..._workspace_currency.py` file is specifically about currency, not category override).

### Implementation for User Story 4

- [X] T055 [US4] Add `suggested_category_id: UUID | None` to `ExtractionDraft` in
      `apps/api/app/schemas/extractions.py`. Required a new migration
      (`supabase/migrations/20260723000000_ai_extraction_category_suggestion.sql`) adding a
      `suggested_category_id uuid references categories(id) on delete set null` column to
      `ai_extractions` — not explicitly called out as its own task, but necessary to persist the
      value this task's own field is meant to carry (same pattern as prior phases' implied schema
      needs).
- [X] T056 [US4] Update the extraction prompt-building logic in
      `apps/api/app/services/extractions.py` (or `ai_providers.py`, wherever the prompt is
      assembled) to fetch the workspace's active expense category catalog (main + subcategory
      names) and include it as the closed candidate list the model must choose from. New
      `_active_expense_categories()` in `extractions.py` (subcategory only included when its
      parent is also active, research.md Decision 5) feeds `ai_providers.extract_receipt`'s new
      `category_names` parameter, which both provider prompt-builders now interpolate.
- [X] T057 [US4] Add the resolution step in `apps/api/app/services/extractions.py`: match the
      model's returned category name(s) case-insensitively against the same active-catalog
      snapshot to populate `suggested_category_id`, leaving it `null` on no match. Also updated 13
      pre-existing `extract_receipt` monkeypatch stubs across 10 test files (added an optional
      `category_names=None` parameter) since the real function's signature changed — verified all
      39 extraction tests still pass, including one exact-dict assertion in
      `test_extraction_trigger.py` that needed the new field added (an existing suggestion of
      "Groceries" now legitimately resolves to a real id).
- [X] T058 [P] [US4] Update `apps/web/lib/api/extractions.ts`: add `suggested_category_id` to the
      draft type.
- [X] T059 [US4] Update `apps/web/components/extraction/ExtractionReviewForm.tsx` to pre-fill
      `CategoryPicker` (from US1) with `suggested_category_id` when present, remaining fully
      editable before confirm. Replaced the flat category `<select>` with `CategoryPicker`,
      initialized `categoryId` state from `draft?.suggested_category_id`, and removed the
      now-unnecessary `categories` prop (the picker self-fetches via `useCategories`). Propagated
      the removal to `apps/web/app/[locale]/w/[workspaceId]/extractions/[extractionId]/page.tsx`
      (dropped its `getCategories` query and prop pass) and to
      `apps/web/components/extraction/__tests__/extraction-review-form.test.tsx` (wrapped in
      `QueryClientProvider`, mocked `getCategories`, added a test asserting the picker pre-fills
      from `suggested_category_id`). `npx tsc --noEmit` clean; `npx vitest run` 69/69 passing
      (was 68 — one new test added).
- [X] T060 [US4] Playwright e2e covering quickstart.md Section 5 (suggestion pre-filled, disabled
      category never pre-filled, override before confirm persists the override) in
      `apps/web/e2e/extraction-category-suggestion.spec.ts`. Seeds `ai_extractions` rows directly
      via `psql` (matching `extraction.spec.ts`'s established technique, since a real provider
      call can't be made to deterministically return a specific suggestion). Covers: (1) a
      seeded `suggested_category_id` pre-fills the Category picker; (2) overriding to a different
      category before confirming persists the reviewer's final choice (not the original
      suggestion) onto the created expense; (3) a `suggested_category_id: null` row (simulating a
      disabled-at-suggestion-time category) leaves the picker unselected. Passed on first run;
      also re-ran `extraction.spec.ts` and `hierarchical-categories.spec.ts` for regression — both
      still pass.

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Localization of the default catalog and final regression validation across all
stories.

- [X] T061 [P] Add the `categories.catalog.*` (main) and `categories.catalog.sub.*` (subcategory)
      message namespaces to `apps/web/messages/en.json` and `apps/web/messages/ar.json`, covering
      every `translation_key` slug listed in data-model.md "Default catalog", plus a
      `categories.catalog.noSubcategory` key for the reports "no subcategory" bucket label. Added
      15 expense-tree + 5 income-tree main-category keys and all their nested `sub.<main>.<sub>`
      subcategory keys (matching translation_key's `<main slug>.<sub slug>` shape exactly, so a
      subcategory's full translation_key doubles as its nested path under `sub`). Both files
      verified to parse as valid JSON.
- [X] T062 [P] Create `apps/web/lib/i18n/category-labels.ts`: a small helper that resolves a
      category/subcategory's display name from `translation_key` via the message catalog when
      present, falling back to the raw `name` field otherwise (research.md Decision 4), and use it
      everywhere a category name is rendered (`CategoryPicker`, `CategoryList`,
      `CategoryBreakdown`, reports components, `ExtractionReviewForm`). `getCategoryLabel(t,
      category)` detects sub- vs. main-category by whether `translation_key` contains a `.`
      (prefixing lookups with `sub.` when it does), and is now used in `CategoryPicker.tsx`,
      `CategoryList.tsx`, `CategoryForm.tsx` (parent-category selector), and
      `ExpenseHistoryList.tsx`'s category-name map — all places that hold full category records
      with `translation_key`. `ExtractionReviewForm` picks it up transitively through the embedded
      `CategoryPicker` (added in T059). `CategoryBreakdown.tsx`/reports: per data-model.md,
      `CategoryBreakdownItem`/`SubcategoryBreakdownItem` are unchanged, backend-resolved-name
      fields with no `translation_key` — translating arbitrary breakdown category names is out of
      scope without a backend schema change. Fixed the one part that *is* addressable client-side:
      both the "Uncategorized" and "no subcategory" bucket labels were previously matched by
      literal backend English string (a dead `item.category_name || t("uncategorized")` check that
      never fired, since the backend already sends non-empty literal text) — switched both to an
      ID-based check (`category_id`/`subcategory_id` null) so the bucket labels render correctly
      localized via `dashboard.uncategorized` and the new `categories.catalog.noSubcategory`, with
      no change to English output.
- [X] T063 [P] Extend `apps/web/tests/unit/localization-rtl.test.tsx` with assertions that
      system-provided category names render translated in Arabic and English while a
      user-created category name renders identically in both locales, per quickstart.md
      Section 6. Added a `CategoryLabelProbe` test component exercising `getCategoryLabel` through
      real `useTranslations` lookups for a main category, a subcategory, and a `translation_key:
      null` user-created category, rendered once per locale. `npx tsc --noEmit` clean; `npx vitest
      run` 70/70 passing (was 69 — one new test added).
- [X] T064 Run the full quickstart.md validation guide (Sections 1–6) end-to-end against a local
      stack containing both a pre-existing and a freshly created workspace, confirming SC-001
      through SC-006 all hold. Section 1 (migration backfill, SC-002): spot-checked a real,
      pre-existing local workspace ("Family Budget") with confirmed expenses referencing a
      default category — confirmed via direct DB query exactly 15 expense mains / 34 expense subs
      / 5 income mains / 6 income subs (matching data-model.md's catalog counts exactly) and zero
      `is_system` rows with a null `translation_key`. Sections 2–6 (SC-001, SC-003 through SC-006):
      covered by running the complete Playwright e2e suite (`hierarchical-categories.spec.ts`,
      `category-management.spec.ts`, `reports-category-drilldown.spec.ts`,
      `extraction-category-suggestion.spec.ts`, `extraction.spec.ts`,
      `acc-localization-rtl.spec.ts`, `locale-rtl.spec.ts`, and the rest — 18/18 passing, 11
      pre-existing skips unrelated to this phase (legacy fixtures gated on unset `E2E_EMAIL`/
      `E2E_PASSWORD` env vars, consistent with every earlier phase run in this project). Found and
      fixed one genuine regression surfaced only by running the *full* suite (not phase-scoped
      subsets): `apps/web/app/[locale]/w/[workspaceId]/categories/page.tsx` lost its page-level
      `<h1>{t("title")}</h1>` heading in Phase 4's two-tab rewrite, breaking
      `tests/e2e/locale-rtl.spec.ts`'s Arabic-heading assertion for the categories route — restored
      the heading (matching the `<h1 className="text-3xl font-semibold">` pattern used by every
      other workspace page, e.g. `history/page.tsx`) above the tab switcher; re-ran and confirmed
      green.
- [X] T065 Run the existing full backend (`pytest apps/api`) and frontend (`npm run test` /
      Playwright) suites to confirm no regression in unrelated Phase 1–12 coverage (financial
      totals, tenant isolation, AR/EN/RTL, workspace currency). Frontend: `npx tsc --noEmit` clean;
      `npx vitest run` 70/70 passing; full Playwright suite 18/18 passing (11 pre-existing skips,
      see T064). Backend: full `pytest apps/api/tests` (180 tests) passing after fixing 3 genuine
      pre-existing acceptance-test regressions surfaced only by a full-suite run (each phase's own
      regression checks up to now only re-ran newly-relevant spec files, not this legacy
      `tests/acceptance/` battery) — `test_acc_ai_behavior.py`, `test_acc_role_permissions.py`, and
      `test_acc_tenant_isolation.py` all still called the category endpoints with their pre-Phase-3
      flat shape: `POST .../categories` bodies with no `category_type`/`parent_id` (now required by
      `CategoryCreateRequest`'s `require_type_for_main_category` validator) and bare
      `GET .../categories` with no `category_type` query param (now `Query(...)`-required) — both
      returned `422` instead of the tests' expected `200`/`201`/`403`/`404`. Fixed all 7 call sites
      (added `"category_type": "expense"` to 4 POST bodies, `?category_type=expense` to 3 GET
      paths/loop entries) without changing any assertion's expected status code. Verified via three
      full runs: `tests/acceptance/` alone (19/19 passing, ~9.5 min), the remaining 161 tests
      (`--ignore=tests/acceptance`, all passing, ~4.8 min) — 180/180 total, 0 failures.

### Post-completion review (Phase 7 re-audit)

A follow-up review of completed Phase 7 (T061–T062 specifically) found one real regression and
one real scope gap, both fixed:

1. **Regression (FR-008): renaming a system category stopped displaying the new name.**
   `getCategoryLabel` (T062) prefers `translation_key` over `name`, but `PATCH
   /workspaces/{id}/categories/{id}` never cleared `translation_key` when `name` changed — so
   renaming e.g. "Restaurants" kept showing "Restaurants" everywhere `getCategoryLabel` was wired
   in (`CategoryList`, `ExpenseHistoryList`), directly violating FR-008's "historical records show
   the current name, not a frozen snapshot." Before Phase 7 this worked (raw `name` always
   rendered), so this was introduced by T062's own wiring. Fixed in
   `apps/api/app/routes/categories.py`'s `update_category`: whenever `name` is set, also set
   `translation_key = null` (a rename supersedes the system default; user-created rows already
   have a null key, so this is a no-op for them). Extended
   `tests/test_categories_hierarchy_manage.py::test_rename_category_and_subcategory` to assert
   `translation_key is None` after renaming both a system main category and its subcategory (11/11
   passing). Added a new e2e block to `category-management.spec.ts` proving a renamed *system*
   category ("Fuel" → "Petrol & Fuel", not a user-created one) shows the new name both in the
   category list and on a historical expense record already using it — caught and fixed a locator
   bug of my own while writing it (reusing a `hasText`-filtered locator after the row entered edit
   mode, the same "text becomes input value" gotcha documented elsewhere in that file).
2. **Scope gap (FR-006): reports/dashboard category breakdown never localized system category
   names**, unlike every other surface — in Arabic, "Restaurants" still rendered in English there.
   T062 had deliberately left this per data-model.md's "`CategoryBreakdownItem`/
   `SubcategoryBreakdownItem` unchanged fields" note, reasoning a backend schema change was needed.
   That reasoning was wrong: the same client-side join `ExpenseHistoryList` already uses (fetch the
   full category tree, map `id → translation_key`) works here too. Added a `categoryType` prop to
   `CategoryBreakdown` (default `"expense"`, `"income"` passed from `ReportSummary`'s income
   breakdown instance), fetches that tree via `useCategories`, and resolves both the main-category
   and subcategory-drilldown labels through `getCategoryLabel`, falling back to the backend string
   only when the id isn't found locally. Extended `reports-category-drilldown.spec.ts` with an
   Arabic-locale block proving "Transportation"/"Public Transit"/"Ride-Hailing"/the no-subcategory
   bucket all render in Arabic in the reports breakdown now.

Verified: `npx tsc --noEmit` clean; `npx vitest run` 70/70; full Playwright suite 18/18 passing (11
pre-existing skips, unchanged); backend `test_categories_hierarchy_manage.py` (11),
`test_categories_manage.py`, `test_categories_tree_read.py`, `test_categories_migration_backfill.py`,
`test_dashboard_category_breakdown.py`, `test_reports_category_drilldown.py`,
`test_reports_income_category_breakdown.py` (25 total) all passing.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories (schema,
  triggers, seed data, and shared types every story reads/writes).
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - US1 (Phase 3) has no dependency on US2–US4 — a workspace already has the seeded catalog from
    Phase 2, so record categorization works before any management UI exists.
  - US2 (Phase 4) has no dependency on US1's frontend work, only on Phase 2's schema/triggers, but
    is sequenced after US1 here because both are P1 and US1 is the smaller, more foundational
    slice to validate first.
  - US3 (Phase 5) depends on US1 existing (there must be categorized records to report on) but not
    on US2.
  - US4 (Phase 6) depends on US1's `CategoryPicker` component (T023) for the review-form UI, and
    on the categorized-expense path being correct.
- **Polish (Phase 7)**: Depends on all four user stories being complete (localization keys must
  cover every catalog entry seeded in Phase 2, and final regression needs everything in place).

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only.
- **User Story 2 (P1)**: Foundational only (independently testable in parallel with US1 by a
  second developer; sequenced after US1 in this document for a single-implementer flow).
- **User Story 3 (P2)**: Foundational + US1 (needs categorized records to exist).
- **User Story 4 (P3)**: Foundational + US1 (`CategoryPicker` reuse).

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Schemas/types before route/service logic.
- Backend route/service logic before frontend API client updates.
- Frontend API client updates before UI components.
- Story complete (including its Playwright e2e) before moving to the next priority.

### Parallel Opportunities

- T001–T002 (Setup) can run in parallel.
- T012–T014 (Foundational schemas/backfill test) can run in parallel once T003–T011 land.
- All US1 test tasks (T015–T017) can run in parallel; T021–T022 (frontend types) can run in
  parallel with each other.
- All US2 test tasks (T028–T032) can run in parallel.
- All US3 test tasks (T042–T044) can run in parallel; T049 can run in parallel with T045–T048.
- US4's T053–T054 can run in parallel; T058 can run in parallel with T055–T057.
- T061–T063 (Polish) can run in parallel.
- Different user stories can be worked on in parallel by different team members once Phase 2 is
  complete, per the Phase Dependencies notes above.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Backend test income category_id validation in apps/api/tests/test_incomes_category.py"
Task: "Backend test expense hierarchical category validation in apps/api/tests/test_expenses_hierarchical_category.py"
Task: "Backend test categories tree read in apps/api/tests/test_categories_tree_read.py"

# Launch frontend type updates for User Story 1 together:
Task: "Update apps/web/lib/api/categories.ts tree types"
Task: "Update apps/web/lib/api/incomes.ts and apps/web/lib/api/expenses.ts category_id types"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories; this is also where the
   existing-workspace migration backfill happens, so it delivers value to every current workspace
   immediately).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Run quickstart.md Section 2 independently.
5. Deploy/demo if ready — every income/expense flow already supports hierarchical categories, even
   before category-management UI (US2) ships.

### Incremental Delivery

1. Setup + Foundational → every workspace (old and new) has the full expanded catalog.
2. Add US1 → categorized income/expense records → Test independently → Deploy/Demo (MVP!).
3. Add US2 → users can adapt the catalog → Test independently → Deploy/Demo.
4. Add US3 → reports drill-down → Test independently → Deploy/Demo.
5. Add US4 → AI suggests categories on review → Test independently → Deploy/Demo.
6. Polish → localized default names everywhere, full regression pass.

### Parallel Team Strategy

With multiple developers, once Phase 2 (Foundational) is complete:

- Developer A: User Story 1 (record categorization).
- Developer B: User Story 2 (catalog management) — independent of US1's frontend work.
- Developer C: starts US3 once US1's schema/route pieces (T018–T020) land; starts US4 once
  `CategoryPicker` (T023) lands.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story is independently completable and testable per its quickstart.md section.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- The Phase 2 migration is the single highest-risk task set in this phase (schema + triggers +
  one-time data backfill in one file) — T011's verification step against a pre-existing seeded
  workspace is not optional before any user story work begins.
