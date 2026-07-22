# Contract: Testing & Regression Gates

**Type**: Process/verification contract for Phase 14. Encodes FR-029, FR-030,
and SC-010/SC-011/SC-012.

## Behavior-green definition (the real gate)

- **G-1**: **Must not regress** — all behavioral, user-flow, financial-accuracy,
  role-permission, and RTL/LTR **direction** assertions in existing frontend
  and e2e specs continue to pass.
- **G-2**: **Frozen** — the entire backend `pytest` suite is re-run
  **unmodified** and passes as-is (verifies no API/financial/permission change,
  SC-011).
- **G-3**: **Expected churn (not a regression)** — presentation-coupled
  assertions (DOM selectors, class names, screenshot baselines) MAY be updated
  to match refreshed markup.

## New coverage this phase

- **G-4 Visual regression**: Playwright `toHaveScreenshot` baselines for a
  **representative set** of key screens/states in **both locales** — at minimum:
  dashboard, one record list (table + mobile-card), one add/edit form, a dialog,
  reports, and the empty/error/permission states. Committed baselines; diffs
  reviewed.
- **G-5 Accessibility (WCAG AA)**: `@axe-core/playwright` on the same
  representative screens — body-text contrast ≥ 4.5:1, roles/labels, visible
  focus, accessible dialogs, no serious/critical violations.
- **G-6 F-001**: date checks per `date-format-f001.md` on desktop **and** the
  mobile-RTL project.
- **G-7 Responsive**: key tasks (view balance, add expense, add income when
  permitted, upload receipt, review extraction, switch workspace, filter
  records) pass at mobile, tablet, and desktop widths in both locales; tables
  become cards on mobile; touch targets ≥ 44×44px.
- **G-8 Manual sweep**: a documented checklist covers the **full** screen
  inventory (all 16 screens × both locales) for adoption completeness, since
  automation targets a representative set only.

## Test infrastructure changes

- **G-9**: Extend `playwright.config.ts` with a **mobile-RTL project** (mobile
  device profile, `ar` locale) in addition to the existing chromium-desktop
  project, and enable screenshot config.
- **G-10**: Add `@axe-core/playwright` as a dev dependency.

## Performance guardrail

- **G-11 (SC-012/FR-030)**: No **significant** regression in initial load or
  interaction responsiveness vs. the pre-refresh baseline on reviewed key
  screens (relative, not an absolute ms budget). The web font is subset +
  `font-display: swap` and self-hosted via `next/font` to keep cost bounded.

## Out-of-scope guard

- **G-12**: Tests/adoption MUST NOT introduce any out-of-scope feature (dark
  mode, exports, global search, notification center, PWA/offline/native,
  product-support purchases) — FR-028.
