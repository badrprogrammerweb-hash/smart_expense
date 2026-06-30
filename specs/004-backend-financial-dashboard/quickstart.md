# Quickstart: Backend Financial Calculations and Dashboard Data

Validation guide for Phase 4. Run scenarios after implementing the
endpoint to confirm the feature works end-to-end before marking tasks done.

## Prerequisites

- Phase 3 fully implemented and passing: `incomes`, `expenses`, and
  `categories` tables exist with RLS; all Phase 3 endpoints work.
- Supabase CLI stack running locally:
  ```
  supabase start
  ```
- FastAPI app running (from `apps/api/`):
  ```
  uvicorn app.main:app --reload
  ```
- At least two test users registered (User A = Owner, User B = Member or
  Viewer) in two separate workspaces (Workspace 1 and Workspace 2).
- An auth token for each user obtainable via
  `POST /auth/login` or Supabase CLI `supabase auth get-user`.

Refer to `../../002-auth-workspace-foundation/quickstart.md` for the
local test-user setup steps.

## Scenario 1: Accurate dashboard summary (US1 / SC-001, SC-002)

**Purpose**: Verify totals and remaining balance are correct.

1. As User A (Owner of Workspace 1), create two income records in the
   current calendar month:
   ```
   POST /workspaces/{w1}/incomes
   { "amount_minor": 500000, "occurred_on": "<current-month>-01" }

   POST /workspaces/{w1}/incomes
   { "amount_minor": 200000, "occurred_on": "<current-month>-15" }
   ```
2. Create two expense records:
   ```
   POST /workspaces/{w1}/expenses
   { "amount_minor": 120000, "occurred_on": "<current-month>-05", "category_id": "<rent-uuid>" }

   POST /workspaces/{w1}/expenses
   { "amount_minor": 45000, "occurred_on": "<current-month>-10" }
   ```
3. Call `GET /workspaces/{w1}/dashboard`.
4. **Expected**:
   - `summary.total_income_minor` = `700000`
   - `summary.total_expenses_minor` = `165000`
   - `summary.remaining_balance_minor` = `535000`
   - `summary.currency` = `"SAR"`
   - `period.start` = first day of current month, `period.end` = last day
     of current month.

## Scenario 2: Balance updates after record change (US2 / SC-003)

**Purpose**: Verify the next fetch reflects a create, edit, or delete.

1. Starting from Scenario 1 state.
2. Add a new confirmed expense:
   ```
   POST /workspaces/{w1}/expenses
   { "amount_minor": 50000, "occurred_on": "<current-month>-20" }
   ```
3. Call `GET /workspaces/{w1}/dashboard`.
4. **Expected**: `remaining_balance_minor` = `485000` (previous `535000 −
   50000`).
5. Delete that expense (soft-delete):
   ```
   DELETE /workspaces/{w1}/expenses/{new-expense-id}
   ```
6. Call `GET /workspaces/{w1}/dashboard` again.
7. **Expected**: `remaining_balance_minor` = `535000` (restored).

## Scenario 3: Category breakdown totals (US3 / SC-004)

**Purpose**: Verify category breakdown sums equal total expenses and
uncategorised expenses are grouped separately.

1. Starting from Scenario 1 state (Rent expense = 120000, uncategorised
   expense = 45000).
2. Call `GET /workspaces/{w1}/dashboard`.
3. **Expected** `category_breakdown`:
   - One entry with the Rent category name, `total_minor` = `120000`.
   - One entry with `category_id: null`, `category_name: "Uncategorized"`,
     `total_minor` = `45000`.
   - Sum of all `total_minor` values = `165000` (equals
     `summary.total_expenses_minor`).
4. Ordered by `total_minor` descending: Rent first, then Uncategorized.

## Scenario 4: Recent records (US4 / FR-008)

**Purpose**: Verify recent records contain only confirmed records from the
current period, in reverse chronological order, respecting the limit.

1. Starting from Scenario 1 state (2 incomes + 2 expenses in current month).
2. Call `GET /workspaces/{w1}/dashboard` (no `recent_limit` parameter).
3. **Expected**: `recent_records` has 4 entries (all 4 are in current month
   and 4 ≤ default limit 5), ordered by `occurred_on` descending.
4. Call `GET /workspaces/{w1}/dashboard?recent_limit=2`.
5. **Expected**: `recent_records` has exactly 2 entries (the two most
   recent).
6. Call `GET /workspaces/{w1}/dashboard?recent_limit=0`.
7. **Expected**: `422` with `error.code: "invalid_limit"`.
8. Call `GET /workspaces/{w1}/dashboard?recent_limit=51`.
9. **Expected**: `422` with `error.code: "invalid_limit"`.

## Scenario 5: Period scoping (US5 / UTC+3 boundary)

**Purpose**: Verify only current-month records appear in totals.

1. Create an income record dated to the **previous** month:
   ```
   POST /workspaces/{w1}/incomes
   { "amount_minor": 100000, "occurred_on": "<prev-month>-28" }
   ```
2. Call `GET /workspaces/{w1}/dashboard`.
3. **Expected**: `summary.total_income_minor` still equals `700000` (the
   previous-month record is excluded from the totals).
4. `recent_records` does not include the previous-month income.

## Scenario 6: Negative remaining balance

**Purpose**: Verify the response returns the raw signed integer when
expenses exceed income.

1. In a clean workspace (or subtract from Scenario 1 by deleting the
   incomes), create one expense larger than any income:
   ```
   POST /workspaces/{w1}/expenses
   { "amount_minor": 800000, "occurred_on": "<current-month>-12" }
   ```
   (Assuming total income < 800000 for that workspace.)
2. Call `GET /workspaces/{w1}/dashboard`.
3. **Expected**: `summary.remaining_balance_minor` is a **negative**
   integer — for example, `-100000`. No `is_overspent` field appears.

## Scenario 7: Empty workspace (FR-016)

**Purpose**: Verify graceful handling of a workspace with no records.

1. Use a freshly created workspace with no income or expense records.
2. Call `GET /workspaces/{new-workspace}/dashboard`.
3. **Expected**:
   - `summary.total_income_minor` = `0`
   - `summary.total_expenses_minor` = `0`
   - `summary.remaining_balance_minor` = `0`
   - `category_breakdown` = `[]`
   - `recent_records` = `[]`
   - `pending_ai_count` = `0`
   - HTTP `200 OK` (not an error).

## Scenario 8: No draft or deleted records in totals (SC-005)

**Purpose**: Verify confirmed-only filtering.

1. Starting from a workspace with one confirmed income (SAR 1,000) and one
   confirmed expense (SAR 200).
2. Soft-delete the expense:
   ```
   DELETE /workspaces/{w1}/expenses/{expense-id}
   ```
3. Call `GET /workspaces/{w1}/dashboard`.
4. **Expected**:
   - `summary.total_expenses_minor` = `0` (deleted record excluded).
   - `summary.remaining_balance_minor` = `100000` (full income remains).
   - The deleted expense does not appear in `recent_records`.

## Scenario 9: Tenant isolation (SC-006 / SC-007)

**Purpose**: Verify Workspace 2 data never appears in Workspace 1 dashboard,
and non-members are rejected.

1. As User A (Owner of Workspace 1), create income in Workspace 2 (if User A
   also owns it), or as the owner of Workspace 2 create income there.
2. Call `GET /workspaces/{w1}/dashboard` as User A.
3. **Expected**: Workspace 2 records do not appear in any field.
4. Call `GET /workspaces/{w1}/dashboard` with an invalid or expired token.
5. **Expected**: `401 unauthorized`.
6. Call `GET /workspaces/{w1}/dashboard` as a user who is not a member of
   Workspace 1.
7. **Expected**: `404 not_found`.

## Scenario 10: All roles can read (FR-012)

**Purpose**: Confirm Viewer access is permitted.

1. As User B (Viewer of Workspace 1), call
   `GET /workspaces/{w1}/dashboard`.
2. **Expected**: `200 OK` with a valid dashboard response — Viewers are
   allowed to read dashboard data.

## Automated test coverage map

| Test file | Scenarios covered |
|---|---|
| `test_dashboard_summary.py` | 1, 2, 6, 7, 8 |
| `test_dashboard_category_breakdown.py` | 3 |
| `test_dashboard_recent_activity.py` | 4 |
| `test_dashboard_period.py` | 5 |
| `test_dashboard_access.py` | 9, 10 |
