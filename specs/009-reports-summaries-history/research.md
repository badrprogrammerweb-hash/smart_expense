# Phase 0 Research: Reports, Summaries, and History

All open questions from the spec's clarifications were resolved during
`/speckit-clarify`; this document records the design decisions that shape the
Phase 1 artifacts, their rationale, and the alternatives rejected.

## Decision 1 — Reports reuse the dashboard service (do not reimplement)

**Decision**: The new `app/services/reports.py` imports and calls the existing
`app/services/dashboard.py` functions — `get_income_total`, `get_expense_total`,
`get_category_breakdown`, `get_recent_records`, `get_pending_ai_count`,
`get_current_period` — unchanged, for every figure they already produce. Reports
add only three new aggregations (spending trend, top merchants, team activity) and a
period parser.

**Rationale**: FR-005 / SC-001 require report totals to equal the dashboard's for the
same period. Reusing the identical query functions makes drift structurally
impossible — there is one confirmed-only filter (`status = 'confirmed'`, period on
`occurred_on`), not two that must be kept in sync. The dashboard functions already
accept arbitrary `period_start`/`period_end`, so they work directly for prior-month
and custom ranges.

**Alternatives rejected**: (a) A parallel set of report queries — rejected: it
reintroduces exactly the drift risk the reconciliation requirement exists to
prevent, and the current `ReportSummary.tsx` comment already notes this hazard.
(b) A single shared SQL view — rejected as heavier than needed; the Python functions
are already the shared source of truth.

## Decision 2 — Period model, presets, granularity, and validation

**Decision**: The reports endpoint accepts a period expressed as either a preset
(`current_month`, `previous_month`) or an explicit `start`/`end` custom range. The
`current_month` preset is derived from the dashboard's `get_current_period()` (UTC+3)
and `previous_month` from the month before it. Trend granularity is **daily when the
selected span ≤ 31 days, monthly when > 31 days** (FR-009). Validation rejects
`end < start` and any custom span **> 366 days** (FR-012).

**Rationale**: Deriving the current-month preset from the same UTC+3 helper the
dashboard uses guarantees the two agree at month boundaries (an SC-001 trap if the
report computed "this month" in a different timezone). The 31-day / 366-day thresholds
are the clarified MVP-safe values and keep trend charts readable and queries bounded.

**Alternatives rejected**: Free-form arbitrary granularity or auto-detected buckets —
rejected as unnecessary complexity for the MVP; a single threshold is testable and
predictable.

## Decision 3 — "Remaining balance" and the remaining-balance trend definition

**Decision**: A report's remaining balance is defined identically to the dashboard's
`remaining_balance_minor` = **period confirmed income − period confirmed expenses**
(period-net, not cumulative-since-inception). The **remaining-balance trend** plots
the period-net remaining balance per sub-bucket (daily or monthly), so the buckets
reconcile with the single period figure.

**Rationale**: The dashboard number is period-net; a cumulative-to-date report number
would silently disagree with it and fail SC-001. Stating the trend semantics
explicitly makes it testable and prevents a "running cumulative vs per-bucket net"
ambiguity in implementation.

**Alternatives rejected**: Cumulative lifetime balance — rejected: it neither matches
the dashboard nor fits the income-driven decreasing-balance model applied per period.

## Decision 4 — Confirmed-only + integer minor units on every new aggregation

**Decision**: The spending trend, top merchants, and team activity all filter
`status = 'confirmed'`, exclude soft-deleted rows, and never read
draft/pending/processing/failed/cancelled `ai_extractions` (those never reach
`expenses`). All money stays `bigint` minor units; no floating-point math anywhere.

**Rationale**: Constitution X/XI (NON-NEGOTIABLE). A silent omission here is exactly
what cross-artifact analysis is least likely to catch, so it is stated per-aggregation
and covered by a dedicated confirmed-only test.

## Decision 5 — Top merchants source and blank handling

**Decision**: Top merchants aggregate confirmed expenses grouped by
`expenses.merchant_name`, **excluding rows where `merchant_name` is null or blank**.
No new merchant catalog/entity is introduced. Present the top N (default 5).

**Rationale**: `merchant_name` already exists on every expense (manual and AI-derived),
so "top merchants when available" needs no schema change. Excluding blanks prevents a
misleading empty/"unknown" bucket from dominating the ranking (spec edge case).

## Decision 6 — Team activity summary = per-member confirmed-record counts

**Decision**: The team activity summary is per-member counts of confirmed income +
expense records **created within the selected period**, derived from confirmed
records (grouped by `created_by`), scoped to the workspace and period. It degrades
gracefully for single-member/personal workspaces.

**Rationale**: This is the clarified MVP-safe definition. Deriving it from confirmed
records (not from the history table) keeps it confirmed-only and independent of
history retention, and avoids coupling the report to the new history surface.

**Alternatives rejected**: Deriving team activity from `activity_history` — rejected:
history includes non-financial and unconfirmed-lifecycle events and is Owner/Admin-
gated, whereas the team activity summary is a confirmed-data report visible to all
roles; sourcing it from confirmed records keeps those concerns separate.

## Decision 7 — History via database triggers (the load-bearing choice)

**Decision**: A single append-only `public.activity_history` table is populated by
**AFTER-row triggers** on the eight event-source tables. A `SECURITY DEFINER` trigger
function maps the row delta to an event type and inserts one history row carrying
`workspace_id`, `event_type`, `actor_user_id = auth.uid()`, an entity reference, and
`created_at`. Triggers fire only on meaningful changes (OLD/NEW comparison), never on
a bare `updated_at` bump.

**Rationale**:
- **Synchronous & atomic (FR-021):** the insert runs inside the mutating transaction;
  if the mutation rolls back, so does its history entry.
- **Guaranteed coverage (SC-004):** there is no application call site to forget or
  double-invoke across the eight Phase 3–8 write paths; exactly one entry per tracked
  mutation.
- **Correct actor:** `auth.uid()` is available on every write path — verified: all
  mutations to these tables go through `open_rls_session` (which sets
  `request.jwt.claims` / `request.jwt.claim.sub`) or through SECURITY DEFINER RPCs
  invoked within that session (the JWT GUC survives the definer switch). The only
  service-role usage in the codebase is Supabase Storage object bytes
  (`services/storage.py`) and a health check — neither writes these tables.
- **Forward-only for free (FR-022):** triggers fire only on new mutations, so no
  pre-Phase-9 rows are backfilled.
- **Zero regression risk:** no edits to the financial services.

This mirrors the project's existing precedent (`confirm_ai_extraction` owns atomic
multi-row business logic in Postgres) and is justified against Principle IX in the
Constitution Check.

**Alternatives rejected**: (a) Application-level `record_activity()` calls in each
service — rejected: eight edit sites to correctness-critical financial code, easy to
miss an event or emit duplicates under partial failure, and harder to keep exactly-one
under retries. (b) Logical-decoding / CDC / async worker — rejected: not synchronous,
adds infrastructure the MVP forbids, and overkill for lightweight traceability.

**Codex risk to flag**: the trigger on `ai_extractions` assumes the committed status
vocabulary (`processing`/`ready_for_review`/`failed`/`confirmed`/`discarded`). Per the
project's known "stray DB state" note, the locally psql-applied `ai_extractions`
implementation may differ from the tracked migration; Codex must apply this migration
against the tracked schema and reconcile any local drift before relying on the status
map.

## Decision 8 — Event-type mapping

**Decision** (full map lives in data-model.md): INSERT → `*_created`; UPDATE where
`status` becomes `'deleted'` → `*_deleted`; UPDATE where `is_archived` becomes true
(categories) → `category_archived`; other meaningful UPDATE → `*_updated`;
`workspace_memberships` INSERT/DELETE → `member_added`/`member_removed`, UPDATE of
`role` → `role_changed`; `ai_extractions` status transitions →
`extraction_started`/`extraction_completed`/`extraction_failed`/`ai_draft_confirmed`;
settings-column changes on `workspaces`/`workspace_ai_settings` → `setting_changed`.

**Rationale**: Triggers must infer intent from deltas; specifying the map removes
guesswork for the implementer and makes each event independently testable.

## Decision 9 — History read: Owner/Admin only, paginated newest-first

**Decision**: `activity_history` RLS grants `select` only to Owner/Admin members of
the row's workspace; the backend re-checks the role. The list endpoint returns entries
newest-first with keyset pagination (default page size 50) and retains all forward
events with no purge (FR-024, FR-024a, FR-032).

**Rationale**: Matches the plan's Section 7 permission model (view history =
Owner/Admin) and the clarified retention/pagination decision. Keyset pagination on
`(created_at desc, id)` scales without offset drift as new events arrive.

## Decision 10 — Plain-language summary computed backend-side, localized frontend-side

**Decision**: The backend returns the summary as **structured fields** (period totals,
top category, and a trend-direction enum `up`/`down`/`flat` vs the previous comparable
period). The frontend renders these into Arabic/English narrative text via next-intl,
with SAR formatting and RTL.

**Rationale**: Keeps all money math and confirmed-only logic authoritative on the
backend while keeping natural-language/localization on the frontend where the existing
next-intl machinery lives — no server-side i18n, no floating point, no drift from the
report figures. Satisfies FR-013/FR-014/FR-015.

## Decision 11 — Optional AI summary: on-demand, aggregates-only, key reused

**Decision**: A `POST .../reports/ai-summary` endpoint, callable only by
Owner/Admin/Member and only when BYOK is configured, fetches the key via the Phase 8
`get_workspace_ai_key_for_extraction` RPC, sends the **already-computed confirmed
aggregates (not raw transaction rows)** plus the target locale to the provider via a
new `ai_providers.summarize_spending`, and returns plain-language text. Failures
return a safe non-technical error (FR-029). The action is on-demand only (FR-026a).

**Rationale**: Reusing the Phase 8 Vault-read RPC avoids opening a second decrypted-key
surface and inherits its secrecy guarantees and Owner/Admin/Member authorization.
Sending aggregates rather than rows is cheaper, avoids leaking per-transaction detail,
and satisfies the AI-safety "authorized data only / no sensitive data" rules. On-demand
generation prevents spending the owner's tokens on every page load.

**Alternatives rejected**: (a) Auto-generating on page load — rejected: spends BYOK
tokens without user intent. (b) Sending raw transactions — rejected: larger payload and
unnecessary data exposure. (c) A new dedicated Vault-read RPC — rejected: duplicates an
existing, already-audited secret path.

## Decision 12 — No new dependencies; dependency-free trend visuals

**Decision**: Trends and top-merchant bars render with CSS/SVG in the style of the
existing `components/dashboard/CategoryBreakdown.tsx`; period math uses native `Date`.
No charting or date library, and no backend dependency, is added.

**Rationale**: Matches the Phase 8 "no new dependency" ethos and keeps the bundle and
supply-chain surface small for an MVP whose charts are simple bars.
