---

description: "Task list for Frontend Core Experience (005-frontend-core-experience)"
---

# Tasks: Frontend Core Experience

**Input**: Design documents from `/specs/005-frontend-core-experience/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principle XIV explicitly requires testing Arabic/English UI behavior, RTL layout behavior, role permissions, and tenant isolation — all of which this phase's UI introduces for the first time — and spec.md's SC-005/SC-006/SC-007 require verified outcomes. `research.md` Decision 8 selects Vitest + React Testing Library for unit/component coverage and Playwright for the cross-page/RTL flows a component test can't observe.

**Organization**: Tasks are grouped by user story (US1-US6 from `spec.md`) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Which user story this task belongs to (US1-US6)
- Exact file paths are included in each description

## Path Conventions

Monolith web application layout per `plan.md`: every task in this phase is
confined to `apps/web`. `apps/api` and `supabase/` are unchanged — no new
backend endpoint, table, or migration is introduced (see
`contracts/frontend-api-consumption.md`). All paths below are relative to
`apps/web/` unless stated otherwise.

---

## Phase 1: Setup

**Purpose**: Bring in the frontend dependencies and tooling this phase needs. `apps/web` today is still the bare Phase 1 shell (`next`, `react`, `react-dom` only) — every item below is a genuinely new install, not a version bump.

- [X] T001 Add new dependencies to `package.json` and install: Tailwind CSS v4 packages, `@supabase/supabase-js`, `@supabase/ssr`, `next-intl`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test` (research.md Decisions 1, 2, 3, 4, 5, 8)
- [X] T002 Initialize `shadcn/ui` via its CLI (depends on T001): generates `components.json`, `app/globals.css` with Tailwind v4 `@theme` tokens (CSS-first config, no `tailwind.config.js`), the shadcn CLI's own dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`), and the `@/*` import alias in `tsconfig.json` (research.md Decision 1)
- [X] T003 [P] Configure Vitest: `vitest.config.ts` (jsdom environment, `@/*` alias resolution) and `tests/unit/setup.ts` (jest-dom matchers) (depends on T001; research.md Decision 8)
- [X] T004 [P] Configure Playwright: `playwright.config.ts` (base URL `http://localhost:3000`, dev server auto-start) and an empty `tests/e2e/` directory (depends on T001; research.md Decision 8)
- [X] T005 [P] Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.example`, alongside the existing `NEXT_PUBLIC_API_URL` (research.md Decision 3)

**Checkpoint**: Tooling ready — Tailwind/shadcn render, Vitest/Playwright run an empty suite, env vars documented

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The auth, i18n, API-client, and workspace-shell scaffolding every one of the six user stories needs. No user story screen can be built before this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Create `lib/supabase/client.ts`: browser Supabase client via `@supabase/ssr`'s `createBrowserClient` (depends on T001; research.md Decision 3)
- [X] T007 [P] Create `lib/supabase/server.ts`: server/middleware Supabase client via `@supabase/ssr`'s `createServerClient`, used only for session-cookie refresh (depends on T001; research.md Decision 3)
- [X] T008 Create `middleware.ts` combining next-intl's locale middleware with the Supabase session-refresh client from T007, plus a redirect-to-`/{locale}/sign-in` guard for any unauthenticated request under `/{locale}/w/*` (depends on T006, T007; FR-005; research.md Decision 3)
- [X] T009 [P] Create `i18n/routing.ts` (locale list `en`/`ar`, default `en`) and `i18n/request.ts` (next-intl request config) (research.md Decision 2)
- [X] T010 [P] Create `messages/en.json` and `messages/ar.json` with base namespaces (`common`, `nav`, `auth`, `errors`) — enough for the sign-in/sign-up/dashboard shell; later user stories extend these files as their screens are built (FR-030, FR-032; research.md Decision 2)
- [X] T011 Create `app/[locale]/layout.tsx`: sets `<html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>`, wraps children in `NextIntlClientProvider` and a `QueryClientProvider` (depends on T009, T010, T001; research.md Decisions 2, 4)
- [X] T012 [P] Create `lib/money.ts`: `toDisplayAmount(minor, locale)` using `Intl.NumberFormat(locale, { style: "currency", currency: "SAR" })`, and `parseInputToMinor(input)` parsing a decimal string directly to an integer halala count with no floating-point step (FR-033; research.md Decision 7; Constitution IX/X)
- [X] T013 [P] Create `lib/api/client.ts`: fetch wrapper reading the current Supabase session's `access_token` (from T006) and attaching `Authorization: Bearer <token>`, base URL from `NEXT_PUBLIC_API_URL`, and a typed `ApiError` parsed from the shared `{error:{code,message}}` response shape (depends on T006; `002-auth-workspace-foundation/contracts/session-validation.md`)
- [X] T014 [P] Create `lib/api/workspaces.ts` with `getWorkspaces()` and `getWorkspace(workspaceId)` (depends on T013; `002-auth-workspace-foundation/contracts/workspaces-api.md`; `contracts/frontend-api-consumption.md`)
- [X] T015 [P] Create `hooks/use-workspaces.ts`: `useWorkspaces()` and `useWorkspace(workspaceId)` TanStack Query hooks, query key `["workspaces"]` / `["workspace", workspaceId]` (depends on T014)
- [X] T016 Create `lib/workspace-context.tsx`: `WorkspaceProvider`/`useWorkspaceContext()` exposing `{ workspaceId, workspaceType, workspaceName, role, memberCount }` derived from the `w/[workspaceId]` URL segment matched against `useWorkspace(workspaceId)`'s response (`member_count` field, `002-auth-workspace-foundation/contracts/workspaces-api.md`), plus `localStorage["smart-expense.lastWorkspaceId"]` read/write (depends on T015; `data-model.md` Active workspace context)
- [X] T017 Create `app/[locale]/w/[workspaceId]/layout.tsx`: wraps children in `WorkspaceProvider` (T016), renders a static header/nav shell (workspace name, role-aware links to Dashboard/Incomes/Expenses/Categories/Reports/Settings — no interactive switcher yet, that is US4's addition), and redirects to the workspace list if `GET /workspaces/{id}` 404s (depends on T016; FR-006 partial — full selector added in US4)

**Checkpoint**: Foundation ready — locale routing, auth-aware middleware, API client, and a working (non-interactive) workspace shell all exist; user story implementation can now begin

---

## Phase 3: User Story 1 - Sign in and see the financial picture at a glance (Priority: P1) 🎯 MVP

**Goal**: A user can register/sign in and immediately see their personal workspace's dashboard with the backend's remaining balance, totals, and current period (SC-001).

**Independent Test**: Register a new account, confirm landing on the personal workspace dashboard with `SAR 0.00` totals and a clear empty state; sign out and back in and confirm the same workspace loads; visit a workspace URL directly while signed out and confirm redirect to sign-in (`quickstart.md` Scenario 1).

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T018 [P] [US1] Vitest test in `tests/unit/dashboard-summary.test.tsx`: `SummaryCards` renders `SAR 0.00` figures and an empty-state message when all backend totals are zero, and renders formatted, possibly-negative SAR figures otherwise (FR-010, FR-015)
- [X] T019 [P] [US1] Playwright test in `tests/e2e/auth.spec.ts`: sign-up lands on the personal workspace dashboard; sign-out returns to sign-in; sign-in returns to the same dashboard; a direct unauthenticated visit to `/en/w/{id}/dashboard` redirects to `/en/sign-in` (FR-001, FR-002, FR-003, FR-005; `quickstart.md` Scenario 1)

### Implementation for User Story 1

- [X] T020 [P] [US1] Create `app/[locale]/(auth)/sign-in/page.tsx`: email/password form (`react-hook-form` + `zod`), calls `supabase.auth.signInWithPassword`, redirects to the last-active-or-personal workspace dashboard on success (FR-002)
- [X] T021 [P] [US1] Create `app/[locale]/(auth)/sign-up/page.tsx`: email/password form, calls `supabase.auth.signUp`, redirects to the personal workspace dashboard on success (FR-001)
- [X] T022 [P] [US1] Create `app/[locale]/(auth)/reset-password/page.tsx`: email form, calls `supabase.auth.resetPasswordForEmail` (FR-004)
- [X] T023 [P] [US1] Create `app/[locale]/page.tsx`: root redirect — no session → `/sign-in`; session → read `localStorage["smart-expense.lastWorkspaceId"]`, falling back to the `type: "personal"` entry from `useWorkspaces()` if unset or stale, then redirect to that workspace's dashboard (depends on T014, T015; FR-009, Clarification Session 2026-07-01)
- [X] T024 [P] [US1] Create `lib/api/dashboard.ts`: `getDashboard(workspaceId, recentLimit?)` (depends on T013; `004-backend-financial-dashboard/contracts/dashboard-api.md`)
- [X] T025 [US1] Create `hooks/use-dashboard.ts`: `useDashboard(workspaceId)` TanStack Query hook, query key `["dashboard", workspaceId]` (depends on T024)
- [X] T026 [P] [US1] Create `components/dashboard/SummaryCards.tsx`: total income, total expenses, remaining balance (rendered as-is, including negative), current period, using `lib/money.ts` for SAR-formatted display (FR-010, FR-033)
- [X] T027 [P] [US1] Create `components/dashboard/CategoryBreakdown.tsx` (FR-011)
- [X] T028 [P] [US1] Create `components/dashboard/RecentActivity.tsx` (FR-012, FR-013 — pending-AI count shown without implying AI review is available)
- [X] T029 [P] [US1] Create `components/dashboard/DataState.tsx`: shared empty-state and error/retry-state presentational components reused by dashboard, reports, and both history screens (FR-015, FR-036)
- [X] T030 [US1] Create `app/[locale]/w/[workspaceId]/dashboard/page.tsx` assembling T026-T029 via `useDashboard` (T025), plus quick-action links to `/incomes` and `/expenses` (fully functional once US2 lands directly after — both are P1) (depends on T025-T029; FR-014)
- [X] T031 [US1] Add a sign-out control to the workspace shell header from T017, calling `supabase.auth.signOut()` and redirecting to `/sign-in` (depends on T017, T006; FR-003)
- [X] T032 [US1] Validate User Story 1 per `quickstart.md` Scenario 1 (depends on T018-T031; SC-001)

**Checkpoint**: User Story 1 fully functional and testable independently

---

## Phase 4: User Story 2 - Record income and expenses manually (Priority: P1)

**Goal**: An authorized user can create, edit, and delete income and expense records through forms and a full browsable history, with dashboard totals updating to match (SC-002, SC-003; Clarification Session 2026-07-01 — history list in scope this phase).

**Independent Test**: Add an income and an expense, confirm both change the dashboard totals; edit and delete one and confirm totals update again; open the history list (not just the dashboard's "recent" preview) and find/edit/delete a record from it; confirm Member/Viewer role restrictions hide the actions they cannot perform (`quickstart.md` Scenarios 2, 3).

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T033 [P] [US2] Vitest test in `tests/unit/income-expense-form-validation.test.tsx`: income/expense forms reject a missing or non-positive amount and a missing date with inline errors, and do not call the API (FR-020)
- [X] T034 [P] [US2] Vitest test in `tests/unit/permission-matrix.test.ts`: `lib/permissions.ts`'s helpers match the `data-model.md` permission matrix exactly (Owner/Admin any income or expense; Member only their own expense, never income; Viewer never) (FR-021, FR-037)
- [X] T035 [P] [US2] Playwright test in `tests/e2e/income-expense-flow.spec.ts`: add income, add expense, dashboard totals update within the UI's next render; edit and delete from the history list; totals update again; double-submitting a form does not create a duplicate record (FR-016-FR-023; `quickstart.md` Scenario 2)
- [X] T036 [P] [US2] Playwright test in `tests/e2e/roles.spec.ts`: as Member, create an expense (allowed) but see no edit/delete on an Owner-created expense and no income-creation control anywhere; as Viewer, see no create/edit/delete/archive control anywhere in the workspace (FR-021, FR-037, SC-006; `quickstart.md` Scenario 3)

### Implementation for User Story 2

- [X] T037 [P] [US2] Create `lib/api/incomes.ts`: list/create/get/update/delete (depends on T013; `003-income-expense-category-core/contracts/incomes-api.md`)
- [X] T038 [P] [US2] Create `lib/api/expenses.ts`: list/create/get/update/delete (depends on T013; `003-income-expense-category-core/contracts/expenses-api.md`)
- [X] T039 [P] [US2] Create `lib/api/categories.ts` with `getCategories(workspaceId, { includeArchived })` only (create/rename/archive added in US3) (depends on T013; `003-income-expense-category-core/contracts/categories-api.md`)
- [X] T040 [P] [US2] Create `hooks/use-incomes.ts`: query + create/update/delete mutations invalidating `["incomes", workspaceId]` and `["dashboard", workspaceId]` (depends on T037, T025)
- [X] T041 [P] [US2] Create `hooks/use-expenses.ts`: query + create/update/delete mutations invalidating `["expenses", workspaceId]` and `["dashboard", workspaceId]` (depends on T038, T025)
- [X] T042 [P] [US2] Create `hooks/use-categories.ts`: `useCategories(workspaceId, { includeArchived })` query hook (depends on T039)
- [X] T043 [P] [US2] Create `lib/permissions.ts`: `canManageIncome(role)`, `canCreateExpense(role)`, `canEditOrDeleteExpense(record, role, currentUserId)` implementing the `data-model.md` permission matrix exactly (depends on T016, T006)
- [X] T044 [P] [US2] Create `components/income/IncomeForm.tsx`: amount/date/description (`react-hook-form` + `zod`, `lib/money.ts` for minor-unit conversion), rendered only when `canManageIncome(role)` (depends on T040, T043, T012; FR-016, FR-020, FR-021)
- [X] T045 [P] [US2] Create `components/expense/ExpenseForm.tsx`: amount/date/description/merchant/category (category options from `useCategories(..., { includeArchived: false })`), create control rendered only when `canCreateExpense(role)` (depends on T041, T042, T043, T012; FR-017, FR-020, FR-021)
- [X] T046 [P] [US2] Create `components/income/IncomeHistoryList.tsx`: full list (not just "recent"), ordered by date most recent first, edit/delete controls gated by `canManageIncome(role)`, delete requires an explicit confirm step (depends on T040, T043, T029; FR-018, FR-019, FR-022, FR-023)
- [X] T047 [P] [US2] Create `components/expense/ExpenseHistoryList.tsx`: full list, ordered by date most recent first and visually distinguished from income entries, edit/delete controls gated by `canEditOrDeleteExpense(record, role, currentUserId)`, delete requires an explicit confirm step, resolves and displays a category's name even if it has since been archived (depends on T041, T043, T029; FR-018, FR-019, FR-022, FR-023, FR-027 display rule)
- [X] T048 [US2] Create `app/[locale]/w/[workspaceId]/incomes/page.tsx` assembling `IncomeForm` (T044) and `IncomeHistoryList` (T046) (depends on T044, T046)
- [X] T049 [US2] Create `app/[locale]/w/[workspaceId]/expenses/page.tsx` assembling `ExpenseForm` (T045) and `ExpenseHistoryList` (T047) (depends on T045, T047)
- [X] T050 [US2] Validate User Story 2 per `quickstart.md` Scenarios 2 and 3 (depends on T033-T049; SC-002, SC-003, SC-006)

**Checkpoint**: User Stories 1 AND 2 both work independently — this is the demoable MVP (both are P1)

---

## Phase 5: User Story 3 - Organize expenses with categories (Priority: P2)

**Goal**: Owner/Admin can view the Saudi-first default categories, create custom ones, rename them, and archive them, without disturbing existing expenses' category references (spec User Story 3).

**Independent Test**: Confirm the 15 default categories are listed with no setup step; create a custom category, assign it to an expense, archive it, and confirm it disappears from the expense form's picker while the existing expense still shows its name (`quickstart.md` Scenario 4).

### Tests for User Story 3

- [ ] T051 [P] [US3] Playwright test in `tests/e2e/categories.spec.ts`: default categories listed on a fresh workspace; create, rename, and archive a custom category as Owner; archived category excluded from the expense form's picker but still displayed on an expense already using it; Member/Viewer see no create/rename/archive controls (FR-024-FR-027; `quickstart.md` Scenario 4)

### Implementation for User Story 3

- [ ] T052 [US3] Extend `lib/api/categories.ts` (T039) with `createCategory(workspaceId, name)` and `updateCategory(workspaceId, categoryId, { name?, isArchived? })` (`003-income-expense-category-core/contracts/categories-api.md`)
- [ ] T053 [US3] Extend `hooks/use-categories.ts` (T042) with `useCreateCategory`/`useUpdateCategory` mutations invalidating `["categories", workspaceId]` (depends on T052)
- [ ] T054 [US3] Create `components/category/CategoryList.tsx` and `components/category/CategoryForm.tsx`: full category list (active + archived, archived visually marked), create/rename/archive controls rendered only for Owner/Admin (depends on T053, T043; FR-024-FR-027; User Story 3 Acceptance Scenario 5)
- [ ] T055 [US3] Create `app/[locale]/w/[workspaceId]/categories/page.tsx` assembling T054 (depends on T054)
- [ ] T056 [US3] Validate User Story 3 per `quickstart.md` Scenario 4 (depends on T051-T055)

**Checkpoint**: User Stories 1, 2, AND 3 all work independently

---

## Phase 6: User Story 4 - Work across a personal and a team workspace (Priority: P2)

**Goal**: A user can switch between every workspace they belong to, create a new team workspace, and trust that each workspace's data never mixes with another's (spec User Story 4, SC-007).

**Independent Test**: Create a team workspace from the selector, switch into it, confirm empty/independent totals, add a record, switch back, and confirm the personal workspace is unaffected; sign out and back in and land on the most recently active workspace (`quickstart.md` Scenario 5).

### Tests for User Story 4

- [ ] T057 [P] [US4] Playwright test in `tests/e2e/workspace-switch.spec.ts`: create a team workspace via the selector; switch into it and confirm empty totals; add an expense there; switch back to the personal workspace and confirm its totals are unchanged; sign out and back in and confirm landing on the most recently active workspace (FR-006-FR-009; `quickstart.md` Scenario 5)

### Implementation for User Story 4

- [ ] T058 [US4] Extend `lib/api/workspaces.ts` (T014) with `createWorkspace(name)` (`002-auth-workspace-foundation/contracts/workspaces-api.md`)
- [ ] T059 [US4] Extend `hooks/use-workspaces.ts` (T015) with a `useCreateWorkspace` mutation invalidating `["workspaces"]` (depends on T058)
- [ ] T060 [US4] Create `components/layout/WorkspaceSelector.tsx`: lists every workspace from `useWorkspaces()` labeled personal/team, switches the active workspace (writes `localStorage["smart-expense.lastWorkspaceId"]` and navigates to the selected workspace's dashboard), shows the active team workspace's member count from `useWorkspaceContext()`'s `memberCount` (T016) with a "no team members yet" state when it is 1 (just the caller), and links to the new-workspace flow (depends on T015, T016; FR-006, FR-007, FR-035)
- [ ] T061 [US4] Replace the static header from `app/[locale]/w/[workspaceId]/layout.tsx` (T017/T031) with `WorkspaceSelector` (T060) (depends on T060, T017, T031)
- [ ] T062 [US4] Create `app/[locale]/w/[workspaceId]/new-workspace/page.tsx`: create-team-workspace form using `useCreateWorkspace` (T059), redirecting into the new workspace's dashboard as its Owner on success (depends on T059; FR-008)
- [ ] T063 [US4] Validate User Story 4 per `quickstart.md` Scenario 5 (depends on T057-T062; SC-007)

**Checkpoint**: User Stories 1-4 all work independently

---

## Phase 7: User Story 5 - Review current-period reports (Priority: P3)

**Goal**: A workspace member can view a reports screen showing the current period's income vs. expenses and category breakdown, guaranteed consistent with the dashboard because it reuses the same data (spec User Story 5).

**Independent Test**: Open the reports screen and confirm its figures exactly match the dashboard's for the same workspace and period; confirm a clear empty state for a workspace with no confirmed records (`quickstart.md` Scenario 6).

### Tests for User Story 5

- [ ] T064 [P] [US5] Playwright test in `tests/e2e/reports.spec.ts`: reports screen figures match the dashboard's for the same workspace; empty state shown when there are no confirmed records this period (FR-028, FR-029; `quickstart.md` Scenario 6)

### Implementation for User Story 5

- [ ] T065 [US5] Create `components/reports/ReportSummary.tsx`, reusing `useDashboard(workspaceId)` (T025) — no new API call — to render the same `summary`/`category_breakdown` data as the dashboard (depends on T025, T029; FR-028, FR-029)
- [ ] T066 [US5] Create `app/[locale]/w/[workspaceId]/reports/page.tsx` assembling T065 (depends on T065)
- [ ] T067 [US5] Validate User Story 5 per `quickstart.md` Scenario 6 (depends on T064-T066)

**Checkpoint**: User Stories 1-5 all work independently

---

## Phase 8: User Story 6 - Set language and personal preferences (Priority: P3)

**Goal**: A user can switch the interface language between Arabic and English and see the whole app mirror to RTL/LTR immediately, and see a clear "AI is optional" notice in settings (spec User Story 6).

**Independent Test**: Switch to Arabic and confirm `dir="rtl"` plus translated labels across the dashboard, forms, and nav; switch back to English and confirm full LTR restoration; confirm the AI-optional notice renders cleanly (`quickstart.md` Scenario 7).

### Tests for User Story 6

- [ ] T068 [P] [US6] Playwright test in `tests/e2e/locale-rtl.spec.ts`: switching to Arabic sets `<html dir="rtl">` and renders Arabic labels on the dashboard, income form, and categories screen (not just settings itself); switching back restores `dir="ltr"` and English text; the AI section shows the optional/not-configured notice (FR-030-FR-034; `quickstart.md` Scenario 7)

### Implementation for User Story 6

- [ ] T069 [US6] Expand `messages/en.json` and `messages/ar.json` (T010) with full, non-placeholder translations for every screen built in US1-US5 (dashboard, income/expense forms and history, categories, reports, nav) (FR-032)
- [ ] T070 [P] [US6] Create `components/settings/LanguageSwitcher.tsx`: toggles `en`/`ar`, writes `localStorage["smart-expense.locale"]`, and navigates to the equivalent path under the other locale segment (depends on T009; FR-030, FR-031)
- [ ] T071 [P] [US6] Create `components/settings/AiOptionalNotice.tsx`: static panel stating AI is optional and not yet configured (FR-034)
- [ ] T072 [US6] Create `app/[locale]/w/[workspaceId]/settings/page.tsx` assembling `LanguageSwitcher` (T070), `AiOptionalNotice` (T071), and basic workspace info from `useWorkspaceContext()` (T016) — for a team workspace, includes the member count and its "no team members yet" state (depends on T070, T071, T016; FR-030, FR-035)
- [ ] T073 [US6] Validate User Story 6 per `quickstart.md` Scenario 7 (depends on T068-T072; SC-005)

**Checkpoint**: All six user stories independently functional

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story validation and documentation

- [ ] T074 [P] Vitest test in `tests/unit/money.test.ts`: `parseInputToMinor`/`toDisplayAmount` round-trip correctly for whole and fractional SAR amounts with no floating-point drift (Constitution X)
- [ ] T075 [P] Playwright test in `tests/e2e/error-states.spec.ts`: an expense-exceeds-income workspace shows a clearly negative remaining balance on both dashboard and reports; stopping the backend and reloading the dashboard shows a retry control that recovers once the backend is back (FR-036; `quickstart.md` Scenario 8)
- [ ] T076 [P] Update `apps/web/README.md` describing the new app structure, required env vars, and how to run `npm run dev`, Vitest, and Playwright
- [ ] T077 [P] Update `docs/setup.md`'s frontend section to mention the new `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars and the new test suites
- [ ] T078 Run the full `quickstart.md` (Scenarios 1-8) end-to-end against a fresh local stack as final cross-story validation
- [ ] T079 Update `specs/005-frontend-core-experience/spec.md` Status field from `Draft` to `Implemented` once T001-T078 are verified complete (closes out FR-001-FR-037, SC-001-SC-007)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 (P1) → US2 (P1): both are P1 and form the demoable MVP together — US1's dashboard quick-actions only fully work once US2's routes exist, so implement them back-to-back
  - US3 (P2), US4 (P2): independent of each other and of US1/US2 beyond the shared Foundational shell; ordered after the P1 pair to match priority
  - US5 (P3): depends only on US1's `useDashboard` hook (Foundational-adjacent, created in US1) — no dependency on US2/US3/US4
  - US6 (P3): touches every screen's message catalog, so it is ordered last even though its own components are small
- **Polish (Phase 9)**: Depends on all six user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational; its history-list screens are new routes, but its dashboard-totals payoff is only visible once US1 exists — implement directly after US1
- **User Story 3 (P2)**: Can start after Foundational; extends the `lib/api/categories.ts`/`hooks/use-categories.ts` files US2 created (basic list) with create/rename/archive
- **User Story 4 (P2)**: Can start after Foundational; extends the `lib/api/workspaces.ts`/`hooks/use-workspaces.ts` files Foundational created and replaces the static header US1 added a sign-out control to
- **User Story 5 (P3)**: Can start after US1 (reuses its `useDashboard` hook directly — no new API surface)
- **User Story 6 (P3)**: Can start after Foundational for its own components, but its full-catalog task (T069) is only meaningful once US1-US5's screens exist to translate

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- API client functions before hooks; hooks before components; components before the page that assembles them
- Story complete before moving to the next priority

### Parallel Opportunities

- T003, T004, T005 (Setup, different files) can run in parallel once T001/T002 land
- T006, T007, T009, T010, T012, T013, T014, T015 (Foundational, different files) can run in parallel; T008 depends on T006+T007, T011 depends on T009+T010, T016 depends on T015, T017 depends on T016
- T018, T019 (US1 tests, different files) can run in parallel; T020-T024 (different files) can run in parallel; T026-T029 (different components) can run in parallel once T025 exists
- T033-T036 (US2 tests, different files) can run in parallel; T037, T038, T039 (different API files) can run in parallel; T040, T041, T042, T043 (different files) can run in parallel once their respective API files exist; T044-T047 (different components) can run in parallel once T040-T043 exist
- T051 (US3) has no sibling test to parallelize with
- T057 (US4) has no sibling test to parallelize with
- T064 (US5) has no sibling test to parallelize with
- T068 (US6) has no sibling test to parallelize with; T070, T071 (different files) can run in parallel
- T074, T075, T076, T077 (Polish, different files) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch both User Story 1 tests together:
Task: "Vitest test for SummaryCards empty/populated states in tests/unit/dashboard-summary.test.tsx"
Task: "Playwright test for sign-up/sign-in/sign-out/redirect flow in tests/e2e/auth.spec.ts"

# Launch the three auth pages and the dashboard API client together (different files):
Task: "Create app/[locale]/(auth)/sign-in/page.tsx"
Task: "Create app/[locale]/(auth)/sign-up/page.tsx"
Task: "Create app/[locale]/(auth)/reset-password/page.tsx"
Task: "Create lib/api/dashboard.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. **STOP and VALIDATE**: sign in, add income/expense, watch totals update, edit/delete from history — this alone proves the app is useful without AI (Constitution V) and that the backend's totals are the ones rendered (Constitution IX/X)
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → shell, auth guard, and API client ready
2. Add User Story 1 → validate independently → sign-in and dashboard proven
3. Add User Story 2 → validate independently → MVP: manual income/expense tracking proven end-to-end
4. Add User Story 3 → validate independently → category management proven
5. Add User Story 4 → validate independently → multi-workspace isolation proven
6. Add User Story 5 → validate independently → reports-matches-dashboard proven
7. Add User Story 6 → validate independently → Arabic/English/RTL readiness proven
8. Polish → docs updated, full quickstart re-run

### Parallel Team Strategy

With multiple contributors:

1. Complete Setup + Foundational together (single contributor recommended — `middleware.ts` and the locale layout are shared, easy to conflict on)
2. Once Foundational is done:
   - Contributor A: User Story 1, then User Story 5 (shares `useDashboard`)
   - Contributor B: User Story 2, then User Story 3 (shares `lib/api/categories.ts`)
   - Contributor C: User Story 4
3. Whoever finishes first takes User Story 6 (touches every other story's screens) and Polish

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] label maps each task to its user story for traceability
- No new backend endpoint, table, or migration exists anywhere in this task list — every `lib/api/*` function targets an endpoint already implemented and tested in Phases 2-4
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
