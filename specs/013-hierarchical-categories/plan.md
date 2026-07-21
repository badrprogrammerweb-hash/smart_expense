# Implementation Plan: Hierarchical Categories

**Branch**: `013-hierarchical-categories` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-hierarchical-categories/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extend the existing flat, expense-only `categories` table (Phase 3) into
two independent workspace trees — one for income, one for expense — each
with main categories and exactly one level of subcategories. Add
`incomes.category_id` (mirroring the existing `expenses.category_id`) so
income records can be categorized for the first time. Expand the default
category catalog (new subcategories under the 15 existing expense main
categories, plus an entirely new 5-main-category income tree) and
**backfill it onto every existing workspace**, not just new ones
(Clarification 1), while leaving every historical expense's existing
category reference untouched (FR-015). Add owner/admin category
management (create, rename, disable/re-enable, reorder, and a
references-guarded hard delete) at both levels. Update reports to group by
main category with a subcategory drill-down endpoint, and update AI
extraction to suggest a main category and subcategory drawn only from the
workspace's currently-active catalog, still subject to manual review before
confirmation (Constitution Principle V, unchanged). System-provided
category/subcategory names get a stable `translation_key` resolved
client-side through the existing `next-intl` message catalogs from Phase
12 — no new i18n infrastructure.

## Technical Context

**Language/Version**: Python 3.12 for `apps/api` (extended this phase); SQL
(Postgres 15, Supabase-managed) for one new tracked migration under
`supabase/migrations/`; TypeScript 5.7 on Next.js 16.x (App Router) / React
for `apps/web` (extended this phase). This phase touches `apps/api`,
`apps/web`, and `supabase/`.

**Primary Dependencies**: No new dependency in either app. Backend:
FastAPI, SQLAlchemy async engine + `asyncpg`, Pydantic v2 — all already in
`apps/api/requirements.txt`. Frontend: already-present `next-intl`
(extended with a new `categories.catalog.*` message namespace),
`@tanstack/react-query` (extends the existing `use-categories.ts` hook
pattern), `shadcn/ui` + Tailwind (extends the existing category
list/form/picker components with a two-level tree UI).

**Storage**: Supabase Postgres. One new migration,
`20260722000000_hierarchical_categories.sql`: alters `categories` (adds
`category_type`, `parent_id` self-FK, `is_system`, `translation_key`; new
partial unique indexes; new hierarchy-validation, delete-guard triggers);
adds `incomes.category_id` + `validate_income_category` trigger;
generalizes `validate_expense_category` via a shared
`validate_category_assignment(...)` SQL function; extends
`seed_default_categories()` to seed both trees with subcategories for new
workspaces; a one-time data migration backfills `category_type`/
`is_system`/`translation_key` and the expanded catalog onto every existing
workspace. Full detail in `data-model.md` and `contracts/`.

**Testing**: `pytest` + `pytest-asyncio` + `httpx` (ASGI transport) for
route-level backend tests against real local-Auth test users (established
Phases 2–12 pattern), covering: hierarchy CRUD and validation, income
category assignment, expense category assignment against the new type/
parent rules, the existing-workspace migration backfill, report grouping/
drill-down, and AI-suggestion resolution against the active-catalog
snapshot. Frontend: Vitest + React Testing Library for the category tree
picker/management components and the translation-key resolution helper;
Playwright for the end-to-end category-management flow, the record
category-selection flow, and an AR/EN localization pass over system
category names (extending the existing
`apps/web/tests/unit/localization-rtl.test.tsx` /
`apps/web/tests/e2e/locale-rtl.spec.ts` suites, re-run unmodified as a
regression gate plus new category-name assertions).

**Target Platform**: Local development via Supabase CLI (Docker stack);
hosted Supabase for staging/production; `apps/web` in the browser (desktop
+ mobile web). Unchanged deployment posture (Bunny Magic Containers, Phase
10).

**Project Type**: Web application (existing `apps/api` + `apps/web`
monolith repository).

**Performance Goals**: No raw throughput/latency SLA. The category tree
per workspace is small (dozens of rows even with full customization), so
the `GET .../categories` nested response and the report breakdown/
drill-down queries are simple indexed joins/group-bys, not a performance
concern this phase.

**Constraints**: One level of subcategory nesting maximum (FR-002,
enforced by a DB trigger, not just the API). No exchange-rate conversion
or mixed-currency accounting is introduced or affected (Constitution
Principle III — unrelated to this phase). AI category suggestions remain
non-authoritative until manually confirmed (Constitution Principle V —
unchanged, reinforced by FR-018–FR-020).

**Scale/Scope**: Two trees × ~15–20 main categories × ~0–4 subcategories
each per workspace by default, growing with user customization; touches 4
existing backend route/schema modules (`categories`, `incomes`,
`expenses` read paths, `extractions`, `dashboard`/`reports`), 1 new
migration, and the corresponding frontend category components/hooks/
messages.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I / III / XV (scope)**: Category management is explicitly
  in-scope MVP surface ("category management" is listed in Principle III's
  MVP-include list). This phase only deepens that existing surface
  (hierarchy, translation, per-type trees); it adds no adjacent-domain
  feature (no budgeting-per-category, no accounting ledger). **Pass.**
- **Principle II (budgeting philosophy)**: Remaining balance stays
  `confirmed income − confirmed expenses`; categories (at either level)
  remain descriptive only, never a separate budget pool. Unchanged.
  **Pass.**
- **Principle IV (Saudi-first defaults)**: All 15 constitution-mandated
  default expense category names are preserved verbatim as main
  categories; this phase only adds subcategories beneath them and a new
  income tree, and never removes or renames a mandated default. **Pass.**
- **Principle V (manual-first, AI-optional)**: AI category *suggestions*
  are explicitly required to remain non-authoritative and subject to
  manual review before confirmation (FR-018–FR-020); nothing in this phase
  lets AI create or auto-confirm a categorized record. **Pass.**
- **Principle VI/VII (privacy, tenant isolation)**: Every new column and
  trigger enforces same-workspace, same-type checks; RLS policies keep the
  existing owner/admin-write, any-member-read shape extended to the new
  `DELETE` policy. **Pass.**
- **Principle IX (architecture authority)**: All hierarchy/type/
  archived-parent validation lives in Postgres triggers and FastAPI route
  logic, not the frontend; the frontend only renders and posts selections.
  **Pass.**
- **Principle X (financial accuracy)**: No change to how amounts are
  stored or summed; category reassignment/rename/disable never alters
  `amount_minor` or record status. Report totals are re-verified in
  Phase 0/1 design to still equal the sum of confirmed records regardless
  of category tree changes (research.md Decision 10). **Pass.**
- **Principle XI (reports integrity)**: Category breakdown and the new
  subcategory drill-down are computed only from confirmed records; a
  disabled/renamed category still shows its historical totals under its
  current name rather than hiding them (FR-017). **Pass.**
- **Principle XVI (spec-kit workflow)**: This plan follows an approved
  spec (`spec.md`, clarified); implementation does not begin until
  `/speckit-tasks` and `/speckit-analyze` complete, per user instruction
  for this session. **Pass.**

No violations identified; **Complexity Tracking is not needed**.

## Project Structure

### Documentation (this feature)

```text
specs/013-hierarchical-categories/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── categories-api.md
│   ├── records-api.md
│   ├── extractions-api.md
│   └── reports-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

**Structure Decision**: Existing web application monolith
(`apps/api` FastAPI backend + `apps/web` Next.js frontend + `supabase/`
migrations) — no new project/package is introduced. This phase's changes
land entirely inside the existing layout:

```text
supabase/
└── migrations/
    └── 20260722000000_hierarchical_categories.sql   # new

apps/api/
├── app/
│   ├── routes/
│   │   ├── categories.py          # rewritten: tree responses, subcategory create/reorder/delete
│   │   ├── incomes.py             # extended: category_id on create/update/read
│   │   ├── expenses.py            # extended: category validation errors only (field already existed)
│   │   ├── extractions.py         # extended: suggested_category_id resolution
│   │   ├── dashboard.py           # extended: main-category grouping
│   │   └── reports.py             # extended: income_category_breakdown, new subcategory drill-down route
│   ├── schemas/
│   │   ├── categories.py          # rewritten: tree/parent/type/system fields
│   │   ├── incomes.py             # extended: category_id
│   │   ├── extractions.py         # extended: suggested_category_id
│   │   ├── dashboard.py           # extended: SubcategoryBreakdownItem
│   │   └── reports.py             # extended: income_category_breakdown
│   └── services/
│       └── dashboard.py           # rewritten category-breakdown query + new drill-down query
└── tests/
    ├── test_categories_hierarchy_manage.py     # new
    ├── test_incomes_category.py                # new
    ├── test_expenses_hierarchical_category.py  # new
    ├── test_extraction_category_suggestion.py  # new
    └── test_reports_category_drilldown.py      # new

apps/web/
├── app/[locale]/w/[workspaceId]/categories/     # extended: two-level tree UI
├── components/category/
│   ├── CategoryForm.tsx            # extended: parent/type selection
│   ├── CategoryList.tsx            # extended: nested subcategory rows, reorder within level
│   └── CategoryPicker.tsx          # new: main+sub selection control shared by income/expense forms
├── components/dashboard/CategoryBreakdown.tsx   # extended: drill-down interaction
├── hooks/use-categories.ts         # extended: tree shape, subcategory mutations
├── lib/api/categories.ts           # extended: tree types, new endpoints
├── lib/i18n/category-labels.ts     # new: translation_key → message lookup helper
├── messages/{en,ar}.json           # extended: categories.catalog.* namespace
└── tests/ + e2e/                   # new/extended per quickstart.md
```

## Complexity Tracking

*No violations — table intentionally omitted.*
