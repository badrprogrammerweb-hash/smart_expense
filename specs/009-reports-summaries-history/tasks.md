---

description: "Task list for Phase 9 — Reports, Summaries, and History"
---

# Tasks: Reports, Summaries, and History

**Input**: Design documents from `/specs/009-reports-summaries-history/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED — the constitution (Principle XIV) makes security and
financial-accuracy tests part of "done"; plan.md enumerates the required test files.

**Organization**: Tasks are grouped by user story (US1–US5) for independent
implementation and testing. Reports reuse the existing Phase 4 dashboard service; the
only new persisted schema is `activity_history` (US3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US5 (setup/foundational/polish carry no story label)
- All paths are repository-relative.

## Path Conventions

Monolith: backend `apps/api/`, frontend `apps/web/`, database `supabase/migrations/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schemas, permission helpers, and i18n scaffolding shared across stories.

- [ ] T001 [P] Add `canViewHistory(role)` (owner/admin) and `canRequestAiSummary(role)` (owner/admin/member) to `apps/web/lib/permissions.ts`
- [ ] T002 [P] Add en/ar i18n message scaffolding for the `reports`, `summary`, `history`, and `aiSummary` sections in `apps/web/messages/en.json` and `apps/web/messages/ar.json`
- [ ] T003 [P] Create backend report response schemas (`ReportPeriod`, `TrendPoint`, `MerchantTotal`, `TeamActivityItem`, `SpendingSummary`, `ReportData`) in `apps/api/app/schemas/reports.py`
- [ ] T004 [P] Create backend history schemas (`ActivityEventType` enum mirroring the data-model CHECK set, `ActivityHistoryItem`, `HistoryPage`) in `apps/api/app/schemas/history.py`
- [ ] T005 [P] Create backend AI-summary schemas (`AiSummaryRequest`, `AiSummaryResponse`, `AiSummaryFailure`) in `apps/api/app/schemas/ai_summary.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The period-scoped reports endpoint that reuses the dashboard service. Blocks US1, US2, US4, US5 (US3 history is independent of this backbone).

**⚠️ CRITICAL**: No report/summary story work can begin until this phase is complete.

- [ ] T006 Implement period parsing/validation in `apps/api/app/services/reports.py`: `current_month` from `dashboard.get_current_period()` (UTC+3), `previous_month` from the month before, and `custom` `start`/`end`; reject `end < start` and any span > 366 days (FR-002, FR-012)
- [ ] T007 Implement the reuse layer in `apps/api/app/services/reports.py`: import and call `dashboard.get_income_total`, `get_expense_total`, `get_category_breakdown`, `get_recent_records`, `get_pending_ai_count` for the resolved period and assemble the base `ReportData` (summary, category_breakdown, recent_records, pending_review_count) — do NOT re-query totals (SC-001) (depends on T003, T006)
- [ ] T008 Implement `GET /workspaces/{workspace_id}/reports` in `apps/api/app/routes/reports.py` with membership check (all roles), query params (`period`/`start`/`end`), and the standard error envelope; register `reports_router` in `apps/api/app/main.py` (depends on T007)
- [ ] T009 [P] Frontend reports API client `getReport(workspaceId, period)` in `apps/web/lib/api/reports.ts`
- [ ] T010 [P] Frontend `use-reports` hook with period state in `apps/web/hooks/use-reports.ts` (depends on T009)
- [ ] T011 [P] Frontend `PeriodSelector` component (current month / previous month / custom range; validates end ≥ start and span ≤ 366 days) in `apps/web/components/reports/PeriodSelector.tsx`

**Checkpoint**: The reports endpoint returns period-scoped, dashboard-reconciled base figures; the frontend can fetch and select periods.

---

## Phase 3: User Story 1 - Full spending report for a chosen period (Priority: P1) 🎯 MVP

**Goal**: A period-scoped report showing income vs expenses, remaining balance, category breakdown, spending trend, top merchants, and recent records — confirmed-only and reconciled with the dashboard.

**Independent Test**: Seed confirmed income/expenses across two months plus deleted and draft/pending AI rows; open reports, switch periods, and verify every figure reflects only confirmed records and equals the dashboard totals for the same period.

### Tests for User Story 1 ⚠️ (write first, ensure they FAIL)

- [ ] T012 [P] [US1] Reconciliation test — report `summary.*` equals dashboard totals for equivalent periods, with deleted/draft/pending rows present, in `apps/api/tests/test_reports_reconciliation.py` (SC-001)
- [ ] T013 [P] [US1] Confirmed-only test — deleted/draft/pending/failed/cancelled excluded from summary, category breakdown, trend, and top merchants, in `apps/api/tests/test_reports_confirmed_only.py` (SC-002)
- [ ] T014 [P] [US1] Period test — presets + custom range, daily-vs-monthly switch at 31 days, and rejection of `end < start` / span > 366 days, in `apps/api/tests/test_reports_period.py` (FR-009, FR-012, SC-003)
- [ ] T015 [P] [US1] Top-merchants test — only expenses with a non-blank `merchant_name` aggregated; blanks excluded from merchant totals but counted in expense total, in `apps/api/tests/test_reports_top_merchants.py` (FR-008)
- [ ] T016 [P] [US1] Empty-state test — a period with no confirmed records returns empty lists and zero totals with 200, not an error, in `apps/api/tests/test_reports_empty_state.py` (SC-009)
- [ ] T017 [P] [US1] Isolation test — cross-workspace and unauthenticated reports access denied, in `apps/api/tests/test_reports_isolation.py` (FR-030, FR-033)

### Implementation for User Story 1

- [ ] T018 [US1] Implement `get_spending_trend` (daily when span ≤ 31 days else monthly; per-bucket income/expense/period-net remaining) in `apps/api/app/services/reports.py` (Decision 3, FR-009)
- [ ] T019 [US1] Implement `get_top_merchants` (confirmed expenses grouped by non-blank `merchant_name`, top 5 by total) in `apps/api/app/services/reports.py` (FR-008)
- [ ] T020 [US1] Wire `spending_trend`, `top_merchants`, and `recent_records` into `ReportData` in `apps/api/app/services/reports.py` and the reports route (depends on T018, T019)
- [ ] T021 [P] [US1] Frontend `SpendingTrendChart` (dependency-free CSS/SVG bars, CategoryBreakdown style) in `apps/web/components/reports/SpendingTrendChart.tsx`
- [ ] T022 [P] [US1] Frontend `TopMerchants` component (SAR-formatted list) in `apps/web/components/reports/TopMerchants.tsx`
- [ ] T023 [US1] Rewire `apps/web/components/reports/ReportSummary.tsx` and `apps/web/app/[locale]/w/[workspaceId]/reports/page.tsx` to consume `use-reports`, mount `PeriodSelector`, and render SummaryCards, CategoryBreakdown, `SpendingTrendChart`, `TopMerchants`, and recent records for the selected period (depends on T010, T011, T021, T022)
- [ ] T024 [P] [US1] Frontend reports e2e — period select, confirmed-only figures, empty state — in `apps/web/tests/e2e/reports.spec.ts` (extend existing)

**Checkpoint**: US1 is a fully functional, independently testable MVP report.

---

## Phase 4: User Story 2 - Plain-language spending summary (Priority: P2)

**Goal**: A plain-language, localized (AR/EN) summary of the period: totals, top category, and trend direction vs the previous comparable period — no AI key required.

**Independent Test**: Seed known confirmed data for a period and its prior comparable period; verify the summary states correct totals, correct top category, and correct up/down/flat direction, in both EN (LTR) and AR (RTL).

### Tests for User Story 2 ⚠️

- [ ] T025 [P] [US2] Backend test for `spending_summary` — correct totals, top category, and `trend_direction` (up/down/flat), including the empty-period neutral case — in `apps/api/tests/test_reports_summary.py` (FR-013, FR-014)

### Implementation for User Story 2

- [ ] T026 [US2] Implement `spending_summary` computation (period totals, top category, `trend_direction` vs the previous comparable period) and include it in `ReportData` in `apps/api/app/services/reports.py` (FR-013, FR-014)
- [ ] T027 [P] [US2] Frontend `PlainLanguageSummary` component rendering the structured summary into localized narrative (EN/AR, RTL, SAR) in `apps/web/components/reports/PlainLanguageSummary.tsx`
- [ ] T028 [US2] Mount `PlainLanguageSummary` in `ReportSummary.tsx` and add the en/ar narrative strings in `apps/web/messages/*.json` (depends on T027)
- [ ] T029 [P] [US2] Frontend unit test for `PlainLanguageSummary` EN + AR rendering in `apps/web/tests/unit/plain-language-summary.test.tsx` (FR-015, SC-007)

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Workspace activity history (Priority: P2)

**Goal**: An Owner/Admin-only, newest-first, paginated activity log populated by database triggers; forward-only; Member/Viewer denied.

**Independent Test**: As Owner, perform tracked actions (add/edit/delete expense, upload file, confirm AI draft, change role, change setting) and verify exactly one correct entry each, newest-first; confirm a no-op `updated_at` change writes nothing and Member/Viewer are denied.

**Note**: Independent of the Phase 2 reports backbone.

### Tests for User Story 3 ⚠️

- [ ] T030 [P] [US3] Trigger test — each tracked mutation writes exactly one entry with correct `event_type`, `actor_user_id` (`auth.uid()`), entity reference, and timestamp; a no-op `updated_at`-only change writes nothing — in `apps/api/tests/test_history_triggers.py` (SC-004, FR-019/020/021)
- [ ] T031 [P] [US3] Forward-only test — pre-existing rows are not backfilled; only post-migration mutations appear — in `apps/api/tests/test_history_forward_only.py` (FR-022)
- [ ] T032 [P] [US3] Access + pagination + isolation test — Owner/Admin read newest-first keyset pages; Member/Viewer 403; non-member 404; cross-workspace denied — in `apps/api/tests/test_history_access.py` (FR-024/025/032, FR-030)

### Implementation for User Story 3

- [ ] T033 [US3] Create migration `supabase/migrations/20260708000000_reports_history.sql` with the `activity_history` table, the `(workspace_id, created_at desc, id desc)` index, and the `event_type` CHECK set (per contracts/history-schema.md)
- [ ] T034 [US3] Add the `public.record_activity()` SECURITY DEFINER trigger function with the event-type mapping and the "meaningful change only" (OLD/NEW compare, ignore bare `updated_at`) logic to the migration (data-model mapping table)
- [ ] T035 [US3] Add AFTER INSERT/UPDATE/DELETE row triggers on `incomes`, `expenses`, `categories`, `files`, `ai_extractions`, `workspace_memberships`, `workspaces` (auto_delete column only), and `workspace_ai_settings` to the migration (depends on T034)
- [ ] T036 [US3] Add RLS (Owner/Admin `select` via `workspace_role_for`) and grants (no insert/update/delete to `authenticated`; select only) to the migration (depends on T033)
- [ ] T037 [US3] Implement `list_history(workspace_id, limit, before, session)` (newest-first keyset, page size ≤ 50) in `apps/api/app/services/history.py`
- [ ] T038 [US3] Implement `GET /workspaces/{workspace_id}/history` in `apps/api/app/routes/history.py` (Owner/Admin only → 403 Member/Viewer, 404 non-member, keyset pagination) and register `history_router` in `apps/api/app/main.py` (depends on T004, T037)
- [ ] T039 [P] [US3] Frontend history API client `listHistory(workspaceId, {limit, before})` in `apps/web/lib/api/history.ts`
- [ ] T040 [P] [US3] Frontend `use-history` paginated hook in `apps/web/hooks/use-history.ts` (depends on T039)
- [ ] T041 [P] [US3] Frontend `HistoryList` and `HistoryEmptyState` components (i18n event labels; what/who/when) in `apps/web/components/history/`
- [ ] T042 [US3] Frontend history route page gated by `canViewHistory` in `apps/web/app/[locale]/w/[workspaceId]/history/page.tsx` (depends on T040, T041)
- [ ] T043 [P] [US3] Frontend history e2e — Owner sees events newest-first; Viewer denied — in `apps/web/tests/e2e/history.spec.ts`

**Checkpoint**: History works independently and is Owner/Admin-gated.

---

## Phase 6: User Story 4 - Team activity & pending review summaries (Priority: P3)

**Goal**: A per-member confirmed-record activity summary for the period and a pending invoice review count consistent with the dashboard.

**Independent Test**: Seed multiple members' confirmed records in a period and some pending AI extractions; verify the team summary reflects per-member contributions for the period and the pending count matches the dashboard.

### Tests for User Story 4 ⚠️

- [ ] T044 [P] [US4] Backend test — `team_activity` per-member counts for the period (graceful single-member case) and `pending_review_count` equals `dashboard.get_pending_ai_count` — in `apps/api/tests/test_reports_team_activity.py` (FR-016, FR-017, FR-018)

### Implementation for User Story 4

- [ ] T045 [US4] Implement `get_team_activity` (per-member confirmed income+expense counts created within the period, grouped by `created_by`, graceful for single-member) and include it in `ReportData` in `apps/api/app/services/reports.py` (FR-016, FR-018)
- [ ] T046 [P] [US4] Frontend `TeamActivitySummary` component in `apps/web/components/reports/TeamActivitySummary.tsx`
- [ ] T047 [P] [US4] Frontend `PendingReviewSummary` component (reads `pending_review_count`) in `apps/web/components/reports/PendingReviewSummary.tsx`
- [ ] T048 [US4] Mount `TeamActivitySummary` and `PendingReviewSummary` in `ReportSummary.tsx` and add en/ar strings (depends on T046, T047)

**Checkpoint**: US1–US4 all work independently.

---

## Phase 7: User Story 5 - Optional AI spending summary (Priority: P3)

**Goal**: An on-demand, BYOK-gated, Owner/Admin/Member-only AI spending summary derived from confirmed aggregates; absent (and page fully functional) with no key; safe error on failure.

**Independent Test**: With no key, confirm the action is absent and the page works; with a valid key, request a summary and confirm plain-language text from confirmed aggregates; as Viewer confirm it is not offered; simulate provider failure and confirm a safe error with the page unaffected.

### Tests for User Story 5 ⚠️

- [ ] T049 [P] [US5] Backend test — BYOK absent → `409 ai_not_configured`; Owner/Admin/Member allowed, Viewer → 403; only confirmed aggregates sent; EN/AR — in `apps/api/tests/test_ai_summary.py` (FR-026/027/028/031)
- [ ] T050 [P] [US5] Backend test — invalid key / provider failure → safe non-technical error, page unaffected, decrypted key never in any response/log — in `apps/api/tests/test_ai_summary_error_handling.py` (FR-029, SC-008)

### Implementation for User Story 5

- [ ] T051 [US5] Add `summarize_spending(provider, api_key, aggregates, locale)` (httpx direct-REST to Gemini/OpenAI, structured result or safe failure) to `apps/api/app/services/ai_providers.py` beside `extract_receipt`
- [ ] T052 [US5] Implement the AI-summary service in `apps/api/app/services/ai_summary.py`: build confirmed aggregates via the reports service, fetch the key via the Phase 8 `get_workspace_ai_key_for_extraction` RPC, call `summarize_spending`, and map failures — send aggregates only, never raw rows (depends on T051)
- [ ] T053 [US5] Implement `POST /workspaces/{workspace_id}/reports/ai-summary` in `apps/api/app/routes/reports.py` (Owner/Admin/Member only → 403 Viewer, 409 `ai_not_configured`, 502/400 safe errors) (depends on T005, T052)
- [ ] T054 [P] [US5] Frontend reports API client `requestAiSummary(workspaceId, period, locale)` in `apps/web/lib/api/reports.ts` (extend)
- [ ] T055 [P] [US5] Frontend `AiSpendingSummary` component — on-demand button gated by `canRequestAiSummary` and BYOK presence (via `use-ai-settings`), safe error state, hidden for Viewer — in `apps/web/components/reports/AiSpendingSummary.tsx`
- [ ] T056 [US5] Mount `AiSpendingSummary` in `ReportSummary.tsx` (only when BYOK configured) and add en/ar strings (depends on T055)
- [ ] T057 [P] [US5] Frontend unit test for `AiSpendingSummary` — no key → absent; Viewer → absent; error state — in `apps/web/tests/unit/ai-spending-summary.test.tsx`

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T058 [P] Run the `specs/009-reports-summaries-history/quickstart.md` validation end-to-end (steps 1–10)
- [ ] T059 [P] Verify AR/RTL layout and SAR formatting across all new report/history/AI-summary components
- [ ] T060 [P] Update `docs/` (API overview + financial calculation rules) to note reports reconcile with the dashboard and history is forward-only/Owner-Admin-only
- [ ] T061 Confirm no new dependency was added (`apps/api/requirements.txt`, `apps/web/package.json` unchanged from before Phase 9)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; blocks US1, US2, US4, US5.
- **US1 (Phase 3)**: depends on Foundational. MVP.
- **US2 (Phase 4)**: depends on Foundational (extends `ReportData` + `ReportSummary`).
- **US3 (Phase 5)**: depends only on Setup (T004) — the history surface is independent of the reports backbone and can proceed in parallel with US1/US2/US4/US5.
- **US4 (Phase 6)**: depends on Foundational.
- **US5 (Phase 7)**: depends on Foundational (reuses reports aggregates) and Setup (T005).
- **Polish (Phase 8)**: after all targeted stories complete.

### User Story Dependencies

- US1, US2, US4, US5 share the reports endpoint/service and the `ReportSummary` page. They are independently *testable* (each has its own backend figure + tests) but touch `services/reports.py` and `ReportSummary.tsx` in sequence — coordinate those two files to avoid edit conflicts (serialize T020/T023, T026/T028, T045/T048, T053/T056 on those shared files).
- US3 is fully independent (separate migration, service, route, page, tests).

### Within Each User Story

- Tests are written first and must fail before implementation.
- Backend service before route; route before frontend consumption; components before page mount.

### Parallel Opportunities

- All Setup tasks (T001–T005) run in parallel.
- Foundational T009/T010/T011 (frontend client/hook/selector) run in parallel with T006–T008 (backend), converging at T023.
- **US3 can run entirely in parallel with the report stories** (different files) once Setup is done.
- All `[P]` test tasks within a story run in parallel.
- Within US1: T021 and T022 (two components) in parallel; T018 and T019 (two service functions, same file) are NOT parallel.

---

## Parallel Example: User Story 1

```bash
# Tests first (all parallel):
Task: "Reconciliation test in apps/api/tests/test_reports_reconciliation.py"
Task: "Confirmed-only test in apps/api/tests/test_reports_confirmed_only.py"
Task: "Period test in apps/api/tests/test_reports_period.py"
Task: "Top-merchants test in apps/api/tests/test_reports_top_merchants.py"
Task: "Empty-state test in apps/api/tests/test_reports_empty_state.py"
Task: "Isolation test in apps/api/tests/test_reports_isolation.py"

# Then the two frontend components in parallel:
Task: "SpendingTrendChart in apps/web/components/reports/SpendingTrendChart.tsx"
Task: "TopMerchants in apps/web/components/reports/TopMerchants.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. **STOP and VALIDATE**: reports reconcile with the dashboard across periods (SC-001), confirmed-only holds, empty states work.
3. Deploy/demo — a full period report is the MVP.

### Incremental Delivery

Foundational → US1 (MVP) → US2 → US3 (parallelizable) → US4 → US5. Each story adds value without breaking earlier ones.

### Parallel Team Strategy

After Setup + Foundational: one developer takes the report stories (US1→US2→US4→US5, serialized on `services/reports.py` + `ReportSummary.tsx`); a second developer takes US3 (history) end-to-end in parallel.

---

## Notes

- `[P]` = different files, no dependency on incomplete tasks.
- Reports reuse the Phase 4 dashboard service verbatim — never re-query totals (SC-001).
- History is captured by DB triggers only; no application-level `record_activity()` call sites and no edits to the Phase 3–8 financial services.
- All money is integer minor units; confirmed-only on every figure.
- The AI-summary decrypted key must never be logged, returned, or persisted (reuse Phase 8 guarantees).
- Apply the migration against the tracked schema and reconcile any local `ai_extractions` psql drift first (research Decision 7).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
