# Phase 0 Research: Backend Financial Calculations and Dashboard Data

All Technical Context items in `plan.md` are resolved below. This phase
adds one read-only endpoint on top of the Phase 3 table foundation and
introduces no new database schema. Phases 1 and 2 research decisions that
remain unchanged (auth pattern, testing stack, Supabase CLI, integer
minor units) are inherited without re-evaluation.

## 1. UTC+3 period boundary calculation

**Decision**: The "current calendar month" is computed in Python using a
fixed UTC+3 offset: `tz_utc3 = timezone(timedelta(hours=3))`. The period
start is `datetime.now(tz_utc3).date().replace(day=1)`. The period end is
the last calendar day of that month, computed with
`calendar.monthrange(year, month)[1]`. Both values are passed as named
bind parameters (`period_start`, `period_end`) to every aggregation query
via `WHERE occurred_on BETWEEN :period_start AND :period_end`.

**Rationale**: `incomes.occurred_on` and `expenses.occurred_on` are both
stored as `date` (no time component) — the date the user says the
transaction occurred. There is no timezone conversion needed on the stored
value; the conversion is only needed to determine *which calendar month
the current moment belongs to* on the server. A fixed UTC+3 offset (not
a named timezone like `Asia/Riyadh`) is used because the spec's Clarification
1 specified "fixed offset for MVP," avoiding any DST or tz-database
dependency.

**Alternatives considered**: Using a named Postgres timezone (`AT TIME ZONE
'Asia/Riyadh'`) inside the SQL query — rejected because the `occurred_on`
column is `date`, not `timestamptz`, so no in-database conversion is needed
or meaningful. Computing the period in UTC and relying on "close enough" —
rejected; users near midnight at month-end (23:00–23:59 UTC = 02:00–02:59
UTC+3 the next day) would see the wrong month.

## 2. Aggregation query strategy

**Decision**: The dashboard service function runs four separate async
SQLAlchemy queries within a single FastAPI endpoint call:
1. Income total (`SUM(amount_minor)` over `incomes`).
2. Expense total (`SUM(amount_minor)` over `expenses`).
3. Category breakdown (`GROUP BY category_id` over `expenses`, LEFT JOIN
   `categories` for names).
4. Recent records (UNION ALL of `incomes` and `expenses`, ordered by
   `occurred_on DESC, created_at DESC`, LIMIT `:recent_limit`).

Remaining balance is computed in Python as `income_total - expense_total`;
it is never computed in SQL.

**Rationale**: Four lightweight aggregation queries over indexed, filtered
row sets are trivially fast at 10,000 records (well under 2 seconds each
on any Postgres instance). Separate queries are easier to read, test, and
extend independently than a single multi-CTE statement. Remaining balance
as Python arithmetic (not SQL) makes the calculation rule visible in the
service function, directly satisfying FR-015's "same logic reused by
reports" requirement — Phase 9 imports and calls the same service
functions without needing to parse a database object.

**Alternatives considered**: A single SQL statement with four CTEs — one
round trip, but harder to isolate in tests and opaquer about which
formula produces the balance. A Postgres view or materialized view — adds
a database object that must be migrated if the logic changes and makes
the FR-015 reuse path implicit rather than explicit in Python code.

## 3. Pending AI extraction count placeholder

**Decision**: `services/dashboard.py` exposes a function
`get_pending_ai_count(workspace_id)` that unconditionally returns `0` for
this phase. No query is executed. Phase 8 (AI Extraction) will replace
this function body with a real query against the `ai_extraction_jobs`
table when that table exists.

**Rationale**: FR-009 requires the count to be present in the response.
The spec Assumption 7 says "the count returns 0 if no AI extractions have
been submitted," and Phase 8 has not been built yet. Querying a
non-existent table would fail; returning a hardcoded 0 from a named
function keeps the interface contract visible and makes the Phase 8
replacement a single-function edit with no route or schema change.

**Alternatives considered**: Querying `ai_extraction_jobs` inside a
`try/except` and returning 0 on failure — fragile; errors that occur for
real reasons (permissions, network) would be silently swallowed. Not
including the field until Phase 8 — rejected; the response shape from
this phase must match what the frontend will eventually consume (FR-002
mandates the field in the combined response).

## 4. Recent-records limit parameter bounds

**Decision**: The `recent_limit` query parameter accepts integers in the
range `[1, 50]` inclusive. Values outside this range return `422
invalid_limit`. The default value when the parameter is omitted is `5`.

**Rationale**: Clarification 3 established the query-parameter mechanism
and default. A cap of 50 prevents a caller from requesting the entire
record history through the dashboard endpoint (the list endpoints in Phase
3 serve that use case). A minimum of 1 ensures the caller always gets at
least one record when they request data. These bounds require no spec
change — they are planning-time implementation details consistent with
FR-008's "up to a limit supplied by the caller."

**Alternatives considered**: No maximum cap — rejected because the
dashboard endpoint is not a pagination/list endpoint and returning
unlimited records through it contradicts the "short list" language in
the spec's User Story 4. A lower cap of 20 — 50 provides more headroom
for future frontend needs without meaningfully increasing query cost.

## 5. Calculation logic reuse for Phase 9 (FR-015)

**Decision**: All four aggregation functions (`get_income_total`,
`get_expense_total`, `get_category_breakdown`, `get_recent_records`) are
defined in `apps/api/app/services/dashboard.py`. The route handler in
`routes/dashboard.py` calls these functions and assembles the response.
Phase 9 report routes will import and call the same functions with their
own period parameters.

**Rationale**: FR-015 is explicit: "there MUST be no divergence between
dashboard totals and report totals for the same period and workspace."
Centralising the queries in one service module, rather than duplicating
them in each route, is the only approach that structurally guarantees this
— any change to calculation logic is made once, in one place, and
automatically applies to both dashboard and report responses.

**Alternatives considered**: Duplicating the SQL in both dashboard and
report routes — rejects FR-015 by design. A shared Postgres function (SQL
`FUNCTION`) — callable from Python but still a database object to migrate
and maintain; the Python service module is simpler and keeps the codebase's
source of truth in Python, consistent with Phases 2 and 3.

## 6. Uncategorised expense grouping

**Decision**: The category breakdown query uses `LEFT JOIN categories c ON
c.id = e.category_id` and selects `e.category_id` (nullable) alongside
`COALESCE(c.name, 'Uncategorized')` as the display name. Grouping is by
`e.category_id, c.name` (both NULL for uncategorised rows). The response
item for uncategorised expenses has `"category_id": null` and
`"category_name": "Uncategorized"`.

**Rationale**: FR-007 requires a grouping for uncategorised expenses (those
with `category_id IS NULL`). A single LEFT JOIN query handles both
categorised and uncategorised rows in one pass. Using `COALESCE` on the
name and returning `null` for the id makes the API response consistent and
unambiguous — the frontend knows to treat `category_id: null` as the
special "no category" group.

**Alternatives considered**: A UNION query (one leg for categorised rows,
one leg selecting `NULL, 'Uncategorized'` from uncategorised rows) —
produces the same result with more SQL; the LEFT JOIN with COALESCE is
more concise.

## 7. Non-member access error behaviour

**Decision**: Reuse the Phase 2/3 established pattern unchanged:
unauthenticated callers → `401`; callers authenticated but not a member
of the requested workspace → `404`. The `_workspace_role` dependency
raises `not_found()` for non-members to avoid leaking workspace existence.

**Rationale**: This is already the project's established, tested convention
(documented as a non-obvious decision in Phase 3). SC-007 requires
"returning an appropriate error without leaking workspace information";
`404` for non-members satisfies that constraint. No new behaviour is
introduced.

**Alternatives considered**: None — this was already decided and the
project has implemented it consistently across all Phase 2/3 endpoints.

## 8. Zero-workspace COALESCE behaviour

**Decision**: All SUM aggregations use `COALESCE(SUM(amount_minor), 0)`.
When a workspace has no confirmed records in the period, each total returns
`0` (not `NULL`). Remaining balance therefore returns `0 - 0 = 0`.

**Rationale**: FR-016 requires graceful handling of an empty workspace.
`SUM` over zero rows returns `NULL` in SQL; `COALESCE(..., 0)` converts
that to a usable integer. Returning `NULL` amounts to the frontend would
require every consumer to handle a `null` case where `0` is the correct
semantic value.

**Alternatives considered**: Returning `null` for totals when no records
exist — rejected; SC-002's "zero tolerance for discrepancy" test should
be verifiable even for empty workspaces, and `0 - 0 = 0` is the correct
remaining balance when no records exist.

## Outcome

All Technical Context fields in `plan.md` are resolved; no `NEEDS
CLARIFICATION` markers remain. Decisions 1–4 implement the four
`/speckit-clarify` clarifications. Decision 5 closes the FR-015 reuse
requirement at the architecture level. Decisions 6–8 resolve the three
non-obvious implementation choices that were not covered by clarification
questions.
