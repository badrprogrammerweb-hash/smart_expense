# Tasks: Backend Financial Calculations and Dashboard Data

**Input**: Design documents from `specs/004-backend-financial-dashboard/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/dashboard-api.md ✅ | quickstart.md ✅

**Scope**: One new endpoint (`GET /workspaces/{workspace_id}/dashboard`), one new service
module, one new schema module. No new database tables or migrations. No frontend work
(Phase 5 owns the UI).

**Tests**: Integration tests are included — they verify RLS behaviour, confirmed-only
filtering, and financial accuracy rules that cannot be exercised by mocks.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5, per spec.md)
- Every task includes an exact file path

---

## Phase 1: Setup

**Purpose**: Create the new `services/` package introduced by this phase. All other
phases depend on this package existing.

- [X] T001 Create `apps/api/app/services/__init__.py` (empty package marker — this is the first use of a `services/` layer in the project)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pydantic schemas, period utility, pending-AI stub, and route skeleton.
All user-story implementation phases depend on these being complete.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [X] T002 Create Pydantic response models — `FinancialSummary`, `CategoryBreakdownItem`, `RecentRecord`, `DashboardPeriod`, and `DashboardData` — in `apps/api/app/schemas/dashboard.py`, following the shapes in `data-model.md § Response Entities`
- [X] T003 Implement `get_current_period() -> tuple[date, date]` in `apps/api/app/services/dashboard.py` using a fixed UTC+3 offset (`timezone(timedelta(hours=3))`) and `calendar.monthrange` to compute the first and last day of the current calendar month (research.md Decision 1)
- [X] T004 [P] Implement `get_pending_ai_count(workspace_id: UUID, conn) -> int` stub in `apps/api/app/services/dashboard.py` that unconditionally returns `0` (Phase 8 replaces this body — research.md Decision 3)
- [X] T005 Create `apps/api/app/routes/dashboard.py` with the `GET /workspaces/{workspace_id}/dashboard` route skeleton: accept the `_workspace_role` auth dependency (Phase 2 pattern), call `get_current_period()`, call `get_pending_ai_count()`, and return a `200 DashboardData` with placeholder zeros for fields not yet wired (T002 schemas required)
- [X] T006 Register the dashboard router in `apps/api/app/main.py` under the existing workspace-scoped prefix

**Checkpoint**: At this point the endpoint is reachable and returns a structurally
valid (zero-valued) `DashboardData` response. Auth and workspace membership checks
are already enforced by the `_workspace_role` dependency.

---

## Phase 3: User Stories 1 & 2 — Dashboard Summary and Real-time Balance (Priority: P1) 🎯 MVP

**Goal**: Return accurate confirmed income total, confirmed expense total, and
remaining balance for the current calendar month. Because there is no server-side
cache, every fetch reflects the live state of the database — satisfying both US1
(accurate summary) and US2 (balance updates immediately after any record change).

**Independent Test**: Create confirmed income and expense records in a workspace,
call `GET /workspaces/{workspace_id}/dashboard`, and verify the totals and remaining
balance match. Delete an expense and call again to verify balance recalculates.
See `quickstart.md` Scenarios 1, 2, 6, 7, 8.

### Implementation for US1 / US2

- [X] T007 [US1] Implement `get_income_total(workspace_id, period_start, period_end, conn) -> int` in `apps/api/app/services/dashboard.py` using `COALESCE(SUM(amount_minor), 0)` over `incomes` filtered to `status = 'confirmed'` and `occurred_on BETWEEN :period_start AND :period_end` (data-model.md § Income total query)
- [X] T008 [P] [US1] Implement `get_expense_total(workspace_id, period_start, period_end, conn) -> int` in `apps/api/app/services/dashboard.py` using the same pattern over `expenses` (data-model.md § Expense total query)
- [X] T009 [US1] Wire `get_income_total` and `get_expense_total` into `apps/api/app/routes/dashboard.py`: compute `remaining_balance_minor = income_total - expense_total` in Python (never in SQL — research.md Decision 2), populate `summary` and `period` fields in the `DashboardData` response, replacing the placeholder zeros from T005

### Tests for US1 / US2

- [X] T010 [US1] Write integration tests in `apps/api/tests/test_dashboard_summary.py` covering: correct income + expense totals and remaining balance (Scenario 1); balance update after adding an expense (Scenario 2a); balance update after deleting an expense (Scenario 2b); negative remaining balance returned as plain signed integer (Scenario 6); zero totals for empty workspace (Scenario 7); deleted expense excluded from totals (Scenario 8)
- [X] T011 [P] [US1] Write integration tests in `apps/api/tests/test_dashboard_access.py` covering: all roles (Owner, Admin, Member, Viewer) receive `200` (Scenario 10); unauthenticated caller receives `401` (Scenario 9d); non-member caller receives `404` (Scenario 9f); Workspace 2 data does not appear in Workspace 1 response (Scenario 9a–9c)

**Checkpoint**: User Stories 1 and 2 are fully functional and independently testable.
The dashboard returns correct financial totals, the remaining-balance formula is
verified, and role/isolation boundaries are enforced.

---

## Phase 4: User Story 3 — Category Spending Breakdown (Priority: P2)

**Goal**: Add the `category_breakdown` array to the dashboard response: one entry
per category that has at least one confirmed expense in the current period, ordered
by total descending, plus one entry for uncategorised expenses when any exist.

**Independent Test**: Create confirmed expenses assigned to different categories and
at least one uncategorised expense, then verify the category breakdown entries, their
totals, and that all totals sum to `summary.total_expenses_minor`. See `quickstart.md`
Scenario 3.

### Implementation for US3

- [X] T012 [US3] Implement `get_category_breakdown(workspace_id, period_start, period_end, conn) -> list[CategoryBreakdownItem]` in `apps/api/app/services/dashboard.py` using the LEFT JOIN + GROUP BY query in `data-model.md § Category breakdown query`; return `category_id: null, category_name: "Uncategorized"` for uncategorised rows (research.md Decision 6)
- [X] T013 [US3] Wire `get_category_breakdown` into `apps/api/app/routes/dashboard.py` and populate the `category_breakdown` field in the `DashboardData` response, replacing the empty-list placeholder

### Tests for US3

- [X] T014 [US3] Write integration tests in `apps/api/tests/test_dashboard_category_breakdown.py` covering: per-category totals correct; sum of breakdown equals `total_expenses_minor` (SC-004); uncategorised group appears with `category_id: null`; deleted expense excluded from breakdown; category with zero confirmed expenses omitted; correct descending order (Scenario 3)

**Checkpoint**: User Story 3 is fully functional. Category breakdown is accurate,
sums match expense totals, and the uncategorised group is correctly handled.

---

## Phase 5: User Story 4 — Recent Activity on Dashboard (Priority: P2)

**Goal**: Add the `recent_records` array to the dashboard response: up to
`recent_limit` confirmed income and expense records from the current period, ordered
by `occurred_on DESC` (tie-broken by `created_at DESC`). Expose `recent_limit` as a
validated query parameter (default 5, min 1, max 50).

**Independent Test**: Create several confirmed records, call the endpoint with and
without `?recent_limit=N`, and verify the correct number of records are returned
in reverse chronological order. See `quickstart.md` Scenario 4.

### Implementation for US4

- [X] T015 [US4] Implement `get_recent_records(workspace_id, period_start, period_end, recent_limit, conn) -> list[RecentRecord]` in `apps/api/app/services/dashboard.py` using the UNION ALL query in `data-model.md § Recent records query`; include both income and expense rows; order by `occurred_on DESC, created_at DESC`; apply `LIMIT :recent_limit`
- [X] T016 [US4] Add `recent_limit: int = Query(default=5, ge=1, le=50)` parameter to `GET /workspaces/{workspace_id}/dashboard` in `apps/api/app/routes/dashboard.py`; wire `get_recent_records` into the response; return `422 invalid_limit` for out-of-range values (contracts/dashboard-api.md § Errors)

### Tests for US4

- [X] T017 [US4] Write integration tests in `apps/api/tests/test_dashboard_recent_activity.py` covering: default 5 records returned when limit omitted; custom limit respected; results ordered by `occurred_on DESC`; only confirmed records appear; empty array for workspace with no confirmed records; `422 invalid_limit` for `recent_limit=0`; `422 invalid_limit` for `recent_limit=51` (Scenario 4)

**Checkpoint**: User Story 4 is fully functional. Recent activity shows only confirmed
records, honours the limit parameter, and validates bounds.

---

## Phase 6: User Story 5 — Current Period Defaults and UTC+3 Scoping (Priority: P3)

**Goal**: Verify that all dashboard totals, breakdowns, and recent records include
only records from the current calendar month as determined by UTC+3, and that the
`period` field in the response correctly reflects the first and last day of that month.

**Implementation note**: The period utility was built in T003 (Phase 2). This phase
consists solely of tests that verify the period scoping behaviour end-to-end.

**Independent Test**: Create confirmed records in the current month and in a previous
month, call the dashboard, and verify only the current-month records appear in totals.
See `quickstart.md` Scenario 5.

### Tests for US5

- [X] T018 [US5] Write integration tests in `apps/api/tests/test_dashboard_period.py` covering: previous-month income excluded from `total_income_minor`; previous-month expense excluded from `total_expenses_minor`; previous-month record absent from `recent_records`; `period.start` equals the first day of the current month in UTC+3; `period.end` equals the last day of the current month in UTC+3; workspace with no current-month records shows `0` totals (Scenario 5)

**Checkpoint**: All five user stories are fully functional and independently tested.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: FR-015 compliance verification and end-to-end validation.

- [X] T019 [P] Verify `apps/api/app/services/dashboard.py` public interface: confirm `get_income_total`, `get_expense_total`, `get_category_breakdown`, and `get_recent_records` are exported from the module with consistent parameter signatures (`workspace_id`, `period_start`, `period_end`, `conn`) so Phase 9 report routes can import and call them without modification (FR-015 reuse contract); note that full SC-008 parity validation — confirming dashboard and report totals are identical for the same period — is deferred to Phase 9 when the report endpoint exists
- [X] T020 Run all 10 quickstart.md validation scenarios against the local Supabase CLI stack (`supabase start` + `uvicorn app.main:app`) and confirm each scenario's expected outcome matches the actual response; document any deviation
- [X] T021 Seed a workspace with 10,000 confirmed expense records using the Phase 3 `POST /workspaces/{workspace_id}/expenses` endpoint or direct SQL insert, then time a `GET /workspaces/{workspace_id}/dashboard` request and confirm the response arrives within 2 seconds (SC-001, p95 single-client smoke test)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user story phases
- **US1/US2 (Phase 3)**: Depends on Phase 2 completion
- **US3 (Phase 4)**: Depends on Phase 2 completion; can start in parallel with Phase 3 once Phase 2 is done
- **US4 (Phase 5)**: Depends on Phase 2 completion; can start in parallel with Phases 3 and 4
- **US5 (Phase 6)**: Depends on Phase 3 completion (route must exist and return `period` field before period-scoping tests can run)
- **Polish (Phase 7)**: Depends on all user story phases completing

### User Story Dependencies

- **US1/US2 (P1)**: Can start after Phase 2 — no dependency on US3, US4, or US5
- **US3 (P2)**: Can start after Phase 2 — no dependency on US1/US2 or US4 (adds a new field to the response)
- **US4 (P2)**: Can start after Phase 2 — no dependency on US1/US2 or US3 (adds another new field)
- **US5 (P3)**: Tests depend on the route existing (Phase 3 T009 must be done); otherwise independent

### Within Each Phase

- Implementation tasks (service functions) before route-wiring tasks
- Route-wiring tasks before integration test tasks
- T007 and T008 can run in parallel (different function bodies in the same file)
- T010 and T011 can run in parallel (different test files)

---

## Parallel Opportunities

### Phase 2

```
# These can run in parallel:
T002  Create schemas/dashboard.py
T003  Implement get_current_period() in services/dashboard.py
T004  Implement get_pending_ai_count() stub in services/dashboard.py
```

### Phase 3 (US1/US2)

```
# These can run in parallel:
T007  Implement get_income_total() in services/dashboard.py
T008  Implement get_expense_total() in services/dashboard.py

# Then in parallel after T010 is drafted:
T010  test_dashboard_summary.py
T011  test_dashboard_access.py
```

### Phases 3, 4, 5 (once Phase 2 is complete)

```
# All three user story implementation tracks can run in parallel
# if multiple developers are available:
Phase 3 (US1/US2)  →  T007, T008, T009, T010, T011
Phase 4 (US3)      →  T012, T013, T014
Phase 5 (US4)      →  T015, T016, T017
```

---

## Implementation Strategy

### MVP First (US1/US2 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T006)
3. Complete Phase 3: US1/US2 (T007–T011)
4. **STOP and VALIDATE**: `GET /workspaces/{workspace_id}/dashboard` returns accurate
   income, expense, and remaining-balance totals; roles and isolation are enforced
5. This alone satisfies the core product promise: "See exactly what remains"

### Incremental Delivery

1. Setup + Foundational → endpoint is reachable (zero-valued response) ✅
2. US1/US2 → accurate summary totals and balance ✅ (MVP)
3. US3 → add category breakdown ✅
4. US4 → add recent activity + limit parameter ✅
5. US5 → verify period scoping ✅
6. Polish → FR-015 compliance and quickstart validation ✅

### Parallel Team Strategy

With two developers after Phase 2:

- **Developer A**: Phase 3 (US1/US2 — the critical P1 story)
- **Developer B**: Phase 4 (US3) then Phase 5 (US4)

---

## Notes

- `[P]` tasks touch different files or independent function bodies — no merge conflicts
- `services/dashboard.py` grows incrementally: T003/T004 (Phase 2) → T007/T008 (Phase 3) → T012 (Phase 4) → T015 (Phase 5); each addition does not modify existing function bodies
- `routes/dashboard.py` is also updated incrementally: T005 (skeleton) → T009 (summary) → T013 (categories) → T016 (recent + limit); each update adds new wired fields without changing previously wired ones
- Phase 8 (AI Extraction) will replace only the body of `get_pending_ai_count()` — no route, schema, or test change required in this phase's files
- Phase 9 (Reports) will import `get_income_total`, `get_expense_total`, `get_category_breakdown`, and `get_recent_records` from `services/dashboard.py` directly — T019 verifies this contract is clean before Phase 4 closes
