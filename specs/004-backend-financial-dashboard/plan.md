# Implementation Plan: Backend Financial Calculations and Dashboard Data

**Branch**: `004-backend-financial-dashboard` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-backend-financial-dashboard/spec.md`

## Summary

Add a single authenticated endpoint — `GET /workspaces/{workspace_id}/dashboard` —
that returns the full financial snapshot for a workspace in one combined response:
confirmed income total, confirmed expense total, remaining balance, per-category
expense breakdown (including an uncategorised group), the most recent N confirmed
records (both income and expense), and the pending AI extraction count. All
aggregation runs over the `incomes`, `expenses`, and `categories` tables Phase 3
introduced, filtered to `status = 'confirmed'` and scoped to the current calendar
month as determined by UTC+3. No new database tables or migrations are required.
Calculation logic lives in a dedicated service module (`services/dashboard.py`) so
Phase 9 (reports) can reuse it without duplication, satisfying FR-015.

## Technical Context

**Language/Version**: Python 3.11+ for `apps/api` (extended this phase). No changes
to `supabase/` or `apps/web/`.

**Primary Dependencies**: FastAPI, SQLAlchemy async engine + `asyncpg`, `PyJWT[crypto]`
— all established in Phases 2/3, reused unchanged. No new Python package is required
this phase.

**Storage**: Supabase Postgres — read-only aggregation over the `incomes`, `expenses`,
and `categories` tables Phase 3 created. No new tables, columns, or migrations are
needed.

**Testing**: `pytest` + `pytest-asyncio` + `httpx` (ASGI transport) — same pattern
as Phase 3. Integration tests sign in as real local-Auth users via the Supabase CLI
stack to exercise RLS, role access (including Viewer read-access), and confirmed-only
filtering directly against Postgres.

**Target Platform**: Local development via Supabase CLI; hosted Supabase for
staging/production — unchanged from Phase 3.

**Project Type**: Web application (backend only this phase). `apps/web` is
untouched — Phase 5 builds the dashboard UI.

**Performance Goals**: Dashboard response within 2 seconds for any workspace with
up to 10,000 confirmed records (SC-001). No throughput SLA is specified for MVP.

**Constraints**:
- All amounts aggregated and returned as integer minor units (halalas); no
  floating-point arithmetic (FR-010, Constitution Principle X).
- Only `status = 'confirmed'` records included in any total, breakdown, or
  recent-records list (FR-003).
- Current calendar month boundaries calculated using UTC+3 (Saudi Arabia local
  time, fixed offset for MVP — Clarification 1, research.md Decision 1).
- Single combined response endpoint; no separate endpoints per section (FR-002,
  Clarification 2).
- Recent-records limit is a query parameter (default 5, min 1, max 50 —
  Clarification 3, FR-008, research.md Decision 4).
- Negative remaining balance returned as a plain signed integer; no supplementary
  flag (Clarification 4, FR-001).
- Pending AI extraction count returns 0 this phase (Phase 8 replaces this —
  research.md Decision 3).
- No caching; every request re-aggregates from live data (spec Assumption 8).
- Non-members get 404; unauthenticated callers get 401 — same Phase 2 session
  validation pattern (FR-011, research.md Decision 7).

**Scale/Scope**: 1 new endpoint; 1 new route module; 1 new service module; 1 new
schema module; 5 integration test files covering SC-001 through SC-008.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability this phase | Status |
|---|---|---|
| I. Core Product Principle | Dashboard data is the explicit core product promise — "see exactly what remains" | PASS |
| II. Budgeting Philosophy | Remaining Balance = Confirmed Total Income − Confirmed Total Expenses; implemented exactly | PASS |
| III. MVP Scope Discipline | Custom period filtering, caching, and report aggregation explicitly deferred; only current-month dashboard built | PASS |
| IV. Saudi-First Default | Period boundaries use UTC+3; currency SAR-only; amounts in halalas | PASS |
| V. Manual-First, AI-Optional | Aggregates only confirmed manual records; pending AI count is a 0-placeholder until Phase 8 | PASS |
| VI. Privacy and Security | Session validation + workspace membership enforced before any data returned; non-member → 404 (no existence leak) | PASS |
| VII. Workspace & Multi-Tenant Isolation | Every aggregation query scoped to `workspace_id` and filtered through RLS | PASS |
| VIII. Storage and File Retention | No file storage touched | N/A |
| IX. Architecture Authority | FastAPI owns all calculation logic; frontend receives totals, performs no arithmetic | PASS |
| X. Financial Accuracy (NON-NEGOTIABLE) | Integer minor units; `COALESCE(SUM(...), 0)`; confirmed-only filter; negative balance returned as-is | PASS |
| XI. Reports Integrity | Calculation logic in `services/dashboard.py`; Phase 9 calls same functions — no divergence possible (FR-015) | PASS |
| XII. History Tracking | No activity logging this phase | N/A |
| XIII. Future Monetization Readiness | No billing surface touched | N/A |
| XIV. Testing Requirements | SC-002 (balance accuracy), SC-005 (no draft/deleted in totals), SC-006 (isolation), SC-007 (auth rejection) all covered by integration tests | PASS |
| XV. Scope Control | One endpoint, one service module, read-only over existing tables; nothing speculative | PASS |
| XVI. Spec-Kit Workflow | Spec → clarify → this plan, in order; no implementation started | PASS |

No violations identified. Complexity Tracking table is not applicable.

**Post-Phase 1 re-check**: All gates remain PASS. `research.md` confirms no new
tables are required; `data-model.md` confirms all aggregation entities are derived
from Phase 3 tables; the shared-service approach for FR-015 strengthens Principle XI
without introducing a new architectural boundary.

## Project Structure

### Documentation (this feature)

```text
specs/004-backend-financial-dashboard/
├── plan.md                               # This file
├── research.md                           # Phase 0 output
├── data-model.md                         # Phase 1 output
├── quickstart.md                         # Phase 1 output
├── contracts/
│   └── dashboard-api.md                  # Phase 1 output
└── tasks.md                              # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── main.py                           # existing — registers 1 new router
│   ├── routes/
│   │   └── dashboard.py                  # NEW — single GET endpoint
│   ├── services/
│   │   └── dashboard.py                  # NEW — aggregation logic, reusable by Phase 9
│   └── schemas/
│       └── dashboard.py                  # NEW — Pydantic request/response models
└── tests/
    ├── test_dashboard_summary.py          # NEW — US1/US2: totals and balance accuracy
    ├── test_dashboard_category_breakdown.py  # NEW — US3: category totals and uncategorised
    ├── test_dashboard_recent_activity.py  # NEW — US4: recent records, limit param
    ├── test_dashboard_period.py           # NEW — US5: UTC+3 month scoping
    └── test_dashboard_access.py          # NEW — SC-006/SC-007: isolation and auth

supabase/                                 # unchanged — no new tables or migrations
apps/web/                                 # unchanged — Phase 5 builds the UI
```

**Structure Decision**: Continue the `apps/api` / `supabase` / `apps/web` monolith
layout from Phases 1–3. The new `services/` directory under `apps/api/app/` separates
HTTP concerns (routes) from business logic (services), a standard FastAPI pattern and
a prerequisite for FR-015's shared-logic requirement. No Postgres view or materialized
view is introduced — inline parameterised SQL in service functions is sufficient at
MVP scale and keeps the reuse path for Phase 9 explicit rather than hidden behind a
database object.

## Complexity Tracking

> No Constitution Check violations were identified — this section is not applicable.
