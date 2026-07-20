# Quickstart: Internationalization and Workspace Currency

A validation/run guide proving the feature works end-to-end. Implementation
detail lives in `tasks.md`, `data-model.md`, and `contracts/`; this file is
how you *verify* it. Assumes the Phase 1–11 local stack is running (Supabase
CLI Docker stack, FastAPI on `apps/api`, Next.js on `apps/web`).

## Prerequisites

- Supabase local stack up: `supabase start` (from repo root).
- This phase's migration applied against the tracked schema:
  `supabase migration up` (applies
  `20260720000000_i18n_locale_workspace_currency.sql`).
- Backend: `apps/api` running (`uvicorn app.main:app --reload`).
- Frontend: `apps/web` running (`npm run dev`).
- Two test workspaces: one brand-new with zero records, one with existing
  confirmed income/expense records from before this phase (to verify
  non-regression on the default-SAR path).

## 1. Language preference follows the user across sessions (US1, FR-001–FR-005)

1. Sign in as a test user; set language to Arabic via Settings.
2. **Expected**: interface switches to Arabic/RTL immediately; `GET /me`
   returns `"locale": "ar"`.
3. Sign out; clear all cookies (or use a fresh browser profile); sign back in.
4. **Expected**: interface opens in Arabic without re-selecting it (no
   `NEXT_LOCALE` cookie was needed — the stored preference drove the initial
   redirect).
5. Switch to English; repeat steps 3–4 with English as the expected result.
6. As a user who has never chosen a language, confirm the app still opens
   with the existing default-locale behavior, unchanged.

Backend: `pytest apps/api/tests/test_users_locale.py`.
Frontend: Playwright `apps/web/e2e/locale-preference-persistence.spec.ts`.

## 2. Workspace Owner sets base currency (US2, FR-006–FR-011)

1. As Owner, open Settings for the brand-new (zero-record) workspace; change
   currency from `SAR` to `USD`.
2. **Expected**: `200`, workspace now reads `currency: "USD"` everywhere.
3. Add an income and an expense.
4. **Expected**: both are created with `currency: "USD"`; dashboard/records
   show USD formatting.
5. Attempt to change the currency again.
6. **Expected**: `409 currency_locked`.
7. As an Admin/Member/Viewer on the same workspace, attempt to change
   currency.
8. **Expected**: `403 forbidden`.
9. Open the pre-existing workspace (with pre-phase records).
10. **Expected**: reads `currency: "SAR"` with no migration step taken, and
    every existing record/report is unchanged (non-regression).

Backend: `pytest apps/api/tests/test_workspace_currency.py`.

## 3. Currency- and locale-aware formatting everywhere (US3, FR-012–FR-015)

1. In the `USD` workspace, view: dashboard, income/expense list, a report, the
   AI extraction review screen, and history — in both English and Arabic.
2. **Expected**: every money value shows `$` (USD, 2 decimals) formatting,
   correctly positioned per locale; numbers and dates follow the active
   locale's conventions; layout is LTR in English and RTL in Arabic.
3. Repeat with a workspace configured to `KWD` (3 decimal digits) or `BHD`/
   `OMR` and confirm amounts show 3 fractional digits, not 2 — this is the
   regression case for the old hard-coded `SAR_FRACTION_DIGITS = 2`.
4. In the unchanged `SAR` workspace, confirm formatting is pixel-for-pixel the
   same as before this phase (non-regression, SC-004 baseline case).

Frontend: `apps/web/tests/unit/money-formatting.test.ts`,
`apps/web/e2e/workspace-currency-formatting.spec.ts`.

## 4. Existing AR/EN/RTL regression suite still passes (US4, FR-019)

1. Re-run the existing localization/RTL suites:
   `apps/web/tests/unit/localization-rtl.test.tsx`,
   `apps/web/tests/e2e/locale-rtl.spec.ts`,
   `apps/web/e2e/acc-localization-rtl.spec.ts`.
2. Re-walk the manual checklist at
   `specs/010-testing-security-deployment/manual-ar-en-rtl-checklist.md`
   against a non-SAR workspace.
3. **Expected**: all pass, with amounts shown in the workspace's configured
   currency instead of always SAR.

## 5. Financial accuracy unaffected by currency choice (FR-018, constitution X)

1. In the `USD` workspace, exercise the existing financial-accuracy edge
   states (zero income, zero expenses, negative remaining balance, edited
   record, deleted record, pending AI draft, failed AI extraction, viewer
   restriction).
2. **Expected**: every existing accuracy assertion holds identically to the
   SAR case — only the currency label/formatting differs, never the integer
   minor-unit math.

Backend: re-run `apps/api/tests/test_reports_reconciliation.py` and the Phase
10 financial-accuracy suite against a non-SAR workspace fixture.

## Full suite

```
# Backend
cd apps/api && pytest tests/test_users_locale.py tests/test_workspace_currency.py

# Frontend
cd apps/web && npm run test && npm run test:e2e -- locale currency
```

Green suite + steps 1–5 satisfied = SC-001 … SC-006 met.
