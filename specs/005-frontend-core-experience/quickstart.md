# Quickstart: Frontend Core Experience

Validation guide for Phase 5. Unlike Phases 2-4 (backend-only, validated via
`curl`), this phase is validated by driving the actual browser UI, since
that is the surface being built. Run these scenarios after implementation
to confirm the feature works end-to-end before marking tasks done.

## Prerequisites

- Phases 2-4 fully implemented and passing (auth/workspaces, income/
  expense/category core, dashboard endpoint).
- Local Supabase stack running:
  ```
  supabase start
  ```
- FastAPI backend running:
  ```
  cd apps/api
  uvicorn app.main:app --reload
  ```
- `apps/web/.env.local` has `NEXT_PUBLIC_API_URL` (already present) plus
  the two new values this phase adds — `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` — copied from `supabase status`.
- Frontend dev server running:
  ```
  cd apps/web
  npm run dev
  ```
- Two browser sessions (or one normal + one incognito window) for the
  multi-user scenarios, matching `002-auth-workspace-foundation/
  quickstart.md`'s Alice/Bob setup if reusing those accounts.

## Scenario 1: Sign up, sign in, see the dashboard (US1 / SC-001)

1. Open `http://localhost:3000` (root redirect → `/en/sign-up` since no
   session and no stored language preference yet).
2. Register with a new email and password.
3. **Expected**: redirected to `/en/w/{personalWorkspaceId}/dashboard`
   within 2 minutes of starting; dashboard shows total income `SAR 0.00`,
   total expenses `SAR 0.00`, remaining balance `SAR 0.00`, and the current
   month as the period — not a blank screen or spinner stuck loading
   (FR-010, FR-015).
4. Sign out. **Expected**: returned to `/en/sign-in`.
5. Sign back in. **Expected**: lands back on the same personal workspace's
   dashboard (FR-002, FR-009).
6. In a new private/incognito tab, open
   `http://localhost:3000/en/w/{personalWorkspaceId}/dashboard` directly
   without signing in. **Expected**: redirected to `/en/sign-in` (FR-005).

## Scenario 2: Add income and expense, totals update (US2 / SC-002, SC-003)

1. Signed in from Scenario 1, open the "Add income" quick action from the
   dashboard.
2. Submit amount `5000` SAR, today's date, description "Salary".
3. **Expected**: form closes/redirects, and within 5 seconds the dashboard
   (or a manual refresh of it) shows total income `SAR 5,000.00` and
   remaining balance `SAR 5,000.00` (SC-002).
4. Add an expense: amount `450.50` SAR, today's date, description "Lunch",
   category "Restaurants".
5. **Expected**: total expenses `SAR 450.50`, remaining balance
   `SAR 4,549.50`.
6. Try submitting the expense form again with the amount field empty.
   **Expected**: inline validation error, no request sent, no duplicate
   record created (FR-020).
7. Open the expense history screen (not the dashboard). **Expected**: the
   lunch expense appears in a full, browsable list — not only as one of the
   dashboard's "recent" items (FR-022, Clarification Session 2026-07-01).
8. From the history list, edit the lunch expense's amount to `500.00` and
   save. **Expected**: remaining balance updates to `SAR 4,500.00` (FR-018).
9. Delete the lunch expense from the history list, confirming the prompt.
   **Expected**: remaining balance returns to `SAR 5,000.00`; the record no
   longer appears in the history list or the dashboard's recent activity
   (FR-019).

## Scenario 3: Role-based visibility (US2 / SC-006)

Requires a second user added to a team workspace as Member (see
`002-auth-workspace-foundation/quickstart.md` step 4), and a third as
Viewer.

1. Sign in as the Member. Open the team workspace's expense form.
   **Expected**: the Member can create an expense (FR-017).
2. As the Member, open an expense created by the Owner in that workspace.
   **Expected**: no edit/delete controls are shown (permission matrix,
   `data-model.md` — Member may only edit/delete their own expenses).
3. Open an expense the Member created themselves. **Expected**: edit/delete
   controls are shown and work.
4. As the Member, open the income form. **Expected**: no way to create
   income is visible anywhere in the UI (Owner/Admin only).
5. Sign in as the Viewer. **Expected**: dashboard, history, categories, and
   reports are all viewable, but no create/edit/delete/archive control
   appears anywhere in the workspace (SC-006).

## Scenario 4: Categories (US3)

1. As Owner, open the categories screen. **Expected**: the 15 Saudi-first
   default categories are already listed, no setup step required (FR-022).
2. Create a custom category "Pets". **Expected**: appears in the list and
   is selectable on the expense form.
3. Archive "Pets". **Expected**: no longer offered on the expense form's
   category picker; an existing expense already tagged "Pets" (create one
   before archiving, if needed) still displays "Pets" as its category name
   (FR-025).

## Scenario 5: Multi-workspace isolation and switching (US4 / SC-007)

1. As Owner, use the workspace selector to create a new team workspace
   "Test Team".
2. **Expected**: appears in the selector, and switching into it shows an
   empty dashboard (`SAR 0.00` everywhere) — none of the personal
   workspace's records appear (FR-007, FR-008).
3. Add an expense inside "Test Team".
4. Switch back to the personal workspace via the selector.
5. **Expected**: the personal workspace's totals are unchanged by the
   "Test Team" expense — the two never mix (SC-007).
6. Switch into "Test Team" again (making it, not personal, the most
   recently viewed workspace), then sign out and back in. **Expected**:
   lands on "Test Team", not the personal workspace, since it was the
   last one viewed before sign-out (FR-009).

## Scenario 6: Reports match the dashboard (US5)

1. From Scenario 2's end state (or any workspace with confirmed records),
   open the reports screen.
2. **Expected**: total income, total expenses, and category breakdown
   exactly match what the dashboard screen shows for the same workspace
   and period (FR-026).
3. Switch to a workspace with no confirmed records this period.
   **Expected**: reports screen shows a clear empty state, not a blank
   screen or an error (FR-027).

## Scenario 7: Language switch and RTL (US6 / SC-005)

1. Open settings and switch the language to Arabic.
2. **Expected**: interface text switches to Arabic, `<html dir="rtl">` is
   set, and the layout mirrors (navigation, forms, dashboard cards) without
   a manual page reload leaving stale English text anywhere (FR-029).
3. Navigate to the dashboard, income form, and categories screen while in
   Arabic. **Expected**: all three render correctly RTL-mirrored with
   Arabic labels — not just the settings screen itself.
4. Switch back to English. **Expected**: `dir="ltr"` restored, all text
   back to English (FR-030).
5. Open the AI section of settings. **Expected**: a clear "AI is optional
   and not configured" notice, not a broken or partially-built settings
   panel (FR-034).

## Scenario 8: Negative balance and offline/error handling (Edge Cases)

1. In a workspace, add an expense larger than total income (e.g., income
   `SAR 100`, expense `SAR 500`).
2. **Expected**: dashboard and reports both show remaining balance as a
   clearly negative value, e.g. `-SAR 400.00` — not clamped to zero and not
   hidden (spec Edge Cases).
3. Stop the FastAPI backend (`Ctrl+C` on `uvicorn`), then refresh the
   dashboard.
4. **Expected**: a clear retry option is shown instead of a blank screen or
   an unhandled error (FR-036). Restart the backend and use the retry
   control; the dashboard loads normally again.

## Automated test coverage map

| Test file (indicative — see `tasks.md` for exact names) | Scenarios covered |
|---|---|
| `tests/e2e/auth.spec.ts` | 1 |
| `tests/e2e/income-expense-flow.spec.ts` | 2 |
| `tests/unit/permission-matrix.test.ts` + `tests/e2e/roles.spec.ts` | 3 |
| `tests/e2e/categories.spec.ts` | 4 |
| `tests/e2e/workspace-switch.spec.ts` | 5 |
| `tests/e2e/reports.spec.ts` | 6 |
| `tests/e2e/locale-rtl.spec.ts` | 7 |
| `tests/unit/money.test.ts` + `tests/e2e/error-states.spec.ts` | 8 |
