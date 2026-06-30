# Feature Specification: Backend Financial Calculations and Dashboard Data

**Feature Branch**: `004-backend-financial-dashboard`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "docs/implementation-plan.md - create a specification for Phase 4 ONLY."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Accurate Dashboard Summary (Priority: P1)

A workspace member opens their dashboard and immediately sees their current
financial position: total confirmed income, total confirmed expenses, remaining
balance, top spending categories, and recent activity — all calculated from
confirmed records only, scoped to the current period and their workspace.

**Why this priority**: The dashboard is the primary landing screen. If the
numbers shown here are wrong or missing, the product fails its core promise:
"See exactly what remains." All other Phase 4 stories depend on this
foundation being correct and accessible.

**Independent Test**: Can be tested by creating several confirmed income and
expense records in a workspace, then opening the dashboard and verifying that
the totals and remaining balance are correct. Delivers the core product value
— users can see their financial position — without any other story being built.

**Acceptance Scenarios**:

1. **Given** a workspace with confirmed income records totalling SAR 5,000 and
   confirmed expense records totalling SAR 1,800, **When** the user opens the
   dashboard, **Then** they see Total Income = SAR 5,000, Total Expenses =
   SAR 1,800, and Remaining Balance = SAR 3,200.

2. **Given** a workspace with no records, **When** the user opens the
   dashboard, **Then** they see Total Income = SAR 0, Total Expenses = SAR 0,
   and Remaining Balance = SAR 0.

3. **Given** a workspace containing pending AI extraction results not yet
   confirmed by the user, **When** the user views the dashboard, **Then** the
   totals reflect only confirmed records and the pending results do not appear
   in any financial total.

4. **Given** a workspace with a deleted expense record, **When** the user
   views the dashboard, **Then** the deleted record is excluded from all
   totals.

5. **Given** two separate workspaces each with their own records, **When**
   a member of Workspace A views their dashboard, **Then** they see only the
   totals for Workspace A and no data from Workspace B appears.

---

### User Story 2 - Remaining Balance Reflects Record Changes Immediately (Priority: P1)

After a user adds a new income or expense record, edits an existing one, or
deletes a record, the remaining balance and totals shown on the dashboard
update to reflect the change on the very next page load or data refresh.

**Why this priority**: Financial accuracy is a non-negotiable product
requirement. A stale or incorrect remaining balance after a record change
breaks user trust immediately and is the most critical failure mode for this
product.

**Independent Test**: Can be tested by adding a new confirmed expense record
and then refreshing the dashboard — the totals and remaining balance must
change to reflect the new record. Each create, edit, and delete action can be
validated individually.

**Acceptance Scenarios**:

1. **Given** a dashboard showing Remaining Balance = SAR 3,000, **When** the
   user adds a new confirmed expense of SAR 500, **Then** the dashboard shows
   Remaining Balance = SAR 2,500.

2. **Given** a dashboard showing Remaining Balance = SAR 2,000, **When** the
   user edits an existing income record from SAR 3,000 to SAR 4,000, **Then**
   the dashboard shows Remaining Balance = SAR 3,000.

3. **Given** a dashboard showing Remaining Balance = SAR 1,500, **When** the
   user deletes a confirmed expense of SAR 200, **Then** the dashboard shows
   Remaining Balance = SAR 1,700.

4. **Given** a draft AI extraction result exists (not yet confirmed), **When**
   the user adds a confirmed expense, **Then** the remaining balance reflects
   the confirmed expense but not the draft.

---

### User Story 3 - Category Spending Breakdown (Priority: P2)

A workspace member can see how their confirmed expenses are distributed
across categories for the current period, giving them insight into where
their money is going without navigating away from the main view.

**Why this priority**: The category breakdown is the primary way users
understand their spending behavior. It is visible on the dashboard and powers
future reports. Without it, the dashboard only shows totals with no context.

**Independent Test**: Can be tested by adding confirmed expenses assigned to
different categories, then viewing the dashboard and verifying that each
category total is correct and categories sum to the total confirmed expenses.

**Acceptance Scenarios**:

1. **Given** confirmed expenses of SAR 300 under "Groceries" and SAR 500
   under "Rent", **When** the user views the category breakdown, **Then** they
   see Groceries = SAR 300 and Rent = SAR 500, and these sum to the total
   confirmed expenses.

2. **Given** some expenses with no assigned category, **When** the user views
   the breakdown, **Then** uncategorised expenses are grouped separately and
   not excluded from the total.

3. **Given** a deleted expense previously assigned to "Fuel", **When** the
   user views the category breakdown, **Then** the deleted expense is not
   included in the "Fuel" total.

---

### User Story 4 - Recent Activity on Dashboard (Priority: P2)

A workspace member can view a short list of the most recent confirmed income
and expense records directly on the dashboard, so they can quickly review
their latest transactions without opening a separate history view.

**Why this priority**: The recent activity list is a fast-scan tool that
gives users confidence that their records are being captured correctly. It
complements the summary totals and makes the dashboard genuinely useful as
a landing screen.

**Independent Test**: Can be tested by adding several records and verifying
that the most recent confirmed records appear in the correct order on the
dashboard.

**Acceptance Scenarios**:

1. **Given** a workspace with 10 confirmed records, **When** the user views
   the dashboard, **Then** the most recent 5 records appear in reverse
   chronological order.

2. **Given** a mix of confirmed and draft AI extraction records, **When** the
   user views recent activity, **Then** only confirmed records appear.

3. **Given** a workspace with 0 records, **When** the user views recent
   activity, **Then** an empty state is shown without error.

4. **Given** confirmed records exist in both the current calendar month and
   a previous month, **When** the user views recent activity, **Then** only
   records from the current calendar month appear in the list; previous-month
   records are excluded regardless of how recent they are.

---

### User Story 5 - Current Period Defaults (Priority: P3)

All dashboard financial totals — income, expenses, remaining balance,
category breakdown, recent activity — are scoped to the current calendar
month by default, so users see their current-month financial position
immediately.

**Why this priority**: Period scoping gives context to the numbers. Without
it, totals accumulate across all time which quickly becomes meaningless as
a daily financial tool. However, the default period is a convention rather
than a core calculation — it sits lower in priority than correctness.

**Independent Test**: Can be tested by adding confirmed records from the
current month and previous months, then verifying that the dashboard totals
reflect only the current month by default.

**Acceptance Scenarios**:

1. **Given** income records in May and June, **When** the user views the
   dashboard in June, **Then** only June income appears in the total.

2. **Given** no records in the current month but records in a previous month,
   **When** the user views the dashboard, **Then** totals show SAR 0 for the
   current month and a clear indication of the current period.

---

### Edge Cases

- What happens when a workspace has zero income and several expenses? Remaining balance is returned as a plain signed integer in minor units (e.g., -50000 halalas for -SAR 500); the frontend derives any display distinction such as highlighting from the sign of the value. No separate boolean flag or supplementary field is included in the response.
- What happens when a record's amount is edited to a different value mid-period? All affected totals recalculate immediately on the next fetch.
- What happens when the user deletes the last income record? Total income drops to SAR 0 and remaining balance recalculates correctly.
- What happens when a pending AI extraction is confirmed? The newly confirmed expense is included in totals on the next data fetch.
- What happens if the workspace has thousands of records? Category breakdown and recent activity are aggregated or paginated; raw record lists are not returned unfiltered.
- What happens if a Viewer accesses dashboard data? Viewers may see dashboard totals but may not modify any record.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST calculate remaining balance as confirmed total income minus confirmed total expenses for the requested workspace and period.

- **FR-002**: The system MUST expose a single combined dashboard data endpoint that returns all of the following in one response: total confirmed income, total confirmed expenses, remaining balance, category breakdown, recent confirmed records, and pending AI extraction count — all for the authenticated user's requested workspace.

- **FR-003**: All financial totals MUST include only records in a confirmed state; draft, pending, failed, cancelled, or deleted records MUST be excluded.

- **FR-004**: The system MUST default the financial period to the current calendar month when no period is specified. Month boundaries MUST be calculated using UTC+3 (Saudi Arabia local time, fixed offset for MVP).

- **FR-005**: The system MUST calculate total confirmed income for a workspace within a given period.

- **FR-006**: The system MUST calculate total confirmed expenses for a workspace within a given period.

- **FR-007**: The system MUST calculate confirmed expense totals broken down by category for a workspace within a given period, including a grouping for uncategorised expenses.

- **FR-008**: The system MUST return the most recent confirmed income and expense records for a workspace, up to a limit supplied by the caller as a query parameter (default: 5 if the parameter is not supplied).

- **FR-009**: The system MUST return the count of pending AI extraction jobs awaiting user review for a workspace.

- **FR-010**: Money values MUST be stored and returned using integer minor units (halalas for SAR) or fixed-precision decimals; floating-point arithmetic MUST NOT be used.

- **FR-011**: The backend MUST validate that the requesting user is an authenticated member of the requested workspace before returning any financial data.

- **FR-012**: Role-based access MUST be enforced: Viewers may access dashboard data; all roles may read dashboard data; no role may bypass workspace membership checks.

- **FR-013**: Tenant isolation MUST be enforced: financial data from one workspace MUST NOT appear in dashboard results for another workspace.

- **FR-014**: Dashboard totals MUST recalculate automatically when income or expense records are created, edited, or deleted — no manual recalculation trigger is required.

- **FR-015**: The calculation logic used for dashboard data MUST be the same logic that will be used by reports in a later phase; there MUST be no divergence between dashboard totals and report totals for the same period and workspace.

- **FR-016**: The system MUST handle a workspace with no records gracefully, returning zero values without error.

### Key Entities

- **Financial Summary**: Represents the aggregated confirmed financial position for a workspace within a period. Key attributes: workspace identifier, period (start date, end date), total confirmed income, total confirmed expenses, remaining balance, currency.

- **Category Breakdown**: Represents confirmed expense totals grouped by category for a workspace within a period. Key attributes: category identifier, category name, confirmed expense total, currency.

- **Recent Records**: A short ordered list of the most recent confirmed income and expense records for quick dashboard display. Key attributes: record type (income/expense), amount, date, description, category (if expense).

- **Pending Review Count**: A count of AI extraction jobs in a pending or draft state that are awaiting user review in a workspace.

- **Dashboard Data**: A composite response combining Financial Summary, Category Breakdown, Recent Records, and Pending Review Count for a single workspace request.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dashboard data is available to authorized users within 2 seconds (p95, single-client) of a request for any workspace with up to 10,000 confirmed records. Formal load testing is out of scope for MVP; this criterion is validated by a single timed smoke test against a seeded local dataset.

- **SC-002**: Remaining balance shown on the dashboard always equals confirmed total income minus confirmed total expenses — zero tolerance for discrepancy on any tested dataset.

- **SC-003**: After a user creates, edits, or deletes a confirmed record, the next dashboard data fetch reflects the updated totals — no stale data is returned.

- **SC-004**: The sum of all category expense totals in the category breakdown equals the total confirmed expenses for the same period — no confirmed expense is ever double-counted or omitted from the breakdown.

- **SC-005**: No pending, draft, failed, cancelled, or deleted record ever appears in any financial total, category breakdown, or recent activity list.

- **SC-006**: A user who is a member of Workspace A cannot retrieve any financial data belonging to Workspace B through any dashboard request.

- **SC-007**: The backend rejects dashboard data requests from unauthenticated users and from users who are not members of the requested workspace, returning an appropriate error without leaking workspace information.

- **SC-008**: Dashboard data calculations for the same workspace and period return identical totals whether accessed through the dashboard endpoint or through a report endpoint built on the same calculation logic.

---

## Assumptions

- Phase 3 (income, expense, and category core) is complete and the system already stores confirmed income records, confirmed expense records, categories, and record statuses.
- SAR (Saudi Riyal) is the only currency handled in the MVP; multi-currency behavior is out of scope for this phase.
- The default period for dashboard data is the current calendar month, with month boundaries determined using UTC+3 (Saudi Arabia local time, fixed offset for MVP). Period filtering by custom date range is out of scope for this phase but the calculation logic must not prevent it being added later.
- Remaining balance may be negative if confirmed expenses exceed confirmed income; the system returns the raw signed value and the frontend applies any visual distinction.
- The recent activity list returns at most 5 records by default; the caller may override this via a query parameter. No workspace-level setting is required for MVP.
- Reports (Phase 9) will reuse the calculation layer built here; there will be no separate report calculation implementation.
- The pending AI extraction count is included in the dashboard response because Phase 8 (AI extraction) will depend on it; the count returns 0 if no AI extractions have been submitted.
- No caching layer is required for MVP; dashboard data is calculated fresh per request. If performance is a concern at scale, that is a post-MVP decision. SC-001's 2-second target is validated by a single timed smoke test against a seeded local dataset, not a load test.
- Workspace membership and role enforcement from Phase 2 are already in place; this phase consumes that foundation without redefining it.

---

## Clarifications

### Session 2026-06-26

- Q: What timezone determines the "current calendar month" boundary for period scoping? → A: UTC+3 fixed offset (Saudi Arabia local time), hardcoded for MVP.
- Q: Should the dashboard deliver all data in a single combined endpoint or separate endpoints per section? → A: Single combined endpoint returning all four sections in one response.
- Q: How is the recent activity record limit configured — query parameter, hardcoded, or workspace setting? → A: Query parameter with a default of 5 when the parameter is not supplied.
- Q: When remaining balance is negative, should the response include a separate flag or field, or return a plain signed number? → A: Plain signed integer in minor units; no separate flag or field.
