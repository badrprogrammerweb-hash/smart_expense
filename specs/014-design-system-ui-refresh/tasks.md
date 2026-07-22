---
description: "Task list for Design System and UI Refresh Implementation"
---

# Tasks: Design System and UI Refresh Implementation

**Input**: Design documents from `specs/014-design-system-ui-refresh/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — the spec explicitly requires visual-regression, WCAG AA
accessibility, and end-to-end testing, plus behavior-green suites (FR-029,
SC-010/011). Test tasks are therefore first-class here.

**Scope guard**: `apps/web` only. Do **not** modify `apps/api/` or `supabase/`.
No API/DB/financial-logic/permission change (FR-026). Light mode only. No
out-of-scope feature (FR-028). All paths below are under `apps/web/`.

**Organization**: The P1/P2 user stories in this phase are cross-cutting
properties of one visual refresh built on a shared foundation. Phase 2
(Foundational) delivers the token/font/date/primitive layer that every story
depends on; the per-story phases then apply and verify each property across the
screen inventory.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US6 for user-story phases; Setup/Foundational/Polish carry no story label

## Path Conventions

- Frontend app root: `apps/web/`
- Primitive layer (new): `apps/web/components/ui/`
- Feature components: `apps/web/components/<feature>/`
- Routes: `apps/web/app/[locale]/...`
- Tests: `apps/web/components/**/__tests__/` (Vitest), `apps/web/e2e/` (Playwright)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tooling and scaffolding needed before foundation work.

- [X] T001 Add dev dependency `@axe-core/playwright` and wire the Tajawal web font via `next/font/google` (import in `apps/web/app/layout.tsx`, expose as a CSS variable); update `apps/web/package.json`. Do not yet apply the font globally (done in T008).
- [X] T002 [P] Extend `apps/web/playwright.config.ts`: add a `mobile-rtl` project (a mobile device profile, e.g. Pixel/iPhone, exercising the `ar` locale) alongside the existing `chromium` project, and enable screenshot/`toHaveScreenshot` config (threshold + snapshot dir) per `contracts/testing-contract.md` (G-9).
- [X] T003 [P] Scaffold the primitive layer directory `apps/web/components/ui/` with a barrel `index.ts` and a shared `apps/web/components/ui/__tests__/` folder (empty placeholders committed).
- [X] T004 [P] Create `apps/web/e2e/_helpers/matrix.ts` exporting the locale×viewport matrix (ar/en × phone/tablet/desktop) and reusable sign-in/seed helpers reused by visual/a11y/F-001 specs.
- [X] T005 [P] Capture and record a pre-refresh performance baseline note (initial load / interaction feel on dashboard) in `specs/014-design-system-ui-refresh/quickstart.md` "baseline" appendix for the SC-012/FR-030 guardrail comparison.

**Checkpoint**: Tooling ready; no visible UI change yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The token, font, date, and primitive foundation every user story
builds on. **No per-screen story work may begin until this phase is complete.**

**⚠️ CRITICAL**: Blocks all of Phase 3–8.

### Tokens, font, formatting

- [X] T006 Reconcile and extend design tokens in `apps/web/app/globals.css` per `contracts/design-tokens.md` and `data-model.md §1`: add `income`/`expense`/`pending`/`info` families (+`-foreground`/`-subtle`/`-border`), `--color-primary-hover`, `--color-surface-hover`, radius (control/card/pill), shadow (`--shadow-card`/`-dialog`/`-focus`), the 4–48 spacing scale, and `--numeric-feature`; keep OKLCH; author **no** dark-theme values (T9).
- [X] T007 [P] Add a token smoke test in `apps/web/components/ui/__tests__/tokens.test.ts` asserting the required CSS custom properties resolve on `:root` (design-tokens contract T-1..T-9).
- [X] T008 Apply the Tajawal family as the body font variable in `apps/web/app/globals.css` (replace `font-family: Arial`), with `font-display: swap` and a weight subset (400/500/700); ensure it serves both `ar` and `en` and financial values use tabular numerals (Decision 4).
- [X] T009 [P] Ensure all primitives/screens consume the existing Phase 12 currency formatter `apps/web/lib/money.ts` (do **not** create a new formatter or change any formatting logic); if a thin shared re-export helps adoption, re-export from `lib/money.ts` only (Decision 11, FR-013).

### F-001 date foundation (US3 enabler; foundational because every list/form uses it)

- [X] T010 Implement the single date helper in `apps/web/lib/format/date.ts` producing `DD/MM/YYYY` with Western digits, per `contracts/date-format-f001.md` (D-1..D-4).
- [X] T011 [P] Create the `DateDisplay` primitive in `apps/web/components/ui/date-display.tsx` that renders the helper output wrapped `dir="ltr"` with tabular numerals; add a generic `Ltr` isolation wrapper for emails/filenames/provider ids/URLs (FR-007).
- [X] T012 [P] Unit tests in `apps/web/components/ui/__tests__/date-display.test.tsx`: output is `DD/MM/YYYY`, Western digits, wrapper carries `dir="ltr"` (F-001 contract verification, D-unit).

### Primitive component layer (`components/ui/`) — token-driven, RTL/LTR-correct, all states

> Each build task follows `contracts/ui-primitives.md` (P-1..P-6): logical CSS
> properties, all interaction states, focus ring, ≥44px targets, stable public
> props. Each [P] task builds different files and includes its Vitest spec in
> `components/ui/__tests__/`.

- [X] T013 [P] Core primitives in `apps/web/components/ui/`: `button.tsx`, `icon-button.tsx`, `badge.tsx`, `alert.tsx`, `toast.tsx` (+ tests). Variants + loading-without-resize + accessible names.
- [X] T014 [P] Form primitives: `input.tsx`, `amount-input.tsx`, `select.tsx`, `textarea.tsx`, `file-upload.tsx`, and form field/label/error wrappers (+ tests). Amount groups amount/sign/currency in RTL, numeric mobile keyboard.
- [X] T015 [P] Date field control `apps/web/components/ui/date-field.tsx` (picker/input) rendering via the T010/T011 helper only (+ test).
- [X] T016 [P] Overlay primitives: `dialog.tsx`, `confirm-dialog.tsx`, `dropdown-menu.tsx` (+ tests). Focus-trapped, scrim, consequence-stating confirm.
- [X] T017 [P] Data primitives: `table.tsx`, `mobile-record-card.tsx`, `pagination.tsx`, `filter-bar.tsx`, `search-field.tsx` (+ tests). Table and mobile-card render the same record fields (type/amount/category main+sub/merchant/date/status/actor/actions).
- [X] T018 [P] Feedback primitives: `empty-state.tsx`, `error-state.tsx`, `permission-denied-state.tsx`, `skeleton.tsx` (+ tests). Error not color-only; permission-denied explains restriction; skeleton announces status to SR.
- [X] T019 [P] Finance primitives: `summary-card.tsx` (remaining-balance-dominant), `info-card.tsx`, `status-badge.tsx` (icon+label+color, pending≠confirmed), `receipt-preview.tsx`, `chart.tsx` (with textual summary) (+ tests).
- [X] T020 [P] Navigation/shell primitives: app shell, `sidebar.tsx`, mobile nav drawer, `workspace-switcher.tsx`, top header, `page-heading.tsx`, `tabs.tsx` (+ tests). Direction-aware via logical properties; active state obvious; workspace switching separated from account/language.
- [X] T021 Export all primitives from `apps/web/components/ui/index.ts` barrel and run `npm run test:unit` to confirm the primitive suite passes.

**Checkpoint**: Token/font/date/primitive foundation complete and unit-tested;
per-screen adoption can begin.

---

## Phase 3: User Story 1 — Every existing screen adopts the approved design (Priority: P1) 🎯 MVP

**Goal**: Every route/screen in the inventory renders the refreshed system
(tokens + primitives), with all prior functionality intact and no legacy
styling (FR-001/002/003/010, SC-001/002).

**Independent Test**: Navigate every route in both locales; each screen uses the
shared primitives, all actions remain reachable, dashboard remaining-balance is
dominant, no page shows old styling.

- [X] T022 [US1] Refresh the workspace shell/layout `apps/web/app/[locale]/w/[workspaceId]/layout.tsx` and `apps/web/components/layout/WorkspaceShell.tsx` onto the shell/sidebar/header/mobile-nav primitives (the frame all screens inherit).
- [X] T023 [P] [US1] Refresh the dashboard `apps/web/app/[locale]/w/[workspaceId]/dashboard/page.tsx` + `apps/web/components/dashboard/{SummaryCards,CategoryBreakdown,RecentActivity,DataState}.tsx` onto `summary-card`/`info-card`/`table`/`chart`; make remaining balance the dominant element (FR-010).
- [X] T024 [P] [US1] Refresh incomes `apps/web/app/[locale]/w/[workspaceId]/incomes/page.tsx` + `apps/web/components/income/{IncomeForm,IncomeHistoryList}.tsx` onto form/table/amount/date primitives (props/behavior preserved).
- [X] T025 [P] [US1] Refresh expenses `apps/web/app/[locale]/w/[workspaceId]/expenses/page.tsx` + `apps/web/components/expense/{ExpenseForm,ExpenseHistoryList,ExpenseFileAttach}.tsx` onto form/table/amount/date/file-upload primitives.
- [X] T026 [P] [US1] Refresh categories `apps/web/app/[locale]/w/[workspaceId]/categories/page.tsx` + `apps/web/components/category/{CategoryForm,CategoryList,CategoryPicker}.tsx` onto primitives; preserve main/subcategory distinction and income/expense separation (FR-014).
- [X] T027 [P] [US1] Refresh files `apps/web/app/[locale]/w/[workspaceId]/files/page.tsx` + `apps/web/components/files/{FileList,FileRow,FileUpload,DeleteFileDialog}.tsx` onto table/mobile-card/file-upload/confirm-dialog/receipt-preview primitives.
- [X] T028 [P] [US1] Refresh reports `apps/web/app/[locale]/w/[workspaceId]/reports/page.tsx` + `apps/web/components/reports/{ReportSummary,SpendingTrendChart,TopMerchants,TeamActivitySummary,PendingReviewSummary,PeriodSelector,PlainLanguageSummary,AiSpendingSummary}.tsx` onto card/chart/table primitives; charts get textual summaries; income≠expense not color-only (FR-027).
- [X] T029 [P] [US1] Refresh history `apps/web/app/[locale]/w/[workspaceId]/history/page.tsx` + `apps/web/components/history/{HistoryList,HistoryEmptyState}.tsx` onto table/mobile-card/empty-state primitives.
- [X] T030 [P] [US1] Refresh settings `apps/web/app/[locale]/w/[workspaceId]/settings/page.tsx` + `apps/web/components/settings/{AiSettingsCard,AiProviderKeyForm,AiKeyStatus,RemoveAiKeyDialog,AutoDeleteToggle,WorkspaceCurrencySelector,LanguageSwitcher,AiOptionalNotice}.tsx` onto card/form/select/confirm-dialog primitives; language and currency presented as separate settings (FR-015).
- [X] T031 [P] [US1] Refresh new-workspace/members `apps/web/app/[locale]/w/[workspaceId]/new-workspace/page.tsx` + `apps/web/components/layout/WorkspaceSelector.tsx` onto form/card/dropdown primitives.
- [X] T032 [P] [US1] Refresh auth screens `apps/web/app/[locale]/(auth)/{sign-in,sign-up,reset-password}/page.tsx` and the locale landing `apps/web/app/[locale]/page.tsx` onto card/form/button primitives + wordmark.
- [X] T033 [US1] Update presentation-coupled assertions in existing feature `__tests__` (category/extraction/files/settings) to the refreshed markup **without** weakening behavioral assertions (behavior-green, contract G-3); run `npm run test:unit` green.

**Checkpoint**: All 16 screens render the refreshed system; app is one coherent product; MVP demoable.

---

## Phase 4: User Story 2 — Arabic RTL and English LTR both render correctly (Priority: P1)

**Goal**: Full RTL shell in `ar` (nav right, mirrored) and full LTR shell in
`en` (nav left); language switch keeps everything functional, dimensions stable,
labels un-clipped, workspace currency unchanged (FR-004/005/006, SC-003).

**Independent Test**: Toggle language on shell + representative screens; verify
direction, translation coverage, isolated technical values, stable dimensions,
unchanged currency.

- [X] T034 [US2] Audit the shell/sidebar/header/mobile-drawer/workspace-switcher (from T020/T022) for logical-property correctness: sidebar at inline-start (right in `ar`, left in `en`), directional icons flip via `rtl:` only where meaning is directional, active page obvious; workspace switching visually separated from account + language actions (FR-004, brief §9).
- [X] T035 [P] [US2] Add missing UI-state/navigation strings to `apps/web/messages/ar.json` and `apps/web/messages/en.json` for all new primitive/state copy (no term changes to existing keys); confirm no untranslated system text remains on refreshed screens (FR-006).
- [X] T036 [P] [US2] Verify user-entered content (merchant/notes/user-created category names) and technical values render correctly in both directions using the `Ltr` isolation wrapper (T011); no auto-translation, no reversal (FR-006/007).
- [X] T037 [US2] Playwright bilingual spec `apps/web/e2e/refresh-rtl-ltr.spec.ts`: on dashboard, a record list, an add/edit form, and a dialog — assert nav side per locale, mirrored layout, stable dimensions / no clipping across `ar`↔`en`, and workspace currency unchanged by language switch.

**Checkpoint**: Both locales render correctly across the shell and representative screens.

---

## Phase 5: User Story 3 — Dates display correctly in RTL, resolving F-001 (Priority: P1)

**Goal**: Every date in tables/filters/forms/cards renders isolated `DD/MM/YYYY`
with correct order and no reversed separators, desktop + mobile-RTL
(FR-008/009, SC-004).

**Independent Test**: Inspect dates across tables/filters/forms/cards in `ar`
on desktop and mobile-RTL; order/separators/format/alignment correct everywhere.

- [X] T038 [US3] Sweep all refreshed screens to ensure every date renders through `DateDisplay`/date helper (no inline `toLocaleDateString`/manual formatting remains). Known inline-date call sites to convert: `apps/web/components/files/FileRow.tsx`, `apps/web/components/history/HistoryList.tsx`, `apps/web/components/reports/SpendingTrendChart.tsx`, `apps/web/app/[locale]/w/[workspaceId]/extractions/page.tsx`; also grep `apps/web/components` and `apps/web/app` for any remaining stray date formatting and replace (D-1).
- [X] T039 [P] [US3] Verify filters/date-range controls and card metadata use the isolated date rendering (tables, `PeriodSelector`, filter bars, record cards) (D-5).
- [X] T040 [US3] Playwright F-001 spec `apps/web/e2e/f001-dates.spec.ts` running on **both** the `chromium` and `mobile-rtl` projects: assert a date in a table, a filter, a form, and a card shows `DD/MM/YYYY` with no reversed separators in `ar` (FR-009, contract G-6).

**Checkpoint**: F-001 resolved and verified on desktop and mobile Arabic RTL.

---

## Phase 6: User Story 4 — Mobile, tablet, and desktop consistency (Priority: P2)

**Goal**: Deliberate mobile layouts; tables become cards; primary actions
reachable without excess scrolling; direction-aware compact nav; ≥44px targets
(FR-012/024/025, SC-005).

**Independent Test**: Complete key tasks at phone/tablet/desktop in both locales;
layout adapts deliberately, tables→cards on mobile, nav adapts by size+direction.

- [X] T041 [US4] Wire record lists (incomes/expenses/files/history/reports) to switch from `table` (desktop) to `mobile-record-card`/compact rows at mobile breakpoints — no forced horizontal scroll (FR-012, Decision 8).
- [X] T042 [P] [US4] Implement/verify the direction-aware mobile navigation drawer (from T020) with safe-area spacing and reachable primary quick actions (add expense / add income when permitted / upload receipt) (FR-024, brief §22).
- [X] T043 [P] [US4] Audit touch-target sizing (≥44×44px) and adjacent-control spacing across refreshed interactive primitives; fix violations (FR-025).
- [X] T044 [US4] Playwright responsive spec `apps/web/e2e/refresh-responsive.spec.ts` (chromium + mobile-rtl): each key task (view balance, add expense, add income when permitted, upload receipt, review extraction, switch workspace, filter records) is reachable at mobile/tablet/desktop widths in both locales; assert table→card conversion on mobile (SC-005, contract G-7).

**Checkpoint**: Consistent, deliberate experience across viewports and locales.

---

## Phase 7: User Story 5 — Empty, loading, error, permission states standardized (Priority: P2)

**Goal**: Standardized empty/loading/error/permission-denied states on every
screen where they occur; guiding empty states (no mandatory wizard); skeletons
over spinners; non-color-only errors; explained permission denials (FR-017–021,
SC-006/009).

**Independent Test**: Trigger each state on representative screens in both
locales; each uses the standardized treatment with clear guidance and
non-color-only signaling.

- [X] T045 [US5] Wire standardized empty states (first expense/income/receipt/invite as permitted) into dashboard, incomes, expenses, categories, files, history, reports, extractions using the `empty-state` primitive; empty workspace never looks broken (FR-017, brief §7).
- [X] T046 [P] [US5] Wire loading states: replace bare spinners with `skeleton`/determinate progress on list/dashboard/report loads and long-running actions (upload, extraction), with SR-announced status and duplicate-submit prevention (FR-018).
- [X] T047 [P] [US5] Wire standardized error states (`error-state`) and permission-denied states (`permission-denied-state`) for role-restricted actions across screens; errors are non-color-only; denials explain the Owner/Admin/Member/Viewer restriction (FR-019/020, SC-009).
- [X] T048 [US5] Playwright states spec `apps/web/e2e/refresh-states.spec.ts`: empty workspace guidance, loading skeleton, an error state, and a Viewer/Member permission-denied explanation each render correctly in both locales (SC-006).

**Checkpoint**: All four state types standardized and verified.

---

## Phase 8: User Story 6 — AI review remains non-final and distinct (Priority: P2)

**Goal**: Pending AI extraction visually distinct from confirmed data; review
communicates non-final; statuses clear; API keys masked; safe failure; confirm
still yields the same expense (FR-022/023/027, SC-007).

**Independent Test**: Walk the extraction flow; pending≠confirmed, statuses
clear, keys masked, failures safe, confirmation creates the expected expense.

- [X] T049 [US6] Refresh extraction queue `apps/web/app/[locale]/w/[workspaceId]/extractions/page.tsx` + `apps/web/components/extraction/{ExtractionStatusBadge,TriggerExtractionButton}.tsx` onto `status-badge`/`table`/`button`; pending rows visually distinct from confirmed records (FR-022).
- [X] T050 [US6] Refresh extraction review `apps/web/app/[locale]/w/[workspaceId]/extractions/[extractionId]/page.tsx` + `apps/web/components/extraction/{ExtractionReviewForm,DiscardExtractionDialog}.tsx` onto AI-review-form/confirm-dialog primitives; UI communicates values are not final until confirmed; failure state is safe (no file delete / no totals change) (FR-022, brief §18.1).
- [X] T051 [P] [US6] Verify AI key masking in `apps/web/components/settings/{AiKeyStatus,AiProviderKeyForm}.tsx` — no full key/token/vault value/internal id shown (FR-023, brief §24).
- [X] T052 [US6] Playwright AI-review spec `apps/web/e2e/refresh-ai-review.spec.ts`: pending extraction is visually distinct from a confirmed record, review shows non-final messaging, key is masked, and confirming creates the expected expense (behavior unchanged) (SC-007).

**Checkpoint**: AI review is clearly non-final and distinct in the refreshed UI.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Baselines, accessibility, full-inventory sweep, and regression gates.

- [X] T053 [P] Author visual-regression baselines `apps/web/e2e/visual-regression.spec.ts` for the representative screen set (dashboard, a record list table+mobile-card, an add/edit form, a dialog, reports, and empty/error/permission states) in **both** locales; capture with `--update-snapshots` and commit (contract G-4).
- [X] T054 [P] Author accessibility spec `apps/web/e2e/accessibility.spec.ts` using `@axe-core/playwright` over the same representative screens; assert no serious/critical violations, contrast ≥4.5:1, visible focus, accessible dialogs (contract G-5, FR-025/SC-008).
- [X] T055 Complete the manual full-inventory sweep checklist in `specs/014-design-system-ui-refresh/quickstart.md` (all 16 screens × `ar`/`en`) for adoption completeness (contract G-8, SC-001).
- [X] T056 Verify the SC-012/FR-030 performance guardrail: compare initial load / interaction feel against the T005 baseline on the dashboard; confirm no significant regression (note font subset + `swap`).
- [X] T057 Run the full frontend suite: `npm run test:unit` and `npm run test:e2e` (chromium + mobile-rtl) green (behavior-green + new visual/a11y checks) (SC-010).
- [X] T058 Run the **backend regression gate unmodified**: `cd apps/api && pytest` — entire suite passes as-is, confirming no API/financial/permission change (SC-011, contract G-2). Do not edit backend tests.
- [X] T059 [P] Final scope audit: confirm no out-of-scope feature introduced (dark mode, exports, global search, notification center, PWA/offline/native, product-support) and diff touches only `apps/web/` (FR-026/028); remove any dead legacy styles.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phases 3–8)**: All depend on Foundational.
  - US1 (Phase 3) delivers the adopted screens (the MVP) and the shell every other story refines.
  - US2/US3/US4/US5/US6 build on the US1-adopted screens; they can be worked largely in parallel after US1's shell (T022) and the relevant screens land, but each is independently verifiable.
- **Polish (Phase 9)**: Depends on the user-story phases being complete (baselines/sweep/gates run last).

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. Contains the shell (T022) that US2/US4 refine.
- **US2 (P1)**: Depends on Foundational + shell (T022); verifies direction across US1 screens.
- **US3 (P1)**: Depends on Foundational (date helper T010–T012); sweeps US1 screens.
- **US4 (P2)**: Depends on Foundational + US1 lists/shell.
- **US5 (P2)**: Depends on Foundational (state primitives) + US1 screens.
- **US6 (P2)**: Depends on Foundational + US1 extraction/settings screens.

### Within Each Phase

- Primitives (Phase 2) before any screen adoption (Phase 3+).
- Shell (T022) before US2/US4 nav refinements.
- Date helper (T010–T012) before US3 sweep/verification.
- Verification/e2e spec tasks come after the implementation they check.

### Parallel Opportunities

- Setup: T002–T005 in parallel.
- Foundational: primitive-group tasks T013–T020 in parallel (different files) after tokens/font/date (T006–T012).
- US1: screen tasks T023–T032 in parallel (different screen folders) after the shell (T022).
- Polish: T053/T054/T059 in parallel.

---

## Parallel Example: Phase 2 primitive layer

```bash
# After T006–T012 (tokens/font/date) land, build primitive groups in parallel:
Task: "T013 Core primitives (button/icon-button/badge/alert/toast) + tests"
Task: "T014 Form primitives (input/amount/select/textarea/file-upload) + tests"
Task: "T016 Overlay primitives (dialog/confirm-dialog/dropdown-menu) + tests"
Task: "T017 Data primitives (table/mobile-record-card/pagination/filter/search) + tests"
Task: "T018 Feedback primitives (empty/error/permission/skeleton) + tests"
Task: "T019 Finance primitives (summary/info/status-badge/receipt/chart) + tests"
Task: "T020 Navigation/shell primitives + tests"
```

## Parallel Example: Phase 3 screen adoption

```bash
# After the shell (T022) lands, adopt screens in parallel:
Task: "T023 Dashboard onto primitives"
Task: "T024 Incomes onto primitives"
Task: "T025 Expenses onto primitives"
Task: "T026 Categories onto primitives"
Task: "T027 Files onto primitives"
Task: "T028 Reports onto primitives"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational (tokens/font/date/primitives).
2. Phase 3 US1: adopt the shell + all 16 screens.
3. **STOP and VALIDATE**: every screen renders the refreshed system, all actions intact, both locales load — demoable MVP.

### Incremental Delivery

1. Foundation ready → US1 (coherent refreshed app, MVP).
2. US2 (both directions verified) → US3 (F-001 fixed) → complete the P1 set.
3. US4 (responsive) → US5 (states) → US6 (AI review) — each an independently testable increment.
4. Polish: baselines, a11y, manual sweep, perf guardrail, frontend + backend gates.

### Notes

- [P] = different files, no incomplete-task dependency.
- Preserve each feature component's public props/behavior so behavioral/flow
  assertions stay green while markup/classes change (Decision 10, contract G-1/G-3).
- Backend suite is frozen: run `pytest` unmodified as the regression gate (T058).
- Commit after each task or logical group; validate at each checkpoint.
