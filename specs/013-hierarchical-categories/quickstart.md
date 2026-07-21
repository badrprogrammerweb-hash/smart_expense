# Quickstart: Hierarchical Categories

A validation/run guide proving the feature works end-to-end.
Implementation detail lives in `tasks.md`, `data-model.md`, and
`contracts/`; this file is how you *verify* it. Assumes the Phase 1–12
local stack is running (Supabase CLI Docker stack, FastAPI on `apps/api`,
Next.js on `apps/web`).

## Prerequisites

- Supabase local stack up: `supabase start` (from repo root).
- This phase's migration applied against the tracked schema (`psql`, per
  the project's established migration-application pattern —
  `supabase migration up` is not used to apply tracked migrations here).
- Backend: `apps/api` running (`uvicorn app.main:app --reload`).
- Frontend: `apps/web` running (`npm run dev`).
- Two test workspaces: one brand-new (created after this migration), one
  pre-existing with confirmed expense records from before this phase (to
  verify the migration backfill and historical-record preservation).

## 1. Migration backfill on an existing workspace (FR-015, FR-015a, Clarification 1)

1. Open the pre-existing workspace's category list
   (`GET /workspaces/{id}/categories?category_type=expense`).
2. **Expected**: all 15 original category names are present, unchanged,
   each now with `is_system: true` and a non-null `translation_key`
   matching `data-model.md`'s slug table; each now has its new default
   subcategories nested under it.
3. `GET /workspaces/{id}/categories?category_type=income`.
4. **Expected**: the full 5-main-category default income tree exists, even
   though this workspace never had income categories before.
5. Open a pre-existing confirmed expense that referenced one of the
   original categories before migration.
6. **Expected**: it still shows the same category, unchanged
   (`expense.category_id` untouched by the migration) — SC-002.

## 2. Record an expense with main category + subcategory (US1, FR-001–FR-004)

1. As a workspace member, create an expense selecting main category
   "Transportation" and subcategory "Vehicle Maintenance".
2. **Expected**: `201`; the expense's `category_id` is the "Vehicle
   Maintenance" subcategory id.
3. Create a second expense selecting only main category "Rent" (no
   subcategory available/selected).
4. **Expected**: `201`; `category_id` is the "Rent" main-category id.
5. Edit the first expense, changing its main category from
   "Transportation" to "Utilities".
6. **Expected**: the previously-selected "Vehicle Maintenance" subcategory
   is cleared client-side (Acceptance Scenario 5) — resubmitting without a
   new subcategory saves with `category_id` = "Utilities" main-category id.
7. Repeat steps 1–4 for an income record against the new income tree
   (e.g., "Salary" → "Bonus & Commission").

Backend: `pytest apps/api/tests/test_incomes_category.py
apps/api/tests/test_expenses_hierarchical_category.py`.
Frontend: Playwright `apps/web/e2e/hierarchical-categories.spec.ts`.

## 3. Manage the category catalog (US2, FR-007–FR-013)

1. As Owner/Admin, `POST` a new main expense category ("Pets"), then
   `POST` a subcategory under it ("Grooming").
2. **Expected**: both appear nested correctly in the next `GET`.
3. Rename "Grooming" to "Pet Grooming".
4. **Expected**: `200`; any expense already using it (create one first)
   shows the new name immediately.
5. Disable the "Pets" main category.
6. **Expected**: neither "Pets" nor "Pet Grooming" appear as selectable
   options for new expenses (`include_archived=false`), but the
   already-created expense referencing "Pet Grooming" still displays it
   correctly.
7. Re-enable "Pets".
8. **Expected**: "Pet Grooming" is selectable again immediately, with no
   separate re-enable step needed for it (research.md Decision 5).
9. Reorder the main expense category list; reorder "Pets"' subcategories
   (only one exists, so add a second first to make the reorder
   meaningful).
10. **Expected**: new order reflected in the next `GET` and in the
    record-creation category picker.
11. As a Viewer, attempt any of steps 1, 3, 5, 9.
12. **Expected**: `403 forbidden` for every mutation; `GET` still succeeds.
13. Attempt to create a subcategory named "Pet Grooming" again under
    "Pets" while the first is still active.
14. **Expected**: `409 duplicate_category_name`.
15. Attempt to `DELETE` "Pets" while "Pet Grooming" still exists under it.
16. **Expected**: `409 category_has_references`. Delete "Pet Grooming"
    first (it has no historical records), then delete "Pets".
17. **Expected**: both deletes succeed with `204`.

Backend: `pytest apps/api/tests/test_categories_hierarchy_manage.py`.
Frontend: Playwright `apps/web/e2e/category-management.spec.ts`.

## 4. Reports drill-down (US3, FR-016–FR-017)

1. With expenses recorded across at least two main categories, and at
   least one main category split across two subcategories plus one
   expense with no subcategory, open the reports category breakdown.
2. **Expected**: totals are grouped by main category only.
3. Call the new subcategory drill-down endpoint for that main category.
4. **Expected**: response includes each subcategory's total plus an
   explicit `subcategory_id: null` "No subcategory" bucket reflecting the
   one expense with no subcategory chosen.
5. Disable or rename the main category used above; re-run the report for
   the same historical period.
6. **Expected**: the total is unchanged, shown under the category's
   current name (FR-017).

Backend: `pytest apps/api/tests/test_reports_category_drilldown.py`.

## 5. AI extraction category suggestion (US4, FR-018–FR-020)

1. With BYOK configured, run extraction on a receipt with a clear
   merchant (e.g., a restaurant receipt).
2. **Expected**: `ExtractionDraft.suggested_category` and
   `suggested_category_id` are both populated, resolving to an active
   "Restaurants" category or one of its active subcategories.
3. Disable the "Restaurants" main category; run extraction again on a
   similar receipt.
4. **Expected**: `suggested_category_id` is `null` (the disabled category
   was never offered to the model as a candidate); `suggested_category`
   may still contain the model's raw text for reference.
5. On the review screen, override the suggestion with a different
   category before confirming.
6. **Expected**: the confirmed expense's `category_id` matches the
   reviewer's final choice, not the original suggestion (FR-019) — the
   expense is not auto-confirmed at any point (Constitution Principle V,
   unchanged).

Backend: `pytest apps/api/tests/test_extraction_category_suggestion.py`.

## 6. Localization (FR-006)

1. Switch the interface language to Arabic.
2. **Expected**: every system-provided category/subcategory name (e.g.,
   "Restaurants" → its Arabic translation) displays in Arabic; the
   user-created "Pets"/"Pet Grooming" from Section 3 still display exactly
   as typed, unchanged.
3. Switch back to English; confirm the reverse.

Frontend: extend existing
`apps/web/tests/unit/localization-rtl.test.tsx` /
`apps/web/tests/e2e/locale-rtl.spec.ts` coverage with category-name
assertions.
