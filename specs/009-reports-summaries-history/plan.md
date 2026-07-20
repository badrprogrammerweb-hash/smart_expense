# Implementation Plan: Reports, Summaries, and History

**Branch**: `009-reports-summaries-history` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-reports-summaries-history/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Finalize the MVP reporting surface, add a lightweight workspace activity history,
and add an optional BYOK AI spending summary — all additive on top of Phases 3–8.

**Reports** extend the existing dashboard rather than reimplementing it. The
dashboard already computes period income, expenses, remaining balance, category
breakdown, recent records, and pending-AI count in `app/services/dashboard.py`
using confirmed-only filters. This phase adds a new `reports` router/service that
**reuses those exact functions verbatim** for the overlapping figures — so a report
and the dashboard cannot drift (FR-005, SC-001) by construction — and adds three
new confirmed-only aggregations: a spending trend, top merchants, and a team
activity summary. Reports accept a **selectable period** (current month, a prior
month, or a custom ≤366-day range) whereas the dashboard is current-month only; the
current-month preset is derived from the dashboard's own `get_current_period()`
(UTC+3) so the two agree at month boundaries.

**History** is the one net-new persisted surface: a single workspace-scoped,
append-only `public.activity_history` table populated by **AFTER-row database
triggers** on the seven event-source tables (incomes, expenses, categories, files,
workspace_memberships, ai_extractions, and the two settings tables). Triggers make
the event write synchronous and atomic with the mutation (FR-021), guarantee
exactly one entry per tracked action with no way to forget a call site (SC-004),
capture the actor from `auth.uid()` (verified to resolve on every write path —
every mutation to these tables goes through the RLS session or a SECURITY DEFINER
RPC invoked within it; the only service-role usage in the codebase is Supabase
Storage object bytes and a health check, neither of which writes these tables), and
are inherently **forward-only** — no pre-Phase-9 rows are backfilled (FR-022). The
history read endpoint is Owner/Admin-only, paginated newest-first (FR-024, FR-032).

**Optional AI summary** is on-demand only (FR-026a): an explicit Owner/Admin/Member
action calls a new backend endpoint that reuses the Phase 8 Vault-read RPC
(`get_workspace_ai_key_for_extraction`) to fetch the workspace key, sends the
already-computed **confirmed aggregates (not raw rows)** to the provider over the
existing `httpx` pattern, and returns plain-language text. With no key configured
the action is absent and every other report/summary still works (FR-026, manual-
first). No new backend or frontend dependency is introduced; trends render with
dependency-free CSS/SVG bars in the Phase 5 component style (no charting library).

## Technical Context

**Language/Version**: Python 3.12 for `apps/api` (extended this phase); SQL
(Postgres 15, Supabase-managed) for one new tracked migration under
`supabase/migrations/`; TypeScript 5.7 on Next.js 16.2.x (App Router) / React 18.3
for `apps/web` (extended this phase). This phase touches `apps/api`, `apps/web`,
and `supabase/`.

**Primary Dependencies**:
- Backend: FastAPI, SQLAlchemy async engine + `asyncpg`, `PyJWT[crypto]`, Pydantic
  v2, `httpx` — all already in `apps/api/requirements.txt`. The reports service
  **imports and reuses** `app/services/dashboard.py`'s `get_income_total`,
  `get_expense_total`, `get_category_breakdown`, `get_recent_records`,
  `get_pending_ai_count`, and `get_current_period` unchanged. The AI-summary
  provider call reuses the Phase 8 `httpx` direct-REST pattern (Gemini
  `generateContent` / OpenAI `chat/completions`) and the Phase 8 Vault-read RPC.
  **No new backend dependency.**
- Frontend: already-present `next`, `react`, `@supabase/supabase-js` +
  `@supabase/ssr`, `@tanstack/react-query`, `react-hook-form` + `zod`, `next-intl`,
  `shadcn/ui` + Tailwind, `lucide-react` (Phase 5 stack) — reused unchanged.
  Trend/top-merchant visuals are dependency-free CSS/SVG bars mirroring the existing
  `components/dashboard/CategoryBreakdown.tsx`. Period math uses native `Date`
  (no `date-fns`/`dayjs`). **No new frontend dependency.**

**Storage**:
- Supabase Postgres — **one new table** `public.activity_history` (workspace-scoped,
  RLS-enabled, append-only), plus trigger functions and AFTER-row triggers on
  `incomes`, `expenses`, `categories`, `files`, `workspace_memberships`,
  `ai_extractions`, `workspaces` (auto-delete setting column), and
  `workspace_ai_settings`. Reports themselves persist nothing (computed on demand;
  no snapshots — FR-034). No schema change to any existing financial table.
- Supabase Vault — **read only**, via the existing Phase 8
  `get_workspace_ai_key_for_extraction` RPC, for the optional AI summary. No new
  Vault surface.
- Supabase Storage — not touched this phase.

**Testing**: `pytest` + `pytest-asyncio` + `httpx` (ASGI transport) for route-level
backend tests, same pattern as Phases 2–8; integration tests sign in as real
local-Auth test users via the Supabase CLI stack to exercise RLS, the history
triggers, role gating, and tenant isolation directly. The AI-summary provider call
is intercepted with a stubbed `httpx` transport (as in Phase 8) so tests never make
live external calls. Frontend: Vitest + React Testing Library for
component/permission/empty-state tests and Playwright for the reports period-select
and history e2e flows (Phase 5 test stack, reused).

**Target Platform**: Local development via Supabase CLI (Docker stack); hosted
Supabase for staging/production; `apps/web` in the browser (desktop + mobile web).
Unchanged deployment posture (Bunny Magic Containers is Phase 10).

**Performance Goals**: No raw throughput/latency SLA. Report aggregations are
single-workspace, period-bounded SQL over indexed columns (`workspace_id`,
`occurred_on`, `status`). History reads are covered by an index on
`(workspace_id, created_at desc)` and paginated (page size 50). The AI-summary
provider call is bounded by the same `httpx` client timeout as Phase 8.

**Constraints**:
- **Reconciliation (SC-001, NON-NEGOTIABLE):** report income/expense/remaining
  totals MUST equal the dashboard's for the same workspace and equivalent period.
  Guaranteed by reusing the dashboard service functions verbatim and deriving the
  current-month preset from `get_current_period()` (UTC+3). "Remaining balance" in a
  report is defined identically to the dashboard's `remaining_balance_minor` =
  period confirmed income − period confirmed expenses (period-net, not
  cumulative-to-date). The "remaining-balance trend" plots the period-net remaining
  balance per sub-bucket (daily or monthly), and its buckets sum consistently with
  the single remaining-balance figure.
- **Confirmed-only + integer minor units (constitution X, XI):** every report and
  summary figure filters `status = 'confirmed'` and excludes deleted records and all
  draft/pending/processing/failed/cancelled AI-extraction rows (those never touch
  `expenses`); all money is `bigint` minor units, never floating point (FR-003,
  FR-004, FR-006).
- **Trend granularity (FR-009):** daily when the selected period spans ≤31 days,
  monthly when >31 days.
- **Period validation (FR-012):** reject end-before-start and any custom range
  >366 days.
- **Top merchants (FR-008):** aggregate only expenses with a non-null, non-empty
  `merchant_name`; expenses without one are excluded from merchant totals (but still
  counted in the expense total and the category breakdown's Uncategorized/known
  buckets).
- **History integrity (FR-019–FR-025):** exactly one entry per tracked mutation,
  written in the same transaction; forward-only (no backfill); actor = `auth.uid()`;
  every row carries `workspace_id`; append-only (no UPDATE/DELETE policy). Triggers
  fire only on real column changes (OLD/NEW comparison), never on a bare
  `updated_at` bump.
- **History visibility (FR-032):** read restricted to Owner/Admin at the RLS-policy
  level and re-checked in the backend; Member/Viewer denied.
- **AI summary (FR-026–FR-029, XIV):** BYOK-gated; on-demand only; Owner/Admin/
  Member may initiate (Viewer may not — it spends the owner's key, FR-031); only
  confirmed aggregates are sent to the provider; the decrypted key exists only in
  backend memory for the one call and is never logged/returned/persisted (reuses the
  Phase 8 secrecy guarantees); provider/key failure returns a safe non-technical
  error without breaking the page.
- **Tenant isolation (constitution VII):** all reports, summaries, and history are
  workspace-scoped; cross-workspace and unauthenticated access denied (FR-030,
  FR-033).
- **Viewer read-only (constitution VII):** no surface in this phase grants any
  write; the only Viewer restriction beyond that is history (Owner/Admin) and the
  AI-summary action (Owner/Admin/Member).

**Scale/Scope**: 1 new table + trigger function(s) + AFTER-row triggers on 8 tables
+ RLS/grants/indexes in 1 new migration; ~3 new backend endpoints (GET reports, GET
history, POST ai-summary) in new `reports`/`history` router+service modules that
reuse the dashboard service; one new provider function (`summarize_spending`) beside
the Phase 8 `extract_receipt`; new frontend period selector + trend/top-merchant/
team-activity/pending-review/plain-summary/optional-AI-summary components on the
existing reports page, a new Owner/Admin history route, api clients + hooks +
permission helper + en/ar strings. **No changes to any income/expense/category
financial write path** (history is captured by triggers, not by editing those
services).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Core Product Principle | PASS | Reports, summaries, and history are explicitly in the MVP surface; no accounting/banking/ledger behavior added. |
| II. Budgeting Philosophy | PASS | Reports reinforce the remaining-balance model (income − expenses); category breakdown explains spending without replacing the balance figure. |
| III. MVP Scope Discipline | PASS | Only the constitution-listed reports + lightweight history + optional AI summary. Export/PDF/CSV, scheduled/emailed reports, stored snapshots, audit-grade history, and multi-currency reporting are explicitly out of scope for Phase 9 (FR-034); Phase 12 (`specs/012-i18n-base-currency`) supersedes the SAR-only reporting limitation with workspace-currency-aware reporting while still excluding mixed-currency records and exchange-rate conversion. |
| IV. Saudi-First | PASS | Phase 9 reporting is SAR-only; plain-language summary and AI summary are AR+EN with RTL; trends/labels localized via next-intl. Phase 12 (`specs/012-i18n-base-currency`) later makes reports workspace-currency-aware. |
| V. Manual-First, AI-Optional | PASS | Every report and the plain-language/team/pending summaries work with no AI key; the AI summary is on-demand, BYOK-gated, and simply absent otherwise (FR-026, FR-026a). |
| VI. Privacy and Security | PASS | AI summary reuses the Phase 8 Vault-read secrecy guarantees (key only in memory, never logged/returned); only confirmed aggregates leave the system, not raw rows; all reads validated backend + RLS. |
| VII. Multi-Tenant Isolation | PASS | Reports/history/summary all `workspace_id`-scoped with RLS; history select restricted to Owner/Admin; AI-summary action to Owner/Admin/Member; Viewer strictly read-only; cross-workspace denied (FR-030–FR-033). |
| IX. Architecture Authority | PASS (justified DB logic) | FastAPI owns report aggregation and reuses the authoritative dashboard functions. History event-typing lives in Postgres triggers — deliberate DB-side business logic justified exactly as the project already justifies `confirm_ai_extraction`: atomicity with the mutation and guaranteed, un-forgettable coverage (SC-004). Frontend only displays; it computes no totals and authorizes nothing. |
| X. Financial Accuracy (NON-NEGOTIABLE) | PASS | All aggregations confirmed-only, integer minor units, no floating point; reports reconcile with the dashboard by reusing its functions (SC-001) — covered by a **dedicated** reconciliation test asserting report totals == dashboard totals across periods with deleted/draft/pending rows present. |
| XI. Reports Integrity | PASS | Reports based only on confirmed records; draft/pending AI never shown as final spending (they never reach `expenses`); the full constitution-listed report set is present. |
| XII. History Tracking | PASS | Lightweight forward-only event log, workspace-scoped, no immutability/diff/versioning/ledger semantics; retains all forward events, paginated view (FR-022–FR-024a). |
| XIII. Future Monetization Readiness | PASS | No billing/payment added; report/history schema is additive and does not preclude future plan limits. |
| XIV. Testing Requirements | PASS | Plan mandates the reconciliation test, confirmed-only exclusion tests, history exactly-one/forward-only/actor tests, Owner/Admin history-gating and AI-summary-role tests, tenant-isolation tests, AR/EN/RTL rendering tests, and AI-key-absent / provider-failure tests (SC-001–SC-009). |
| XV / XVI. Scope Control / Spec-Kit | PASS | Focused spec+plan for this feature only; out-of-scope enumerated (FR-034); sequenced after Phase 8, before Phase 10. |

No violations. Complexity Tracking table is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/009-reports-summaries-history/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── reports-api.md         # GET reports + POST ai-summary FastAPI contracts
│   ├── history-api.md         # GET history (Owner/Admin, paginated) FastAPI contract
│   └── history-schema.md      # activity_history table + trigger functions + triggers + RLS + grants + indexes
├── checklists/
│   └── requirements.md  # Spec quality checklist (/speckit-specify output)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── routes/
│   │   ├── reports.py               # NEW: GET /workspaces/{id}/reports?period=&start=&end= (all roles);
│   │   │                             #   POST /workspaces/{id}/reports/ai-summary (owner/admin/member, BYOK-gated)
│   │   └── history.py               # NEW: GET /workspaces/{id}/history?limit=&before= (owner/admin only, paginated)
│   ├── services/
│   │   ├── reports.py               # NEW: parse/validate period (presets + custom ≤366d, FR-012); REUSES
│   │   │                             #   dashboard.get_income_total/get_expense_total/get_category_breakdown/
│   │   │                             #   get_recent_records/get_pending_ai_count/get_current_period unchanged;
│   │   │                             #   adds get_spending_trend (daily≤31d else monthly), get_top_merchants,
│   │   │                             #   get_team_activity (per-member confirmed-record counts); assembles the
│   │   │                             #   structured plain-language summary inputs (totals/top category/trend dir)
│   │   ├── history.py               # NEW: list_history(workspace_id, limit, before, session) newest-first paginated
│   │   ├── ai_summary.py            # NEW: build confirmed aggregates -> fetch key via Phase 8 RPC ->
│   │   │                             #   ai_providers.summarize_spending -> plain-language text | safe failure
│   │   └── ai_providers.py          # EDIT: add summarize_spending(provider, api_key, aggregates, locale)
│   │                                 #   beside existing extract_receipt (same httpx direct-REST pattern)
│   └── schemas/
│       ├── reports.py               # NEW: ReportPeriod, TrendPoint, MerchantTotal, TeamActivityItem,
│       │                             #   SpendingSummary, ReportData response models
│       ├── history.py               # NEW: ActivityEventType enum, ActivityHistoryItem, HistoryPage
│       └── ai_summary.py            # NEW: AiSummaryRequest (period), AiSummaryResponse | AiSummaryFailure
│   └── main.py                      # EDIT: include_router(reports_router), include_router(history_router)
└── tests/
    ├── test_reports_reconciliation.py     # NEW (DEDICATED, constitution X): report totals == dashboard totals
    │                                        #   for equivalent periods, incl. deleted/draft/pending rows present (SC-001)
    ├── test_reports_confirmed_only.py      # NEW: deleted/draft/pending/failed/cancelled excluded from every
    │                                        #   report figure incl. trend/top-merchants/team-activity (SC-002, FR-003/004)
    ├── test_reports_period.py              # NEW: presets + custom range; daily-vs-monthly switch at 31 days;
    │                                        #   invalid range (end<start, >366d) rejected (FR-002/009/012, SC-003)
    ├── test_reports_top_merchants.py       # NEW: only expenses with merchant_name aggregated; blanks excluded (FR-008)
    ├── test_reports_empty_state.py         # NEW: empty period yields empty aggregations, not errors (SC-009)
    ├── test_history_triggers.py            # NEW (DEDICATED): each tracked mutation writes exactly one entry with
    │                                        #   correct event type + actor(auth.uid()) + entity ref + timestamp;
    │                                        #   no duplicates; updated_at-only change writes nothing (SC-004, FR-019/020/021)
    ├── test_history_forward_only.py        # NEW: pre-existing rows are NOT backfilled; only post-migration
    │                                        #   mutations appear (FR-022)
    ├── test_history_access.py              # NEW: Owner/Admin can read; Member/Viewer denied; newest-first pagination
    │                                        #   (FR-024/025/032)
    ├── test_reports_isolation.py           # NEW: cross-workspace reports access + unauthenticated denied (FR-030/033);
    │                                        #   history isolation is covered in test_history_access.py and AI-summary
    │                                        #   role/isolation in test_ai_summary.py
    ├── test_ai_summary.py                  # NEW: BYOK-absent -> action unavailable/safe empty; owner/admin/member only
    │                                        #   (viewer denied); confirmed aggregates only; AR/EN (FR-026/027/028/031)
    └── test_ai_summary_error_handling.py   # NEW: invalid key / provider failure -> safe error, page unaffected (FR-029, SC-008)

supabase/migrations/
└── 20260708000000_reports_history.sql   # NEW (tracked): activity_history table + append-only RLS (owner/admin select)
                                          #   + indexes + SECURITY DEFINER trigger function(s) mapping row deltas to
                                          #   event types + AFTER-row triggers on incomes, expenses, categories, files,
                                          #   workspace_memberships, ai_extractions, workspaces, workspace_ai_settings

apps/web/
├── app/[locale]/w/[workspaceId]/reports/
│   └── page.tsx                        # EDIT: pass period state into ReportSummary (was dashboard passthrough)
├── app/[locale]/w/[workspaceId]/history/
│   └── page.tsx                        # NEW: activity history (Owner/Admin only), paginated newest-first
├── components/reports/
│   ├── ReportSummary.tsx               # EDIT: consume the new reports endpoint; compose all report sections
│   ├── PeriodSelector.tsx              # NEW: current month / prior month / custom range; validates ≤366d, end≥start
│   ├── SpendingTrendChart.tsx          # NEW: dependency-free CSS/SVG bars (daily/monthly), CategoryBreakdown style
│   ├── TopMerchants.tsx                # NEW: top merchants list (SAR-formatted)
│   ├── TeamActivitySummary.tsx         # NEW: per-member confirmed-record counts for the period
│   ├── PendingReviewSummary.tsx        # NEW: count awaiting review (consistent with dashboard pending count)
│   ├── PlainLanguageSummary.tsx        # NEW: localized narrative from structured summary fields (no AI)
│   └── AiSpendingSummary.tsx           # NEW: on-demand button (owner/admin/member, only if BYOK) + safe error state
├── components/history/
│   ├── HistoryList.tsx                 # NEW: newest-first entries (what/who/when), i18n event labels
│   └── HistoryEmptyState.tsx           # NEW: neutral empty state (forward-only, no pre-phase events)
├── lib/api/
│   ├── reports.ts                      # NEW: getReport(workspaceId, period) / requestAiSummary(workspaceId, period)
│   └── history.ts                      # NEW: listHistory(workspaceId, {limit, before})
├── hooks/
│   ├── use-reports.ts                  # NEW: react-query hook for the reports endpoint + period state
│   └── use-history.ts                  # NEW: react-query (paginated) hook for history
├── lib/permissions.ts                  # EDIT: add canViewHistory(role) = owner/admin and
│                                        #   canRequestAiSummary(role) = owner/admin/member
└── messages/                           # EDIT: en + ar strings for reports/summary/history/AI-summary surfaces
```

**Structure Decision**: Web-application monolith, same layout as Phases 4–8.
Backend reporting follows the existing route→service→schema split, with the reports
service deliberately *importing* the Phase 4 dashboard service instead of
re-querying, so the reconciliation invariant (SC-001) holds by construction rather
than by parallel maintenance. History is captured entirely by database triggers in
one additive migration — chosen over scattering `record_activity()` calls across
eight Phase 3–8 services because triggers (a) run in the mutation's own transaction
(synchronous, FR-021), (b) cannot miss or double-count a call site (SC-004), (c)
read the actor from `auth.uid()`, verified available on every write path, and (d)
require **zero edits to the financial services we do not want to regress**. The read
paths (history, reports, AI summary) are new thin endpoints. Frontend adds a period
selector and the additional report sections on the existing reports page plus a new
Owner/Admin history route, reusing the Phase 4/5 component/permission/i18n patterns
with no new dependency.

## Complexity Tracking

> No constitution violations — this table is intentionally empty. The one
> deliberate piece of added complexity — putting history event-typing in Postgres
> triggers rather than application code — is justified in the Constitution Check
> (Principle IX) and research.md: it buys transactional atomicity, guaranteed
> coverage (SC-004), and zero regression risk to the Phase 3–8 financial write
> paths, mirroring the project's existing precedent of `confirm_ai_extraction`
> owning atomic multi-row business logic in the database.
