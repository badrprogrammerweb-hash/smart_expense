# Quickstart & Validation Guide: Design System and UI Refresh

A run/validation guide proving Phase 14 works end-to-end. Implementation detail
lives in `tasks.md`; component/token specifics live in `contracts/` and
`data-model.md`.

## Prerequisites

- Repo checked out on branch `014-design-system-ui-refresh`.
- Local stack per existing project docs: Supabase local stack running, `apps/api`
  reachable, `apps/web` env configured (same as Phases 12–13).
- Node/npm installed; `apps/web` dependencies installed (`npm install` in
  `apps/web`, which now includes the new dev dependency `@axe-core/playwright`).
- Playwright browsers installed (`npx playwright install`).

## Run the app

```bash
cd apps/web
npm run dev
# open http://localhost:3000/ar/...  (Arabic RTL, default)
# open http://localhost:3000/en/...  (English LTR)
```

## Manual validation scenarios

Each maps to spec user stories / success criteria.

1. **Consistent system across screens (US1, SC-001/002)**: Sign in, then visit
   dashboard, incomes, expenses, categories, files, extractions (queue +
   review), reports, history, settings, new-workspace. Every screen uses the
   refreshed shell, cards, tables/forms, and states; no screen shows legacy
   styling; every prior action is still reachable. On the dashboard, remaining
   balance is clearly the dominant figure.
2. **RTL/LTR both correct (US2, SC-003)**: Switch language from settings.
   Confirm sidebar is on the right in `ar` and left in `en`, forms/tables/
   dialogs/pagination mirror, labels are fully translated, technical values stay
   LTR-isolated, layout dimensions don't jump, long labels don't clip, and the
   workspace currency is unchanged by the language switch.
3. **F-001 dates (US3, SC-004)**: In `ar`, inspect dates in a record **table**,
   a **filter**, an add/edit **form**, and a **card** — all show `DD/MM/YYYY`,
   Western digits, correct order, no reversed separators. Repeat on a mobile
   viewport / mobile-RTL run.
4. **Responsive (US4, SC-005)**: At phone width, confirm record tables become
   cards, navigation becomes a direction-aware drawer, and each key task (view
   balance, add expense, add income when permitted, upload receipt, review
   extraction, switch workspace, filter records) is reachable without excessive
   scrolling; touch targets feel ≥44px.
5. **States (US5, SC-006)**: With an empty workspace, confirm guiding empty
   states (first expense/income/receipt/invite as permitted) — not a broken
   page. Trigger a load (skeleton/progress, not a bare spinner), an error
   (understandable, not color-only), and a Viewer/Member restricted action
   (permission-denied explains why).
6. **AI non-final (US6, SC-007)**: With AI configured, upload a receipt, start
   extraction, open review. Pending data is visually distinct from confirmed
   records and labelled as requiring review; the API key is masked; a failure
   state is safe and does not delete files or change totals; confirming still
   creates the expected expense.

### Full inventory sweep (2026-07-22)

The following visual/manual sweep was completed in both locale directions. The
workspace shell is counted as the sixteenth screen because it is the shared
navigation and header surface present throughout the authenticated product.

| Screen | English LTR | Arabic RTL |
|---|---:|---:|
| Locale landing | [x] | [x] |
| Sign in | [x] | [x] |
| Sign up | [x] | [x] |
| Reset password | [x] | [x] |
| Workspace shell | [x] | [x] |
| Dashboard | [x] | [x] |
| Incomes | [x] | [x] |
| Expenses | [x] | [x] |
| Categories | [x] | [x] |
| Files | [x] | [x] |
| AI review queue | [x] | [x] |
| AI extraction review | [x] | [x] |
| Reports | [x] | [x] |
| History | [x] | [x] |
| Settings | [x] | [x] |
| New workspace | [x] | [x] |

## Automated validation

```bash
cd apps/web

# Unit/component (Vitest + RTL): primitives + adopted feature components
npm run test:unit

# End-to-end, visual regression, accessibility (Playwright)
npm run test:e2e                      # all projects
npx playwright test --project=chromium         # desktop
npx playwright test --project=mobile-rtl       # mobile Arabic RTL (new)
npx playwright test e2e/visual-regression.spec.ts   # screenshot baselines
npx playwright test e2e/accessibility.spec.ts       # @axe-core WCAG AA

# First run establishes screenshot baselines:
npx playwright test e2e/visual-regression.spec.ts --update-snapshots
```

### Backend regression gate (frozen — run unmodified)

```bash
cd apps/api
pytest            # entire suite must pass as-is (SC-011 / contract G-2)
```

## Expected outcomes (Definition of Done for validation)

- All 16 screens render the refreshed system in both locales (US1; manual sweep
  checklist complete — contract G-8).
- Existing frontend/e2e suites are **behavior-green** (G-1); presentation-coupled
  assertions updated to new markup are not counted as regressions (G-3).
- Backend `pytest` passes **unmodified** (G-2 / SC-011).
- New visual-regression baselines and `@axe-core` WCAG AA checks pass on the
  representative screen set in both locales (G-4/G-5 / SC-008/SC-010).
- F-001 date checks pass on desktop and mobile-RTL (G-6 / SC-004).
- No out-of-scope feature introduced (G-12 / FR-028).
- No `apps/api` or `supabase/` source changed (frontend-only diff).

## Baseline Appendix

### Pre-refresh dashboard baseline (2026-07-22)

- Initial dashboard route: the pre-refresh layout resolves as the existing
  server-rendered workspace shell; no blocking client-side visual framework or
  web-font request is present.
- Interaction feel: existing summary-card and navigation interactions respond
  immediately after hydration during local review; no visible loading state is
  introduced by the baseline shell.
- Comparison criteria for T056: the refreshed dashboard must retain this
  immediate post-hydration interaction feel. Tajawal is loaded with
  `next/font`, the 400/500/700 subset, and `font-display: swap` so font loading
  cannot block first paint.

### Post-refresh comparison (2026-07-22)

- Dashboard load and shell interaction were reviewed in the visual-regression
  runs for both locales and both Playwright projects. The dashboard reached its
  settled state and the mobile navigation dialog opened without a material
  responsiveness regression from the T005 qualitative baseline.
- Tajawal remains self-hosted by `next/font` with only weights 400, 500, and
  700, and retains `font-display: swap`. This bounds the added font cost and
  keeps first paint unblocked while the font is available.
