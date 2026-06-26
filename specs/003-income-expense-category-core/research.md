# Phase 0 Research: Income, Expense, and Category Core

All Technical Context items in `plan.md` are resolved below. This phase
reuses Phase 2's auth/RLS-connection architecture unchanged (research.md
Decisions 4–6 there) and adds the first business-data tables on top of it.

## 1. Money representation

**Decision**: Store every amount as `amount_minor bigint`, the integer
count of the currency's minor unit (halalas for SAR; 100 minor units per
SAR). `currency text not null default 'SAR' check (currency = 'SAR')` is
stored alongside it but constrained to the single allowed value this
phase.

**Rationale**: FR-023 forbids floating-point storage or calculation;
`bigint` minor units is the standard, exact representation. FR-024 fixes
SAR as the only currency this phase, and complex multi-currency support is
an explicit MVP exclusion (constitution Principle III) — storing the
column now with a single-value `CHECK` lets a future phase relax the
constraint with a small migration instead of an `ALTER TABLE ADD COLUMN`.

**Alternatives considered**: `numeric(12,2)` fixed-precision decimal —
also satisfies FR-023's "no floating point" requirement and was the
spec's other explicitly allowed option, but integer minor units avoid any
decimal-rounding ambiguity in arithmetic and comparisons done later in
Phase 4's aggregation queries, at no extra cost this phase.

## 2. Income creation permission

**Decision**: Only callers whose `workspace_role_for()` (Phase 2 helper
function) is `owner` or `admin` may insert a row into `incomes`. This is
enforced as the table's `INSERT` RLS policy, not an application-only
check.

**Rationale**: Directly implements FR-014 and this feature's first
clarification (income creation restricted to Owner/Admin; Members and
Viewers cannot create income records).

**Alternatives considered**: None — this was resolved during
`/speckit-clarify`, not a planning-time choice.

## 3. Category management permission scope

**Decision**: Creating, renaming, archiving, and reordering categories
(`INSERT`/`UPDATE` on `categories`) is Owner/Admin-only, the same
boundary as income. Members and Viewers have read-only access to
categories — a Member may still *select* an existing, non-archived
category when creating an expense (a plain foreign-key reference), but
cannot manage the category list itself.

**Rationale**: `spec.md`'s FR-017/019/020/022 say "authorized users"
without naming roles, so this is an interpretation, not a re-litigation
of a clarified requirement — the same situation Phase 2's research.md
Decision 7 resolved for role-assignment authority. The implementation
plan's Section 7 permission model lists "Manage categories" only under
Owner and Admin; Member's list is "Add income if allowed by workspace
policy; Add expenses; Upload receipts and invoices; View shared
dashboard; View reports; Edit own records where allowed" — categories
never appear there. Treating category management the same as income
management (an Owner/Admin-only verb, distinct from the broader "use"
permission everyone with access has) is the only reading consistent with
that allow-list.

**Alternatives considered**: Allowing Members to create/rename their own
custom categories — rejected because Section 7 never grants Members a
"manage categories" capability, and categories are shared, workspace-wide
display objects (one ordered list per workspace, not per-user), so a
Member-created category would still affect what every other member sees,
which is the kind of workspace-wide change Section 7 reserves for
Owner/Admin.

## 4. Confirmation/soft-delete status model

**Decision**: Both `incomes` and `expenses` get a `status text not null
default 'confirmed' check (status in ('confirmed', 'deleted'))` column,
plus a nullable `deleted_at timestamptz`. Deleting a record is an
`UPDATE` setting `status = 'deleted', deleted_at = now()` — never a SQL
`DELETE` — so the row and its history remain queryable. Confirmed totals,
wherever computed, filter on `status = 'confirmed'`.

**Rationale**: FR-004 requires every manual record to be confirmed
immediately (no manual draft state this phase); FR-007/FR-009 require
deleted records to be excluded from totals while remaining available for
traceability. A `status` enum (rather than a boolean `is_deleted` flag)
is deliberately chosen so a later AI-extraction phase can extend the
`CHECK` constraint to add `draft`/`pending` values without a column
rename or a second status column, matching the spec's Key Entity
description of "Record Confirmation State."

**Alternatives considered**: A boolean `is_deleted` flag — works for this
phase alone, but would force a second column (or an awkward boolean
reinterpretation) when Phase 8 needs `draft`/`pending` states; a single
extensible `status` column avoids that rework now.

## 5. Concurrency handling for simultaneous edits/deletes

**Decision**: No optimistic locking, version column, or conflict
detection. An `UPDATE` (edit or soft-delete) simply applies to whatever
the row's current state is; the most recently committed statement wins.

**Rationale**: Directly implements this feature's second clarification
(last-write-wins, no conflict error). Matches the implementation plan's
general preference for simple, reliable workflows over complex
coordination — nothing in the spec or constitution calls for rejecting
concurrent writes.

**Alternatives considered**: A `version`/`updated_at`-guarded
conditional `UPDATE` that returns `409` on a stale write — rejected by
the clarification answer.

## 6. Merchant name as a distinct field

**Decision**: `expenses.merchant_name text` is a separate nullable column
from `expenses.description text`.

**Rationale**: Directly implements this feature's first clarification.
The implementation plan's Section 8 ("Merchant totals where merchant data
exists") and Section 13 ("Top merchants when available") both require
merchant data to be groupable in Phase 4/9 — that only works reliably
against a structured column, not free text parsed out of `description`.

**Alternatives considered**: A single combined free-text field — rejected
by the clarification answer; would also block the merchant-grouping
queries Phase 4/9 are specified to need.

## 7. Default category seeding mechanism

**Decision**: A `SECURITY DEFINER` trigger function,
`seed_default_categories()`, fires `AFTER INSERT` on `workspaces` (for
every new row, personal or team) and inserts the constitution's 15-item
Saudi-first default category list (Restaurants, Groceries, Fuel,
Transportation, Rent, Utilities, Internet & Mobile, Health, Education,
Family, Shopping, Entertainment, Travel, Subscriptions, Other) with
`sort_order` 0–14 in that order, all `is_archived = false`.

**Rationale**: FR-016 requires every workspace to have the full default
set "at the time the workspace is created," with no extra setup call.
This mirrors the exact pattern Phase 2 used for Owner-membership bootstrap
(`assign_workspace_owner()`, research.md Decision 2b there) — a trigger
on the same `workspaces AFTER INSERT` event, run in the same transaction,
so a workspace is never observably created without its default
categories.

**Alternatives considered**: Seeding from FastAPI right after the
`POST /workspaces` insert — rejected because it would miss the personal
workspace's bootstrap path entirely (created by Phase 2's signup trigger,
not by any `apps/api` request handler) and would reintroduce the
"network failure between two steps" gap Phase 2 deliberately closed by
moving bootstrap into the database.

## 8. Category name uniqueness scope

**Decision**: `create unique index categories_unique_active_name on
categories (workspace_id, lower(name)) where not is_archived;` — a
partial unique index covering only active (non-archived) rows.

**Rationale**: FR-018 rejects a duplicate name only against "another
*active* category name already in the same workspace," and the Edge Cases
/ User Story 3 acceptance scenarios confirm an archived category's name
should not permanently block reuse. A partial index is the only
constraint shape that expresses "unique among active rows only" at the
database level, consistent with this project's pattern of enforcing
business rules as real constraints rather than only in FastAPI
(`workspaces_one_personal_per_creator` in Phase 2's migration is the same
partial-unique-index pattern).

**Alternatives considered**: A plain `unique (workspace_id, lower(name))`
covering all rows regardless of archive status — rejected because it
would permanently reserve a name once any category with that name was
ever created, contradicting FR-018 and the archived-category edge case.

## 9. Foreign-key delete behavior for `created_by`

**Decision**: `incomes.created_by` and `expenses.created_by` reference
`user_profiles(id)` with `ON DELETE RESTRICT`, not `ON DELETE CASCADE`.
This is a deliberate departure from Phase 2's `workspaces.created_by ...
on delete cascade` pattern.

**Rationale**: Constitution Principle X (Financial Accuracy,
NON-NEGOTIABLE) and FR-007 require deleted-record history to be
*preserved*, not destroyed as a side effect of an unrelated action. If a
user profile were ever deleted (no feature does this yet, but the
`auth.users ... on delete cascade` chain makes it physically possible),
`ON DELETE CASCADE` on a Member's `created_by` would silently erase every
income/expense row they ever created from a shared team workspace —
exactly the outcome Principle X and FR-007 exist to prevent. `RESTRICT`
makes that deletion fail loudly instead of silently destroying workspace
financial history; no current feature needs to delete a `user_profiles`
row, so this introduces no behavior change observable in this phase.

**Alternatives considered**: Copying Phase 2's `ON DELETE CASCADE`
verbatim for consistency — rejected because `workspaces.created_by`
cascading only deletes a workspace the same user owns (a contained blast
radius), whereas cascading on `incomes`/`expenses.created_by` would let
one team member's account deletion destroy *other* members' shared
financial records, which is a materially different and worse outcome.

## 10. No placeholder file-link column on `expenses`

**Decision**: This phase's `expenses` table has no `receipt_file_id` (or
similarly named) column. Phase 6 will add that column, with its `files`
table, in its own migration.

**Rationale**: `spec.md`'s Assumptions explicitly defer receipt/invoice
linkage to a later phase; adding an unused nullable FK column now with no
`files` table to point at would be speculative schema the constitution's
Scope Control principle (XV) and this project's simplicity guidance argue
against. Phase 6 can add one column with a normal migration when it
actually needs it.

**Alternatives considered**: Adding the column now as a forward-compat
placeholder — rejected as unnecessary now; it adds no testable behavior
this phase and the migration cost of adding it later is trivial.

## 11. No dashboard/totals aggregation endpoint this phase

**Decision**: No `/workspaces/{id}/totals` (or similar) endpoint is built.
FR-008/FR-009 (totals must be immediately and correctly recalculable from
confirmed records) are verified in this phase's tests by querying
`incomes`/`expenses` directly (e.g., `select coalesce(sum(amount_minor),
0) from expenses where workspace_id = :id and status = 'confirmed'`), not
through a new API surface.

**Rationale**: FR-028 explicitly excludes "dashboard or report
aggregation endpoints" this phase; that capability is Phase 4's. Testing
the underlying invariant (confirmed-only, immediately consistent) via
direct queries proves SC-002/SC-003 without building the endpoint Phase 4
owns, the same way Phase 2's tests asserted trigger behavior directly
against Postgres rather than through a dedicated endpoint.

**Alternatives considered**: Building a minimal internal totals endpoint
"just for tests" — rejected; it would be exactly the kind of endpoint
FR-028 rules out, and direct queries are sufficient for verification.

## 12. Category reorder endpoint design

**Decision**: A single `PUT /workspaces/{workspace_id}/categories/order`
endpoint accepts the workspace's complete ordered list of category IDs
and resequences `sort_order` to `0..n-1` in one transaction. It rejects
(`422`) if the submitted ID set doesn't exactly match the workspace's
current category IDs.

**Rationale**: FR-022 only requires that authorized users can reorder
categories; requiring the full current set avoids any ambiguity about
where a category not mentioned in a partial reorder request should land,
and resequencing in one statement avoids any intermediate state where two
categories briefly share a `sort_order`.

**Alternatives considered**: A per-category `PATCH` accepting a single
new `sort_order` value — simpler per call, but reordering N categories
would need N requests and well-defined tie-breaking if two requests
raced; the bulk endpoint is one round trip and one transaction.

## 13. Local development and testing approach

**Decision**: Reuse Phase 2's approach unchanged — Supabase CLI
(`supabase start`) for a local Postgres + Auth stack; `pytest` +
`pytest-asyncio` + `httpx` (ASGI transport) for route tests; integration
tests sign in as multiple real local-Auth users to exercise the RLS
policies and role boundaries this phase adds (Owner/Admin income and
category restrictions, Member-owns-it expense edit/delete boundary,
cross-workspace isolation).

**Rationale**: Constitution Principle XIV requires financial-accuracy and
permission behavior to be tested, not assumed; RLS policies can only be
meaningfully verified against a real Postgres instance evaluating them,
not a mock. No new tooling decision is needed — Phase 2's research.md
Decision 9 already settled this for the whole project.

**Alternatives considered**: None re-evaluated; carried over from Phase 2
research.md Decision 9.

## Outcome

All Technical Context fields in `plan.md` are resolved; no `NEEDS
CLARIFICATION` markers remain. Decisions 2, 5, and 6 directly implement
this feature's three clarifications. Decision 3 closes the one
permission ambiguity `/speckit-clarify` didn't surface (category
management scope), resolved the same way Phase 2 resolved its own
ambiguous role-permission wording (citing the implementation plan's
Section 7 allow-list rather than reopening `spec.md`).
