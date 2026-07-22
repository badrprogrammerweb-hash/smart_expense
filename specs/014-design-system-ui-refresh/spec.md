# Feature Specification: Design System and UI Refresh Implementation

**Feature Branch**: `014-design-system-ui-refresh`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Phase 14 — Design System and UI Refresh Implementation. Implement the approved design system across all existing MVP screens in the Next.js frontend. Apply redesigned Arabic RTL and English LTR layouts across desktop, tablet, and mobile. Standardize forms, tables, cards, dialogs, navigation, and empty/loading/error/permission states using shared design tokens. Resolve the F-001 RTL date display issue. Frontend/visual-layer refresh only: preserve existing APIs, permissions, financial rules, database schema, and business logic. Complete visual regression, WCAG AA accessibility, and end-to-end testing."

## Overview

Smart Expense - AI shipped its MVP (Phases 1–10) with a functional but
unpolished, Arabic-first interface, then added full Arabic/English
localization with per-workspace base currency (Phase 12) and hierarchical
income/expense categories (Phase 13). Phase 11 produced an approved design
brief and a reference design system (tokens, components, and screen
specimens).

Phase 14 applies that approved design across every existing screen of the
running application, in both Arabic RTL and English LTR, across mobile,
tablet, and desktop. It is a **visual and interaction-layer refresh only**:
no API, database, permission, or financial-calculation behavior changes.
The known RTL date-display defect (F-001) is resolved as part of this work.

This specification describes **what** the refreshed experience must deliver
and how success is verified. It deliberately avoids prescribing component
internals, file layout, or framework mechanics — those belong in the plan.

## Clarifications

### Session 2026-07-21

All clarifications for this phase were resolved with MVP-safe defaults per the
approved design brief.

- Q: What tooling/baseline anchors the required "visual regression" testing? →
  A: Reuse the existing frontend end-to-end (Playwright) setup for
  screenshot-based visual-regression baselines; do not introduce a separate
  visual-testing tool.
- Q: Must automated visual + accessibility checks cover every screen, or a
  representative set? → A: Automated checks cover a representative set of key
  screens and states per locale; the full screen inventory is verified by a
  manual review sweep.
- Q: Is there a performance target for the refresh? → A: No absolute target;
  apply a soft guardrail of no significant regression in initial load or
  interaction responsiveness relative to the current pre-refresh baseline.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every existing screen adopts the approved design consistently (Priority: P1)

A returning user opens the application and moves through authentication,
dashboard, income, expenses, add/edit forms, categories, files/receipts, AI
settings, AI extraction status and review, reports, history, workspace
switcher, workspace members, and settings. Every screen now presents the
approved visual language — shared color, type, spacing, radius, and elevation
tokens; standardized cards, forms, tables, dialogs, navigation, and status
treatments — so the product reads as one coherent, intentional application
rather than a set of separately styled pages. No previously available screen
or action is missing, and every existing task can still be completed.

**Why this priority**: The core deliverable of the phase is a consistent,
approved look and feel across the entire existing surface. Without it, none of
the phase's exit criteria are met. This is the minimum viable slice — a single
screen refreshed in isolation would not deliver the "one coherent product"
outcome.

**Independent Test**: Navigate every existing route in both Arabic and English
and confirm each screen uses the shared design tokens and standardized
components, all prior functionality remains reachable, and no page retains the
old styling.

**Acceptance Scenarios**:

1. **Given** an authenticated user on any existing route, **When** the page
   renders, **Then** it uses the approved shared design tokens and
   standardized components rather than legacy page-specific styling.
2. **Given** the full route inventory from the MVP, **When** the refreshed
   application is reviewed, **Then** no previously available screen, record
   list, form, or action has been removed or made unreachable.
3. **Given** the remaining-balance figure on the dashboard, **When** the
   dashboard renders, **Then** remaining balance is the visually dominant
   financial element and the dashboard does not present many equal-weight
   cards.
4. **Given** any interactive control, **When** the user hovers, focuses,
   presses, or disables it, **Then** the defined interaction state (default,
   hover, focus, active, selected, disabled, loading, error, success) is
   presented consistently across the application.

---

### User Story 2 - Arabic RTL and English LTR layouts both render correctly (Priority: P1)

A user switches interface language between Arabic and English. In Arabic the
entire shell is right-to-left (navigation on the right, forms/tables/dialogs
and pagination mirrored); in English the entire shell is left-to-right
(navigation on the left). Translated system text, navigation labels, and
category names follow the selected language, while user-entered content
(merchant names, notes, user-created category names) and technical values
(dates, emails, file names, provider identifiers, URLs) are never
auto-translated or misordered. Switching language does not change the
workspace currency, does not break navigation/forms/tables/dialogs, and does
not shift component dimensions or clip longer labels.

**Why this priority**: The application already serves both locales; a refresh
that only worked in one direction would regress a shipped capability. Correct
bidirectional layout is a gating requirement, not an enhancement.

**Independent Test**: Toggle language on representative screens (dashboard, a
record list, an add/edit form, a dialog, reports) and confirm direction,
translation coverage, isolated technical values, stable dimensions, and
unchanged workspace currency in each direction.

**Acceptance Scenarios**:

1. **Given** the Arabic interface, **When** any application shell renders,
   **Then** navigation appears on the right and forms, tables, dialogs, and
   pagination are mirrored for RTL.
2. **Given** the English interface, **When** any application shell renders,
   **Then** navigation appears on the left and the same components render
   correctly for LTR.
3. **Given** a user switches interface language, **When** the switch
   completes, **Then** navigation, forms, tables, and dialogs remain
   functional, component dimensions stay stable, longer labels are not
   clipped, and the workspace base currency is unchanged.
4. **Given** system-provided category names and navigation labels, **When**
   the language changes, **Then** they display in the selected language, while
   user-created category names, merchant names, and notes remain exactly as
   entered.

---

### User Story 3 - Dates display correctly in RTL, resolving F-001 (Priority: P1)

A user in the Arabic RTL interface views dates in tables, filters, forms, and
cards, on desktop and on mobile. Every date preserves its correct day, month,
and year order with no reversed separators, using one consistent `DD/MM/YYYY`
display format and Western digits, isolated so bidirectional heuristics cannot
scramble it.

**Why this priority**: F-001 is a named, tracked defect and an explicit phase
exit criterion. Misread dates on financial records directly undermine trust,
so this is treated as a first-class, independently verifiable outcome.

**Independent Test**: Inspect dates across tables, filters, forms, and cards in
Arabic RTL on desktop and on at least one mobile Arabic RTL environment, and
confirm order, separators, format, and alignment are correct everywhere.

**Acceptance Scenarios**:

1. **Given** the Arabic RTL interface, **When** a date renders in a table,
   filter, form, or card, **Then** it shows `DD/MM/YYYY` with Western digits,
   correct component order, and no reversed separators.
2. **Given** the same date value across different surfaces, **When** those
   surfaces render, **Then** the date uses one consistent format and aligns
   consistently.
3. **Given** a mobile Arabic RTL environment, **When** dates render on any
   screen, **Then** they display correctly, matching desktop behavior.

---

### User Story 4 - Mobile, tablet, and desktop experiences are consistent and usable (Priority: P2)

A user completes key tasks — viewing remaining balance, adding an expense,
adding income (when permitted), uploading a receipt, reviewing extracted data,
switching workspace, and filtering records — on a phone, a tablet, and a
desktop. Mobile is a deliberate layout: complex tables become cards or compact
rows, primary actions stay reachable without unnecessary scrolling, navigation
becomes a direction-aware compact pattern, and touch targets and safe-area
spacing are comfortable. The experience feels like the same coherent product
at every size.

**Why this priority**: Responsive behavior is an exit criterion and a
prerequisite for later PWA/mobile phases, but it builds on the standardized
components delivered by Stories 1–3, so it is sequenced after them.

**Independent Test**: Complete each key task at mobile, tablet, and desktop
widths in both languages and confirm layout adapts deliberately, primary
actions remain reachable, tables become cards on mobile, and navigation
adapts by direction and size.

**Acceptance Scenarios**:

1. **Given** a mobile viewport, **When** a complex record table would render,
   **Then** it is presented as cards or compact rows instead of forcing
   excessive horizontal scrolling.
2. **Given** a mobile viewport, **When** the user performs a primary task
   (view balance, add expense, add income, upload receipt, review extraction,
   switch workspace, filter records), **Then** the primary action is reachable
   without unnecessary scrolling.
3. **Given** any supported viewport (phone, tablet, laptop, large desktop) in
   either language, **When** navigation renders, **Then** it adapts to the
   size and reading direction while keeping the active page obvious.
4. **Given** touch interaction, **When** controls render, **Then** touch
   targets are at least 44×44px with sufficient spacing between adjacent
   controls.

---

### User Story 5 - Empty, loading, error, and permission states are standardized and clear (Priority: P2)

A new user with an empty workspace, a user waiting on data or a long-running
action (upload, AI extraction), a user hitting an error, and a Viewer or
Member attempting a restricted action all encounter clear, standardized
states. Empty workspaces guide the user toward first actions without a
mandatory onboarding wizard; loading uses skeletons/determinate progress
rather than bare spinners; errors are understandable and never rely on color
alone; permission-denied states explain the restriction rather than showing a
bare failure.

**Why this priority**: These states are named phase deliverables and are what
make the product feel finished and trustworthy, but they layer onto the
standardized components from Story 1.

**Independent Test**: Trigger empty, loading, error, and permission-denied
conditions on representative screens in both languages and confirm each uses
the standardized state treatment with clear guidance and non-color-only
signaling.

**Acceptance Scenarios**:

1. **Given** a workspace with no records, **When** a list or dashboard
   renders, **Then** it shows a standardized empty state with clear first
   actions (e.g., add first expense/income when permitted, upload first
   receipt, invite member when permitted) and does not look broken.
2. **Given** data or a long-running action is in progress, **When** the screen
   renders, **Then** it shows skeletons or determinate/indeterminate progress
   with a descriptive label, and controls prevent duplicate submission.
3. **Given** an error condition, **When** it is surfaced, **Then** the message
   is understandable and conveys meaning through text/icon, not color alone.
4. **Given** a Viewer or Member attempting a restricted action, **When** the
   restriction applies, **Then** a permission-denied state explains why the
   action is unavailable rather than showing an unexplained failure.

---

### User Story 6 - AI review remains clearly non-final and distinct from confirmed data (Priority: P2)

A user with AI configured uploads a receipt, starts extraction, and reviews the
result. The refreshed AI review experience makes clear that extracted data is
pending and must be reviewed before it becomes a real expense; pending
extraction is never visually confused with a confirmed transaction. Extraction
status (processing, ready for review, failed, confirmed, discarded), failure
states, and masked API-key presentation are all understandable, and confirming
still produces the same expense outcome as before.

**Why this priority**: Keeping unconfirmed AI data visually distinct is a
constitutional and trust requirement; the refresh must not blur that line. It
depends on standardized status and form components from earlier stories.

**Independent Test**: Walk the extraction flow and confirm pending states are
visually distinct from confirmed records, statuses read clearly, AI keys are
masked, failure states are safe, and confirmation still creates the expected
expense without any change to totals behavior.

**Acceptance Scenarios**:

1. **Given** a pending AI extraction, **When** it appears in review or in any
   list, **Then** it is visually distinct from a confirmed transaction and
   labeled as requiring review.
2. **Given** the AI review form, **When** the user reviews extracted values,
   **Then** the interface communicates that AI values are not final until
   confirmed.
3. **Given** AI settings, **When** an API key is displayed, **Then** it is
   masked and no full key, token, or vault value is shown.
4. **Given** an extraction failure, **When** it is surfaced, **Then** the
   failure state is clear and does not delete files or affect financial totals.

---

### Edge Cases

- Longer English labels or long Arabic strings must not clip or resize shared
  components; layouts must accommodate label-length differences across
  languages.
- Switching language mid-task (e.g., with a dialog open or a form partially
  filled) must not break the open component or lose in-progress input.
- Switching workspace must immediately update currency formatting without
  changing the interface language.
- Bidirectional content within one field (Arabic note containing an English
  provider name, email, or URL) must keep the technical/Latin run isolated LTR
  without reversing surrounding Arabic.
- Changing a workspace's base currency when records already exist must present
  a clear warning and require confirmation, and must not imply historical
  amounts were converted.
- Amounts with sign and currency indicator must stay visually grouped and
  correctly ordered in RTL, and positive/negative states must not rely on
  color alone.
- Zero-state, single-record, and long-list pagination must all render the
  standardized list and empty treatments correctly.
- Screen readers must receive status updates for loading and completed
  long-running actions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST apply the approved design system's shared
  tokens (color, typography, spacing, radius, elevation) and standardized
  components across every existing MVP screen, replacing legacy page-specific
  styling.
- **FR-002**: The refresh MUST cover the complete existing screen inventory:
  authentication/sign-in, dashboard, income records, expense records,
  add/edit record forms, categories, receipt/invoice files, AI provider and
  API-key settings, AI extraction status and review, AI extraction review
  queue, reports and summaries, history, workspace switcher, workspace members
  and permissions, general settings, and the first-run/empty-workspace
  experience — with no existing functional page omitted.
- **FR-003**: Every existing user-facing action and workflow MUST remain
  available and functionally unchanged after the refresh; the refresh MUST NOT
  add, remove, or alter application behavior beyond presentation and
  interaction states.
- **FR-004**: The application MUST render a fully RTL shell in Arabic
  (navigation on the right; forms, tables, dialogs, and pagination mirrored)
  and a fully LTR shell in English (navigation on the left), with the active
  page clearly indicated in both.
- **FR-005**: Switching interface language MUST keep navigation, forms,
  tables, and dialogs functional, keep component dimensions stable, avoid
  clipping longer labels in either language, and MUST NOT change the workspace
  base currency.
- **FR-006**: System-provided text — navigation labels, system category names,
  validation messages, empty/error/permission copy — MUST be fully translated
  for the selected language; user-entered content (merchant names, notes,
  user-created category names) MUST NOT be auto-translated.
- **FR-007**: Technical and Latin-script values (dates, email addresses, file
  names, API-key hints, URLs, provider identifiers, technical error codes)
  MUST be rendered with isolated LTR direction inside both language layouts so
  they are never reversed by bidirectional heuristics.
- **FR-008**: Dates MUST render in one consistent `DD/MM/YYYY` format with
  Western digits, isolated LTR, preserving day/month/year order with no
  reversed separators, and MUST align consistently across tables, filters,
  forms, and cards (resolving F-001).
- **FR-009**: F-001 date correctness MUST be verified in tables, filters,
  forms, and cards, on desktop and on at least one mobile Arabic RTL
  environment.
- **FR-010**: The dashboard MUST present remaining balance as the visually
  dominant financial element and MUST avoid presenting many equal-weight
  cards, while surfacing total income, total expenses, selected period, recent
  records, spending category summary, pending AI reviews, and primary quick
  actions.
- **FR-011**: Forms MUST use standardized patterns: persistent visible labels,
  clear required-field indication, inline field-level validation, a visually
  obvious primary action, cancel/destructive actions that do not compete with
  the primary action, keyboard navigation, appropriate mobile keyboards for
  numeric fields, and submission states that prevent duplicate actions.
- **FR-012**: Record lists MUST use standardized table (desktop) and card /
  compact-row (mobile) presentations that clearly show record type, amount,
  category (main and subcategory where applicable), merchant/source, date,
  status, actor when relevant, and available actions, without forcing
  excessive horizontal scrolling on mobile.
- **FR-013**: Financial values MUST follow the workspace base currency
  everywhere (dashboard, forms, records, reports, charts, AI review, history),
  keep amount/sign/currency-indicator visually grouped and correctly ordered
  in RTL, convey positive/negative through more than color, and MUST NOT offer
  a per-record currency selector or imply currency conversion.
- **FR-014**: Hierarchical categories MUST be presented per the current
  implementation: separate income and expense category sets, a clear
  distinction between main category and subcategory, subcategory selection
  where available, translated system category names, user-created names shown
  as entered, and disabled categories that remain identifiable in historical
  records — across both languages.
- **FR-015**: Changing a workspace's base currency when records exist MUST
  present a clear warning and require confirmation and MUST NOT imply
  historical amounts were converted; workspace currency selection MUST appear
  in workspace settings and be presented separately from the user language
  preference.
- **FR-016**: Every interactive component MUST define and present the states:
  default, hover, focus, active, selected, disabled, loading, error, and
  success; keyboard focus MUST be clearly visible; controls MUST NOT resize
  during loading.
- **FR-017**: Standardized empty states MUST guide users toward permitted
  first actions without a mandatory multi-step onboarding wizard, and an empty
  workspace MUST NOT appear broken.
- **FR-018**: Standardized loading states MUST use skeletons or
  determinate/indeterminate progress with descriptive labels for long-running
  actions (upload, AI extraction) rather than bare spinners, and MUST surface
  screen-reader-friendly status updates for loading and completed actions.
- **FR-019**: Standardized error states MUST be understandable and MUST NOT
  rely on color alone to convey meaning.
- **FR-020**: Permission-restricted actions MUST present a standardized
  permission-denied state that explains the restriction rather than an
  unexplained failure, consistent with existing role permissions (Owner,
  Admin, Member, Viewer).
- **FR-021**: Destructive actions MUST use confirmation dialogs that state the
  consequence plainly.
- **FR-022**: Pending AI extraction data MUST be visually distinct from
  confirmed financial data in review and in any list; the AI review experience
  MUST communicate that extracted values are not final until the user confirms
  them.
- **FR-023**: AI provider settings MUST present API keys masked and MUST NOT
  expose full API keys, access tokens, vault values, or internal database
  identifiers anywhere in the interface.
- **FR-024**: The responsive design MUST support phone, tablet, laptop, and
  large-desktop sizes with mobile treated as a deliberate layout; primary
  tasks (view balance, add expense, add income when permitted, upload receipt,
  review extraction, switch workspace, filter records) MUST remain easy and
  reachable without unnecessary scrolling; mobile navigation MUST be a
  direction-aware compact pattern.
- **FR-025**: The interface MUST target WCAG AA where practical: body-text
  contrast of at least 4.5:1, visible focus states, keyboard navigation,
  proper form labels, accessible dialogs, meaningful icon labels, charts
  accompanied by textual summaries or supporting data, and touch targets of at
  least 44×44px.
- **FR-026**: The refresh MUST NOT change API contracts, database schema,
  financial calculation rules, confirmed-only totals behavior, role
  permissions, authentication, AI provider behavior, file storage rules,
  history append-only behavior, or workspace isolation.
- **FR-027**: Charts and reports MUST follow the standardized visual language
  and workspace currency, distinguish income from expenses without relying on
  color alone, and remain based only on confirmed records (no presentation
  change to which records count toward totals).
- **FR-028**: The refresh MUST NOT introduce out-of-scope features: dark mode,
  global search, persistent notification center, email/notification settings,
  budget-threshold alerts, report/PDF/Excel/CSV/print export, privacy mode,
  Eastern Arabic numeral preference, OTP/2FA/session-timeout redesign,
  product-support purchase or payment flows, PWA installation, offline
  behavior, or native packaging.
- **FR-029**: The refreshed frontend MUST keep the automated test suites
  behavior-green: all behavioral, user-flow, financial-accuracy, role-
  permission, and RTL/LTR-direction assertions MUST continue to pass, and the
  entire backend suite MUST be re-run unmodified. Presentation-coupled
  assertions (DOM selectors, class names, and screenshot baselines) MAY be
  updated to match the refreshed markup — that is expected churn, not a
  regression. The phase MUST add coverage for
  visual regression, WCAG AA accessibility, and end-to-end validation of the
  refreshed screens. Visual-regression coverage MUST reuse the existing
  end-to-end (Playwright) setup for screenshot baselines rather than
  introducing a separate visual-testing tool; automated visual and
  accessibility checks MUST cover a representative set of key screens and
  states per locale, and the full screen inventory MUST be verified by a
  documented manual review sweep.
- **FR-030**: The refresh MUST NOT introduce a significant regression in
  initial page load or interaction responsiveness relative to the current
  pre-refresh baseline (soft guardrail; no absolute performance target).

### Key Entities *(include if feature involves data)*

- **Design token set**: The shared, named visual values (color, typography,
  spacing, radius, elevation, breakpoints) that all refreshed screens
  reference instead of page-specific styling.
- **Standardized component**: A reusable presentation/interaction unit
  (application shell, sidebar, mobile navigation, workspace switcher, header,
  page heading, summary/info cards, buttons/icon buttons, inputs, amount
  input, date input, select/combobox, textarea, file upload, tabs, tables,
  mobile record cards, filters, search fields, status badges, alerts, toasts,
  dialogs, confirmation dialogs, dropdown menus, pagination, skeletons, empty
  states, error states, permission-denied states, charts, receipt preview, AI
  review form, language switcher, currency selector, hierarchical category
  picker, currency-change warning dialog) built from shared tokens and covering
  all defined interaction states in both directions.
- **Screen inventory**: The complete set of existing MVP routes/screens that
  must each adopt the refreshed system with no omissions.
- **Interaction state**: The defined per-component states (default, hover,
  focus, active, selected, disabled, loading, error, success) that must be
  represented consistently.
- **Note**: This phase introduces no new persisted data entities; existing
  domain entities (income, expense, category, file, extraction, workspace,
  member, settings, history) are unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing MVP screens in the screen inventory render
  with the approved shared design tokens and standardized components, with zero
  screens retaining legacy page-specific styling.
- **SC-002**: 100% of previously available screens and user actions remain
  reachable and functional after the refresh (no functional regressions).
- **SC-003**: Every reviewed screen renders correctly in both Arabic RTL and
  English LTR, with navigation on the correct side and mirrored components, and
  language switching breaks no navigation, form, table, or dialog.
- **SC-004**: F-001 is resolved: 100% of date displays across tables, filters,
  forms, and cards show correct `DD/MM/YYYY` order with no reversed separators,
  verified on desktop and at least one mobile Arabic RTL environment.
- **SC-005**: Every key task (view balance, add expense, add income when
  permitted, upload receipt, review extraction, switch workspace, filter
  records) is completable at phone, tablet, and desktop widths in both
  languages, with primary actions reachable without unnecessary scrolling.
- **SC-006**: Empty, loading, error, and permission-denied states are present
  and standardized on every screen where they can occur, with no bare spinner,
  unexplained permission failure, or color-only error signaling.
- **SC-007**: Pending AI extraction is never visually indistinguishable from a
  confirmed transaction; reviewers can always tell pending data from confirmed
  data.
- **SC-008**: Accessibility checks pass WCAG AA targets on reviewed screens:
  body-text contrast ≥ 4.5:1, visible focus on all interactive elements, and
  touch targets ≥ 44×44px.
- **SC-009**: A first-time user can add an expense and understand the remaining
  balance without external instruction, and a Viewer or Member never
  encounters an unexplained permission failure.
- **SC-010**: Existing test suites stay behavior-green — every behavioral,
  flow, financial, permission, and direction assertion passes, and the backend
  suite passes unmodified (presentation-coupled assertions updated to the new
  markup do not count as regressions) — and new visual-regression (screenshot
  baselines via the existing Playwright setup) and accessibility checks pass
  for a representative set of key screens and states per locale, with the full
  screen inventory covered by a documented manual review sweep.
- **SC-011**: No backend endpoint, database schema, financial-calculation
  result, or role-permission outcome changes as a result of this phase
  (verified by unchanged backend contract/logic tests).
- **SC-012**: Initial page load and interaction responsiveness show no
  significant regression relative to the pre-refresh baseline on the reviewed
  key screens.

## Assumptions

- **Authoritative source**: The approved design brief
  (`docs/design/claude-design-final/uploads/design-brief.md`) is the
  authoritative requirements source. The accompanying reference design system
  under `docs/design/claude-design-final/` is treated as a v0 illustrative
  reference (Arabic-only, light-only, substitute fonts, no logo) to adapt to
  the real stack — not as final code to copy verbatim.
- **Both locales are current-state**: Because Phase 12 (i18n + workspace base
  currency) and Phase 13 (hierarchical categories) are already merged, the
  design brief's "future-state" items — language switcher, workspace
  base-currency selector, currency-change warning, and hierarchical category
  picker — are current-state and in scope, and must be delivered in both
  Arabic and English.
- **Light mode only**: No dark theme is introduced (explicitly out of scope).
- **Numerals**: Western digits (`0123456789`) are used everywhere in both
  languages; Eastern Arabic-Indic digits are not offered.
- **Date format**: A single `DD/MM/YYYY` display format is used across the
  application; localized alternative date formats are not introduced in this
  phase.
- **Framework continuity**: The existing frontend stack (Next.js, React,
  Tailwind CSS, Shadcn UI) is evolved in place; no alternative frontend
  framework is introduced, and existing FastAPI endpoints and Supabase
  services are reused unchanged.
- **Fonts and logo**: The brand uses a wordmark (no logo) and the approved
  Arabic-first typeface family; if licensed font files or a logo are provided
  later, they can be swapped in without changing this phase's scope.
- **No new backend work**: This phase requires no new backend endpoints,
  migrations, or schema changes; if a screen appears to need new data, that is
  a signal to re-scope, not to add backend behavior in this phase.
- **Testing environments**: A modern Chrome browser and at least one mobile
  Arabic RTL environment are available for F-001 and responsive verification;
  visual-regression (screenshot baselines) and accessibility checks run within
  the existing frontend end-to-end (Playwright) setup, so no separate
  visual-testing tool is added.
- **Coverage strategy**: Automated visual and accessibility checks target a
  representative set of key screens and states per locale; exhaustive per-
  screen automation is intentionally avoided in favor of a documented manual
  review sweep across the full inventory, keeping the task set bounded and
  MVP-safe.
- **Performance**: The refresh is held to a relative "no significant
  regression" guardrail rather than an absolute load-time budget, since this
  is a visual-layer change over unchanged backend behavior.
- **Prototype-to-implementation translation**: The design brief's Phase 11
  acceptance criteria (which read as "X is represented in the prototype") are
  translated here into implementation terms ("X works correctly in the running
  application").
