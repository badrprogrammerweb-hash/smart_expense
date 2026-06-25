---

description: "Task list for Income, Expense, and Category Core (003-income-expense-category-core)"
---

# Tasks: Income, Expense, and Category Core

**Input**: Design documents from `/specs/003-income-expense-category-core/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principle XIV requires income/expense calculations, remaining-balance accuracy, and role permissions to be tested, and spec.md's SC-002/SC-004/SC-006 require "100%" verified outcomes — `research.md` Decision 13 reuses Phase 2's real local-Supabase-stack testing approach (not mocks) for exactly this reason.

**Organization**: Tasks are grouped by user story (US1, US2, US3, US4 from `spec.md`) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in each description

## Path Conventions

Monolith web application layout per `plan.md`: this feature's changes are
confined to `apps/api` (backend) and `supabase` (database); `apps/web` is
untouched (Phase 5 builds its UI).

---

## Phase 1: Setup

No new dependencies, environment variables, or tooling are required this
phase — `research.md`'s Outcome confirms this feature reuses Phase 2's
Python dependencies, Supabase CLI workflow, and test stack unchanged.
Proceed directly to Phase 2: Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, RLS, triggers, and Pydantic schemas that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 Create `supabase/migrations/20260625000000_income_expense_category_core.sql` defining the `categories`, `incomes`, and `expenses` tables with the column types and `CHECK` constraints from `data-model.md` (FR-001, FR-002, FR-003, FR-016, FR-023, FR-024, FR-025, FR-026)
- [X] T002 Append the `SECURITY DEFINER` `seed_default_categories()` function and its `AFTER INSERT` trigger on `workspaces` to `supabase/migrations/20260625000000_income_expense_category_core.sql`, inserting the constitution's 15-item Saudi-first default category set with `sort_order` 0–14 (depends on T001; research.md Decision 7; FR-016)
- [X] T003 Append the partial unique index `categories_unique_active_name on categories (workspace_id, lower(name)) where not is_archived` to `supabase/migrations/20260625000000_income_expense_category_core.sql` (depends on T001; research.md Decision 8; FR-018)
- [X] T004 Append the `BEFORE INSERT OR UPDATE OF category_id` cross-table trigger on `expenses` to `supabase/migrations/20260625000000_income_expense_category_core.sql`: when `category_id` is newly set or changed, reject a value not belonging to the same `workspace_id` (`category_not_in_workspace`) and reject an archived category (`category_archived`); editing an expense without touching `category_id` must never re-trigger this check, so an already-assigned archived category's reference is preserved (depends on T001; data-model.md `expenses` Cross-table trigger; FR-021)
- [X] T005 Append a shared `set_updated_at()` trigger function and `BEFORE UPDATE` triggers on `categories`, `incomes`, and `expenses` to `supabase/migrations/20260625000000_income_expense_category_core.sql` (depends on T001)
- [X] T006 Append `ENABLE ROW LEVEL SECURITY` and the `SELECT`/`INSERT`/`UPDATE` policies for `categories` to `supabase/migrations/20260625000000_income_expense_category_core.sql` — read for any workspace member, create/rename/archive/reorder for `owner`/`admin` only, no `DELETE` policy (depends on T001; research.md Decision 3; FR-011, FR-016, FR-017, FR-019, FR-020, FR-022)
- [X] T007 Append `ENABLE ROW LEVEL SECURITY` and the `SELECT`/`INSERT`/`UPDATE` policies for `incomes` to `supabase/migrations/20260625000000_income_expense_category_core.sql` — read for any workspace member, create/edit (including soft-delete) for `owner`/`admin` only, no `DELETE` policy (depends on T001; research.md Decision 2; FR-001, FR-004, FR-005, FR-006, FR-007, FR-011, FR-012, FR-014)
- [X] T008 Append `ENABLE ROW LEVEL SECURITY` and the `SELECT`/`INSERT`/`UPDATE` policies for `expenses` to `supabase/migrations/20260625000000_income_expense_category_core.sql` — read for any workspace member, create for `owner`/`admin`/`member` (not `viewer`), edit (including soft-delete) for `owner`/`admin` on any row or `member` on rows where `created_by = auth.uid()`, no `DELETE` policy (depends on T001; FR-002, FR-003, FR-005, FR-006, FR-007, FR-011, FR-012, FR-013, FR-015)
- [X] T009 [P] Implement `apps/api/app/schemas/incomes.py` with Pydantic models `Income`, `IncomesListResponse`, `IncomeCreateRequest`, `IncomeUpdateRequest` matching `data-model.md` and `contracts/incomes-api.md`
- [X] T010 [P] Implement `apps/api/app/schemas/expenses.py` with Pydantic models `Expense`, `ExpensesListResponse`, `ExpenseCreateRequest`, `ExpenseUpdateRequest` matching `data-model.md` and `contracts/expenses-api.md`
- [X] T011 [P] Implement `apps/api/app/schemas/categories.py` with Pydantic models `Category`, `CategoriesListResponse`, `CategoryCreateRequest`, `CategoryUpdateRequest`, `CategoryReorderRequest` matching `data-model.md` and `contracts/categories-api.md`
- [X] T012 [P] Extend `apps/api/tests/conftest.py` with reusable helper functions: HTTP-based `create_income`, `create_expense`, `create_category`, `list_incomes`, `list_expenses`, `list_categories` (built on the existing `api_client`/`TestUser` fixtures), plus a SQL-based `default_category_id(connection, workspace_id, name)` helper (using the existing `db_connection` fixture) that looks up one of the Foundational-seeded default categories directly, so US1/US2 tests can reference a valid `category_id` before US3's category endpoints exist

**Checkpoint**: Foundation ready — schema, RLS, triggers, and Pydantic schemas all exist; user story implementation can now begin

---

## Phase 3: User Story 1 - Manually record income and expenses (Priority: P1) 🎯 MVP

**Goal**: An Owner/Admin can record income and any non-Viewer member can record an expense, both saved as confirmed immediately, with no AI feature needed (SC-001).

**Independent Test**: As Owner, `POST` an income record; as Member, `POST` an expense record; both return `201` with `status: "confirmed"`. As Member, `POST` an income record and confirm `403` (`quickstart.md` step 3).

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US1] Contract test in `apps/api/tests/test_incomes_create.py`: `POST /workspaces/{id}/incomes` returns `201` with `status: "confirmed"` for Owner/Admin, `403` for Member/Viewer, `422` for zero/negative/missing `amount_minor` and missing/invalid `occurred_on`; `GET /workspaces/{id}/incomes` lists it for any role (`contracts/incomes-api.md`; FR-001, FR-004, FR-014, FR-025, FR-026)
- [X] T014 [P] [US1] Contract test in `apps/api/tests/test_expenses_create.py`: `POST /workspaces/{id}/expenses` returns `201` with `status: "confirmed"` for Owner/Admin/Member, `403` for Viewer; optional `category_id`, `description`, `merchant_name` are accepted and stored as distinct fields; `422` for zero/negative/missing `amount_minor`, missing/invalid `occurred_on`, a `category_id` from another workspace, or a `category_id` that is archived (`category_archived`); `GET /workspaces/{id}/expenses` lists it for any role (`contracts/expenses-api.md`; FR-002, FR-003, FR-004, FR-013, FR-015, FR-021, FR-025, FR-026; the `category_id` used here comes from the `default_category_id` SQL helper, not the categories API, since that endpoint isn't built until US3)

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement `GET /workspaces/{workspace_id}/incomes` and `POST /workspaces/{workspace_id}/incomes` in `apps/api/app/routes/incomes.py` per `contracts/incomes-api.md`, including the explicit Owner/Admin role check on create (depends on T007, T009)
- [X] T016 [US1] Register the incomes router in `apps/api/app/main.py` (depends on T015)
- [X] T017 [P] [US1] Implement `GET /workspaces/{workspace_id}/expenses` and `POST /workspaces/{workspace_id}/expenses` in `apps/api/app/routes/expenses.py` per `contracts/expenses-api.md`, including the explicit non-Viewer role check on create and the category-workspace-match check (depends on T008, T010)
- [X] T018 [US1] Register the expenses router in `apps/api/app/main.py` (depends on T017, T016)
- [ ] T019 [US1] Validate User Story 1 per `quickstart.md` step 3: Owner creates income, Member creates an expense, Member's attempt to create income is denied (depends on T013-T018; SC-001)

**Checkpoint**: User Story 1 fully functional and testable independently

---

## Phase 4: User Story 2 - Edit and delete records with accurate totals (Priority: P1)

**Goal**: Authorized users can edit or soft-delete an income/expense record, with the change immediately reflected in what a confirmed-totals consumer would compute (SC-002, SC-003).

**Independent Test**: Edit an existing record's amount and confirm the change is visible immediately; delete a record and confirm it is excluded from confirmed records while the row is retained (`quickstart.md` step 4).

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T020 [P] [US2] Integration test in `apps/api/tests/test_income_expense_edit_delete.py`: `PATCH` updates amount/date/description/category and `updated_at`; `DELETE` soft-deletes (sets `status: "deleted"`), excluding the record from the list endpoint and from a confirmed-only sum computed from it, with no restore endpoint available; a soft-deleted record returns `404` on further `PATCH`/`DELETE`; a Member can edit/delete only the expense they created and gets `403` on another member's expense, while Owner/Admin can edit/delete any expense or income; a workspace whose expenses exceed its income still sums correctly (negative remaining balance is representable); two sequential `PATCH` (or `PATCH` then `DELETE`) calls against the same record both succeed with no conflict error, and the final state reflects the second call (last-write-wins); editing an expense's amount without touching `category_id` succeeds even if that expense's category was archived afterward, but changing `category_id` to a different archived category fails with `422 category_archived` (FR-005, FR-006, FR-007, FR-008, FR-009, FR-012, FR-013, FR-021; Clarifications 2 and 3; the `category_id` used here comes from the `default_category_id` SQL helper, not the categories API, since that endpoint isn't built until US3)

### Implementation for User Story 2

- [X] T021 [P] [US2] Implement `GET /workspaces/{workspace_id}/incomes/{income_id}`, `PATCH /workspaces/{workspace_id}/incomes/{income_id}`, and `DELETE /workspaces/{workspace_id}/incomes/{income_id}` (soft-delete) in `apps/api/app/routes/incomes.py` per `contracts/incomes-api.md`, including the Owner/Admin-only check and the already-deleted → `404` rule (depends on T015)
- [X] T022 [P] [US2] Implement `GET /workspaces/{workspace_id}/expenses/{expense_id}`, `PATCH /workspaces/{workspace_id}/expenses/{expense_id}`, and `DELETE /workspaces/{workspace_id}/expenses/{expense_id}` (soft-delete) in `apps/api/app/routes/expenses.py` per `contracts/expenses-api.md`, including the Owner/Admin-vs-creator-only-Member authorization check and the already-deleted → `404` rule (depends on T017)
- [ ] T023 [US2] Validate User Story 2 per `quickstart.md` step 4: confirm an edit and a delete each immediately change the confirmed-record sum computed from the list endpoints (depends on T020-T022; SC-002, SC-003)

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Organize expenses with categories (Priority: P2)

**Goal**: Every workspace has the Saudi-first default categories immediately, and Owner/Admin can create, rename, archive, and reorder categories without disturbing existing expenses' category references (SC-005).

**Independent Test**: Confirm a new workspace already has all 15 default categories; create a custom category, assign it to an expense, archive it, and confirm the expense keeps the reference while the archived category disappears from new selection (`quickstart.md` steps 2 and 7).

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T024 [P] [US3] Contract test in `apps/api/tests/test_categories_manage.py`: `GET /workspaces/{id}/categories` returns the 15 Saudi-first defaults immediately after workspace creation; `POST` creates a custom category for Owner/Admin (`201`), `403` for Member/Viewer, `409` for a name duplicating an active category case-insensitively; `PATCH` renames and/or archives for Owner/Admin (`403` otherwise), and an archived category's name becomes reusable while its existing expense association is unaffected; `PUT .../categories/order` resequences for a full, matching ID list and returns `422` for a mismatched set (`contracts/categories-api.md`; FR-016–FR-022)

### Implementation for User Story 3

- [ ] T025 [US3] Implement `GET /workspaces/{workspace_id}/categories` and `POST /workspaces/{workspace_id}/categories` in `apps/api/app/routes/categories.py` per `contracts/categories-api.md`, including the Owner/Admin-only create check and the duplicate-name `409` (depends on T006, T011)
- [ ] T026 [US3] Implement `PATCH /workspaces/{workspace_id}/categories/{category_id}` in `apps/api/app/routes/categories.py` per `contracts/categories-api.md` (rename and/or archive, Owner/Admin-only, duplicate-name `409`) (depends on T025)
- [ ] T027 [US3] Implement `PUT /workspaces/{workspace_id}/categories/order` in `apps/api/app/routes/categories.py` per `contracts/categories-api.md`, validating the submitted ID set exactly matches the workspace's current categories (depends on T025)
- [ ] T028 [US3] Register the categories router in `apps/api/app/main.py` (depends on T025)
- [ ] T029 [US3] Validate User Story 3 per `quickstart.md` steps 2 and 7: default categories present at creation with no setup call, duplicate-name rejection, and archive-then-reuse-name behavior (depends on T024-T028; SC-005)

**Checkpoint**: User Stories 1, 2, AND 3 all work independently

---

## Phase 6: User Story 4 - Enforce role-based permissions across income, expense, and category management (Priority: P2)

**Goal**: The complete Owner/Admin/Member/Viewer permission matrix holds consistently across income, expense, and category actions together (SC-004, SC-006). Every individual rule here was already implemented as part of US1–US3's contract-specified authorization checks (FR-012–FR-015); this story's purpose is the systematic, cross-entity verification that no gap exists between those per-story checks, not new production code.

**Independent Test**: In one team workspace with all four roles present, exercise every (role × entity × action) combination for income, expense, and category management and confirm each outcome matches the FR-012–FR-015 matrix (`quickstart.md` step 5), plus cross-workspace isolation for all three new endpoint groups (`quickstart.md` step 6).

### Tests for User Story 4

> **NOTE: Write these tests FIRST — they should already PASS against US1–US3's implementation; a failure here means a per-story check missed a case**

- [ ] T030 [P] [US4] Comprehensive integration test in `apps/api/tests/test_role_permissions_phase3.py`: with one Owner, Admin, Member, and Viewer in the same team workspace, assert the expected `200`/`201`/`204` vs `403` outcome for every income (create, edit, delete), expense (create, edit own, edit other's, delete own, delete other's), and category (create, rename, archive, reorder) action per role (User Story 4 acceptance scenarios 1–5; FR-012, FR-013, FR-014, FR-015), and confirm a non-member's request against any of the three new endpoint groups for another workspace returns `404` (FR-011)

### Validation for User Story 4

- [ ] T031 [US4] Validate User Story 4 per `quickstart.md` steps 5 and 6: the full role-permission matrix produces the expected allow/deny outcome across income, expense, and category actions, and cross-workspace requests are denied uniformly (depends on T030; SC-004, SC-006)

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across all user stories

- [ ] T032 [P] Update `supabase/README.md` to describe the `categories`, `incomes`, and `expenses` tables, their RLS policies, and their triggers, alongside the existing Phase 2 schema description
- [ ] T033 [P] Update `docs/setup.md`'s opening paragraph and test-suite section to mention that the income/expense/category endpoints (alongside the Phase 2 workspace endpoints) require the local Supabase stack
- [ ] T034 Run the full `quickstart.md` (steps 1–7) end-to-end against a fresh local Supabase stack as final cross-story validation
- [ ] T035 Update `specs/003-income-expense-category-core/spec.md` Status field from `Draft` to `Implemented` once T001–T034 are verified complete (closes out FR-001–FR-030, SC-001–SC-007)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Not applicable this phase — no new dependencies or tooling
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1) → US2 (P1) → US3 (P2) → US4 (P2), in that order: US2's edit/delete endpoints extend the same route files US1 creates; US3 is independent of US1/US2 (default categories are seeded automatically and category assignment is optional) but is ordered after them to match priority; US4 verifies the combined surface of US1–US3 together, so it must come last
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational, but its `PATCH`/`DELETE` handlers extend the same `incomes.py`/`expenses.py` files US1 creates — implement after US1
- **User Story 3 (P2)**: Can start after Foundational; independently testable, does not require US1/US2 (the default category trigger fires from workspace creation, not from any income/expense endpoint)
- **User Story 4 (P2)**: Can start only after US1, US2, and US3 all exist — it verifies their combined authorization surface, not new endpoints

### Within Each User Story

- Tests MUST be written and FAIL before implementation (except US4, whose tests are expected to already pass against US1–US3's checks)
- Schemas (Foundational) before routes
- Routes before router registration
- Story complete before moving to the next priority

### Parallel Opportunities

- T009, T010, T011, T012 (Foundational, four different files) can run in parallel with each other and with T001-T008 (the single migration file's sequential sections)
- T013, T014 (US1 tests, different files) can run in parallel; T015, T017 (different route files) can run in parallel; T016 must follow T015, and T018 must follow T017 and T016 (both register routers in the same `main.py`)
- T021, T022 (US2, different route files) can run in parallel
- T024 (US3) has no sibling test to parallelize with; T026, T027 both depend on T025 (same file) and are otherwise independent of each other in content but edit the same file, so apply sequentially
- T030 (US4) is the only new test file this phase
- T032, T033 (Polish, different files) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch both User Story 1 contract tests together:
Task: "Contract test for POST /workspaces/{id}/incomes in apps/api/tests/test_incomes_create.py"
Task: "Contract test for POST /workspaces/{id}/expenses in apps/api/tests/test_expenses_create.py"

# Launch both User Story 1 route implementations together (different files):
Task: "Implement GET/POST /workspaces/{workspace_id}/incomes in apps/api/app/routes/incomes.py"
Task: "Implement GET/POST /workspaces/{workspace_id}/expenses in apps/api/app/routes/expenses.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: an Owner can record income and a Member can record an expense — this alone proves the schema, RLS, and income/expense permission split work end-to-end

### Incremental Delivery

1. Complete Foundational → schema, RLS, triggers, and schemas ready
2. Add User Story 1 → validate independently → manual income/expense entry proven
3. Add User Story 2 → validate independently → edit/delete and confirmed-total accuracy proven
4. Add User Story 3 → validate independently → default categories and category management proven
5. Add User Story 4 → validate independently → full cross-entity role matrix proven
6. Polish → docs updated, full quickstart re-run

### Parallel Team Strategy

With multiple contributors:

1. Complete Foundational together (single contributor recommended, given the shared migration file)
2. Once Foundational is done:
   - Contributor A: User Story 1, then User Story 2 (shares `incomes.py`/`expenses.py` context)
   - Contributor B: User Story 3 (independent `categories.py` context)
3. Both converge for User Story 4 (the combined verification) and Polish

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] label maps each task to its user story for traceability
- Tests use a real local Supabase stack (Supabase CLI), not mocks — RLS cannot be meaningfully verified otherwise (research.md Decision 13, reusing Phase 2 Decision 9)
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
