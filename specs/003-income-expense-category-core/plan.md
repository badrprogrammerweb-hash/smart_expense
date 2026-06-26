# Implementation Plan: Income, Expense, and Category Core

**Branch**: `003-income-expense-category-core` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-income-expense-category-core/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add the first business-data tables — `incomes`, `expenses`, `categories` —
on top of the Phase 2 workspace/membership foundation, with RLS as the
enforced permission boundary (not application-only checks). Income
creation is Owner/Admin-only; expense creation is open to any non-Viewer
member, with edit/delete of expenses restricted to the record's creator
unless the caller is Owner/Admin; category management (create, rename,
archive, reorder) is Owner/Admin-only, matching the implementation plan's
per-role capability list. Every workspace is seeded with the Saudi-first
default category set at creation time via a trigger, mirroring the
Owner-bootstrap trigger pattern from Phase 2. Money is stored as integer
minor units (halalas) with SAR fixed as the only currency this phase.
Records are soft-deleted (excluded from confirmed totals, retained for
traceability, no restore) and edits/deletes use last-write-wins with no
optimistic locking, per this phase's clarifications. No file upload, AI
extraction, dashboard/report aggregation, or activity-history logging is
built this phase (FR-028) — those remain Phase 4, 6, 8, and 9. No frontend
UI is built this phase (Phase 5).

## Technical Context

**Language/Version**: Python 3.11+ for `apps/api` (extended this phase); SQL (Postgres 15, Supabase-managed) for a new file under `supabase/migrations/`. `apps/web` (TypeScript/Next.js 16) is untouched — Phase 5 builds its UI.

**Primary Dependencies**: FastAPI, SQLAlchemy async engine + `asyncpg`, `PyJWT[crypto]` — all already established in Phase 2 (`apps/api/requirements.txt`) and reused unchanged. No new Python dependency is needed this phase.

**Storage**: Supabase Postgres — three new tables (`incomes`, `expenses`, `categories`), each workspace-scoped and RLS-enabled, foreign-keyed to the `workspaces` and `user_profiles` tables Phase 2 created (`data-model.md`).

**Testing**: `pytest` + `pytest-asyncio` + `httpx` (ASGI transport) for route-level FastAPI tests, same pattern as Phase 2. Integration tests sign in as real local-Auth test users via the Supabase CLI stack to exercise RLS and role permissions directly (reusing Phase 2 research.md Decision 9), satisfying SC-002/SC-004/SC-006's "100%" verification requirements.

**Target Platform**: Local development via Supabase CLI; hosted Supabase for staging/production — unchanged from Phase 2.

**Project Type**: Web application (frontend + backend) monolith — this phase's changes are confined to `apps/api` and `supabase/`; `apps/web` is unaffected.

**Performance Goals**: No raw throughput/latency target is specified by the spec — SC-001 (<1 min to record an entry) is an end-to-end, human-paced task budget, not an API latency SLA, consistent with Phase 2's precedent. No NEEDS CLARIFICATION.

**Constraints**: Amounts stored as integer minor currency units (halalas), never floating-point (FR-023); SAR is the only currency accepted this phase (FR-024); zero, negative, or missing amounts and missing/invalid dates are rejected (FR-025/FR-026); income creation is Owner/Admin-only (FR-014); expense creation is open to Owner/Admin/Member, not Viewer (FR-002/FR-013); expense edit/delete is unrestricted for Owner/Admin and limited to the creator for Member (FR-012/FR-013); category create/rename/archive/reorder is Owner/Admin-only (research.md Decision 3, interpreting FR-016/017/019/020/022 against the implementation plan's per-role capability list); category names must be unique case-insensitively among a workspace's *active* (non-archived) categories (FR-018); concurrent edits/deletes use last-write-wins with no conflict error and no optimistic locking (Clarification 2); deleted income/expense records have no user-facing restore path this phase (Clarification 3); no receipt/invoice file linkage, AI extraction, dashboard/report aggregation, or activity-history logging is implemented this phase (FR-028).

**Scale/Scope**: 3 new tables; 14 new endpoints (5 each for incomes/expenses: list, create, get, update, delete; 4 for categories: list, create, update, reorder); 1 new migration file; a default-category-seeding trigger; RLS policies and `CHECK`/unique constraints enforcing every permission and validation rule above at the database level.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability this phase | Status |
|---|---|---|
| I. Core Product Principle | Income, expense, and category records are explicitly in-scope MVP surface; no excluded feature added | PASS |
| II. Budgeting Philosophy | This phase produces the confirmed income/expense records the remaining-balance formula will consume in Phase 4; no remaining-balance computation is built here | PASS |
| III. MVP Scope Discipline | FR-028 explicitly excludes files/AI/dashboard/reports/history this phase | PASS |
| IV. Saudi-First Default | Every workspace is seeded with the constitution's exact 15-category default set at creation (FR-016) | PASS |
| V. Manual-First, AI-Optional | Pure manual entry; no AI surface touched | PASS |
| VI. Privacy and Security | RLS enforces every create/edit/delete/archive rule; no secrets involved this phase | PASS |
| VII. Workspace & Multi-Tenant Isolation | Every income, expense, and category row is workspace-scoped and RLS-isolated (FR-010/FR-011) | PASS |
| VIII. Storage and File Retention | No file upload exists yet (Phase 6); expense schema intentionally adds no placeholder file-link column this phase (research.md Decision 10) | N/A |
| IX. Architecture Authority | FastAPI + Postgres RLS own every authorization/validation rule; frontend doesn't exist yet this phase | PASS |
| X. Financial Accuracy (NON-NEGOTIABLE) | Integer minor units, no floats (FR-023); confirmed-only totals exclude deleted records (FR-007/FR-009); soft delete preserves traceability | PASS |
| XI. Reports Integrity | No reports exist yet (Phase 9) | N/A |
| XII. History Tracking | No activity-history logging this phase (FR-028); deferred to Phase 9 | N/A |
| XIII. Future Monetization Readiness | No billing surface touched | N/A |
| XIV. Testing Requirements | Income/expense calculations, edit/delete recalculation, and role permissions are tested against a real local Postgres/Auth stack (research.md, reusing Phase 2 Decision 9) | PASS |
| XV. Scope Control | Every table/endpoint maps to an FR in spec.md; nothing speculative added | PASS |
| XVI. Spec-Kit Workflow | Spec → clarify → this plan, in order; no implementation has started | PASS |

No violations identified. Complexity Tracking table is not applicable.

**Post-Phase 1 re-check**: `research.md` and `data-model.md` resolve the
two permission interpretations this phase needed (category management
scope, Decision 3) and the soft-delete/concurrency model (Decisions 4–5)
entirely through RLS policies, `CHECK` constraints, and triggers — no
application-only check was introduced as a substitute. The deliberate
`ON DELETE RESTRICT` choice for `incomes.created_by`/`expenses.created_by`
(Decision 9) strengthens Principle X (financial records can never silently
disappear via an unrelated profile deletion) rather than weakening it. All
gates above still PASS unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/003-income-expense-category-core/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/
│   ├── incomes-api.md               # Phase 1 output (/speckit-plan command)
│   ├── expenses-api.md              # Phase 1 output (/speckit-plan command)
│   └── categories-api.md            # Phase 1 output (/speckit-plan command)
└── tasks.md                         # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── <timestamp>_income_expense_category_core.sql   # incomes, expenses,
│                                                        # categories tables, RLS
│                                                        # policies, default-category
│                                                        # seeding trigger
└── README.md                        # updated to describe the new tables

apps/api/
├── app/
│   ├── main.py                      # existing — registers 3 new routers
│   ├── routes/
│   │   ├── incomes.py               # NEW — contracts/incomes-api.md
│   │   ├── expenses.py              # NEW — contracts/expenses-api.md
│   │   └── categories.py            # NEW — contracts/categories-api.md
│   └── schemas/
│       ├── incomes.py               # NEW — Pydantic request/response models
│       ├── expenses.py              # NEW — Pydantic request/response models
│       └── categories.py            # NEW — Pydantic request/response models
└── tests/
    ├── test_incomes_create.py            # NEW — US1
    ├── test_expenses_create.py           # NEW — US1
    ├── test_income_expense_edit_delete.py # NEW — US2
    ├── test_categories_manage.py          # NEW — US3
    └── test_role_permissions_phase3.py    # NEW — US4

apps/web/                            # unchanged this phase (Phase 5 builds the UI)
```

**Structure Decision**: Continue the monolith layout established in
Phase 1 and extended in Phase 2 (`apps/web`, `apps/api`, `supabase`). This
phase's real work lands in `apps/api` (three new route/schema modules) and
`supabase/migrations` (one new migration); `apps/web` is untouched because
Phase 5 owns the income/expense/category UI per the master implementation
plan's phase list. No new top-level boundary is introduced.

## Complexity Tracking

> No Constitution Check violations were identified — this section is not applicable.
