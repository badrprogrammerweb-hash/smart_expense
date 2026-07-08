# Quickstart: Reports, Summaries, and History

A validation/run guide proving the feature works end-to-end. Implementation detail
lives in `tasks.md`, `data-model.md`, and `contracts/`; this file is how you *verify*
it. Assumes the Phase 1–8 local stack is running (Supabase CLI Docker stack, FastAPI
on `apps/api`, Next.js on `apps/web`).

## Prerequisites

- Supabase local stack up: `supabase start` (from repo root).
- Phase 9 migration applied against the **tracked** schema:
  `supabase migration up` (applies `20260708000000_reports_history.sql`).
  Reconcile any locally psql-applied `ai_extractions` drift first (see
  `contracts/history-schema.md` Codex note).
- Backend: `apps/api` running (`uvicorn app.main:app --reload`).
- Frontend: `apps/web` running (`npm run dev`).
- A test workspace with several **confirmed** incomes and expenses spanning at least
  two months, at least one **soft-deleted** record, at least one **draft/pending**
  `ai_extraction`, some expenses **with** and some **without** `merchant_name`, and
  (for the AI-summary path) a workspace with a valid BYOK key configured.

## 1. Reports reconcile with the dashboard (SC-001 — headline)

1. Open the dashboard for the workspace; note `total_income`, `total_expenses`,
   `remaining_balance` for the current month.
2. Open `GET /workspaces/{id}/reports` (default `current_month`) — or the reports page.
3. **Expected**: report `summary.*` equals the dashboard values exactly, with the
   deleted and draft/pending records present but excluded. Repeat for
   `period=previous_month` and a `custom` range.

Backend: `pytest apps/api/tests/test_reports_reconciliation.py` passes.

## 2. Confirmed-only across every aggregation (SC-002)

1. With deleted/draft/pending/failed/cancelled records present, inspect
   `spending_trend`, `top_merchants`, `team_activity`, `category_breakdown`.
2. **Expected**: none of those records contribute to any figure; all money is integer
   minor units.

Backend: `pytest apps/api/tests/test_reports_confirmed_only.py`.

## 3. Period selection, granularity, validation (SC-003, FR-009, FR-012)

1. Switch periods in the UI; confirm all sections recompute.
2. Custom range ≤ 31 days → `spending_trend[].granularity = 'day'`; a multi-month
   range → `'month'`.
3. Custom range with `end < start` → `422 invalid_period`; span `> 366 days` →
   `422 range_too_large`.

Backend: `pytest apps/api/tests/test_reports_period.py`.

## 4. Top merchants blank handling (FR-008)

1. **Expected**: only expenses with a non-blank `merchant_name` appear; blank-merchant
   expenses are excluded from merchant totals yet still counted in the expense total.

Backend: `pytest apps/api/tests/test_reports_top_merchants.py`.

## 5. Plain-language + team + pending summaries (US2, US4)

1. Confirm the plain-language summary states totals, top category, and trend direction
   vs the prior comparable period; toggle locale to Arabic → RTL + SAR formatting.
2. Confirm the team activity summary shows per-member confirmed-record counts for the
   period, and degrades gracefully on a personal workspace.
3. Confirm the pending review count matches the dashboard's.

Frontend: Vitest component tests + Playwright reports e2e (EN + AR).

## 6. History captured by triggers (SC-004, FR-019–FR-022)

1. As Owner, perform: add an expense, edit it, soft-delete it, upload a file, confirm
   an AI draft, change a member's role, toggle the auto-delete setting.
2. Open `GET /workspaces/{id}/history` (or the history page).
3. **Expected**: exactly one newest-first entry per action, each with the correct
   `event_type`, `actor_user_id` (you), `entity` reference, and timestamp. A no-op
   `updated_at`-only change creates **no** entry. A workspace with only pre-migration
   records returns an empty page (forward-only), not an error.

Backend: `pytest apps/api/tests/test_history_triggers.py`,
`test_history_forward_only.py`.

## 7. History access control (FR-032)

1. As a **Member** and as a **Viewer**, request `GET .../history`.
2. **Expected**: `403 not_authorized`. As a non-member: `404 not_found`. As
   Owner/Admin: `200` with newest-first, page size 50 keyset pagination.

Backend: `pytest apps/api/tests/test_history_access.py`.

## 8. Tenant isolation (FR-030, FR-033)

1. Attempt reports/history/ai-summary for a workspace you are not a member of, and
   unauthenticated.
2. **Expected**: denied (`404`/`401`).

Backend: `pytest apps/api/tests/test_reports_isolation.py`.

## 9. Optional AI summary (US5, FR-026–FR-031)

1. **No BYOK key**: reports page offers no AI-summary action; everything else works.
   `POST .../reports/ai-summary` → `409 ai_not_configured`.
2. **Valid key, as Owner/Admin/Member**: request a summary → `200` plain-language text
   in the current locale, derived only from confirmed aggregates, no financial advice.
3. **As Viewer**: the action is not offered; the endpoint returns `403`.
4. **Provider failure / invalid key**: `502 ai_provider_error` / `400 ai_key_invalid`
   with a safe message; the rest of the page keeps working. The decrypted key never
   appears in any response, log, or error.

Backend: `pytest apps/api/tests/test_ai_summary.py`,
`test_ai_summary_error_handling.py`.

## 10. Empty states (SC-009)

1. Select a period with no confirmed records.
2. **Expected**: every report/summary section shows a neutral empty state — no error,
   no misleading zero-as-data chart.

## Full suite

```
# Backend
cd apps/api && pytest tests/test_reports_*.py tests/test_history_*.py tests/test_ai_summary*.py

# Frontend
cd apps/web && npm run test && npm run test:e2e -- reports history
```

Green suite + steps 1–10 satisfied = SC-001 … SC-009 met.
