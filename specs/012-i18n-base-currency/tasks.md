---

description: "Task list for Phase 12 — Internationalization and Workspace Currency"
---

# Tasks: Internationalization and Workspace Currency

**Input**: Design documents from `/specs/012-i18n-base-currency/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included. The constitution's Testing Requirements principle (XIV) mandates coverage for
this phase's risk areas (locale persistence/precedence, workspace-currency locking/authorization,
currency-aware formatting, and non-regression of financial accuracy and AR/EN/RTL behavior), and
every prior phase (006–010) in this project included test tasks as a matter of course.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to US1–US4 from spec.md
- File paths are exact and repo-relative

## Path Conventions

Existing web-application monolith: `apps/api/app/**` (FastAPI backend), `apps/api/tests/**`
(pytest), `apps/web/**` (Next.js frontend), `supabase/migrations/**` (tracked SQL). No new
top-level directories are introduced.

---

## Phase 1: Setup

**Purpose**: Confirm the local environment matches the tracked schema baseline before adding new
schema, so the new migration applies cleanly and its assumptions about existing constraints hold.

- [X] T001 Reconcile any local Supabase migration drift against the tracked history (per the
      known Phase 8 stray-DB-state note: local `psql`-applied changes are not always reflected in
      `supabase migration up`) so the local stack's applied schema exactly matches
      `supabase/migrations/20260708000000_reports_history.sql` before this phase's migration is
      written.
- [X] T002 [P] Determine the exact current constraint names on `public.incomes.currency` and
      `public.expenses.currency` (e.g. `\d public.incomes`, `\d public.expenses`, or query
      `information_schema.table_constraints`) so the new migration's drop/replace statements in
      `contracts/schema-migration.md` use the real names instead of a guess.

**Checkpoint**: Local schema state is known and confirmed before Phase 2 begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and shared type definitions that every user story in this phase depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Write migration `supabase/migrations/20260720000000_i18n_locale_workspace_currency.sql`
      implementing, per `contracts/schema-migration.md` and `data-model.md`: the
      `public.supported_currencies` reference table + 10 seed rows (`SAR` default, `KWD`/`BHD`/`OMR`
      at 3 minor-unit digits, the rest at 2); the `public.user_profiles.locale` column
      (`default 'en' check (locale in ('en','ar'))`); the `public.workspaces.currency` column
      (`default 'SAR' references public.supported_currencies(code)`); replacement of the
      `incomes`/`expenses` `check (currency = 'SAR')` constraints (using the names found in T002)
      with an FK reference to `supported_currencies`; the
      `enforce_record_currency_matches_workspace()` function + `BEFORE INSERT OR UPDATE` triggers on
      `incomes` and `expenses`; and the `enforce_workspace_currency_lock()` function + `BEFORE
      UPDATE OF currency` trigger on `workspaces`. (FR-001, FR-006, FR-007, FR-009, FR-010, FR-011, FR-016)
- [X] T004 Apply the migration locally (`supabase migration up`) and verify: every pre-existing
      workspace now reads `currency = 'SAR'`, every pre-existing user reads `locale = 'en'`, and
      every pre-existing `incomes`/`expenses` row still passes its (new) currency constraint with
      zero errors and no backfill statement needed (`data-model.md` Non-destructiveness check).
      (FR-005, SC-002)
- [X] T005 [P] Create `apps/api/app/schemas/currency.py`: `SupportedCurrency = Literal["SAR",
      "USD", "EUR", "GBP", "AED", "EGP", "KWD", "QAR", "BHD", "OMR"]` and a
      `MINOR_UNIT_DIGITS: dict[str, int]` mapping (2 for most, 3 for `KWD`/`BHD`/`OMR`) — the single
      backend source of truth referenced by every schema/service in later phases
      (`research.md` §4). (FR-007, FR-017)
- [X] T006 [P] Create `apps/web/lib/currency.ts`: `SupportedCurrency` union (the same 10 codes) and
      a `minorUnitDigits: Record<SupportedCurrency, number>` map — the single frontend source of
      truth referenced by `lib/money.ts` and every component that renders or edits an amount
      (`research.md` §5). (FR-007, FR-012, FR-017)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Language preference follows the user (Priority: P1) 🎯 MVP

**Goal**: A user's selected interface language is stored against their account and applied on
sign-in from any device/browser, not just carried by a session cookie.

**Independent Test**: Sign in, set language to Arabic, clear cookies (or use a different
browser/session), sign back in, and confirm the interface opens in Arabic without re-selecting it
(quickstart.md §1).

### Tests for User Story 1

- [X] T007 [P] [US1] Backend test in `apps/api/tests/test_users_locale.py`: `GET /me` returns the
      caller's own `locale`; `PATCH /me` persists a new locale and is reflected on a subsequent
      `GET /me` (simulating a new session); an invalid `locale` value → `422`; unauthenticated → `401`.
      (FR-001, FR-003, FR-004)
- [X] T008 [P] [US1] Frontend e2e test in `apps/web/e2e/locale-preference-persistence.spec.ts`: set
      language to Arabic in Settings, clear all cookies, sign back in, and assert the interface
      opens in Arabic/RTL without the user re-selecting it; repeat for switching back to English.
      (FR-001, FR-002, FR-003, SC-001)

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `apps/api/app/schemas/users.py`: `UserProfile` (`id`, `email`,
      `display_name`, `locale`) and `LocaleUpdateRequest` (`locale: Literal["en", "ar"]`). (FR-001, FR-004)
- [X] T010 [US1] Create `apps/api/app/routes/users.py`: `GET /me` and `PATCH /me`, self-scoped to
      `current_user.user_id` with no workspace/role check, using the schemas from T009. (depends on
      T009) (FR-001, FR-003)
- [X] T011 [US1] Register the new router in `apps/api/app/main.py`
      (`app.include_router(users_router)`). (depends on T010) (FR-001)
- [X] T012 [P] [US1] Create `apps/web/lib/api/me.ts`: `getMe()` / `updateLocale(locale)` client
      functions following the existing `lib/api/*.ts` fetch-wrapper pattern. (FR-001, FR-003)
- [X] T013 [P] [US1] Create `apps/web/hooks/use-me.ts`: a react-query hook wrapping `getMe()`,
      following the existing hook pattern (e.g. `use-reports.ts`). (depends on T012) (FR-002)
- [X] T014 [US1] Extend the post-authentication flow (wherever the app redirects after a successful
      sign-in) to call `GET /me` once and, if no `NEXT_LOCALE` cookie is present yet and the
      returned `locale` differs from the current locale segment, redirect to the equivalent path
      under the preferred locale (`research.md` §2). (depends on T012) (FR-002, FR-005, SC-001)
- [X] T015 [US1] Extend `apps/web/components/settings/LanguageSwitcher.tsx` to call
      `updateLocale()` (via T012) alongside its existing path-swap navigation, so an explicit
      switch also updates the stored account preference. (depends on T012) (FR-003)
- [X] T016 [P] [US1] Add any new en/ar strings this story introduces (e.g. a `/me` error message)
      to `apps/web/messages/en.json` and `apps/web/messages/ar.json`. (FR-004)

**Checkpoint**: User Story 1 is independently functional and testable — language preference now
survives across sessions/devices.

---

## Phase 4: User Story 2 - Workspace Owner sets the workspace's base currency (Priority: P1)

**Goal**: A workspace has exactly one base currency, defaulting to SAR, changeable only by the
Owner and only before the workspace has any income/expense record.

**Independent Test**: As Owner, change a brand-new workspace's currency, add an income and expense,
confirm both use the new currency; confirm a non-Owner cannot change it; confirm the currency locks
once a record exists (quickstart.md §2).

### Tests for User Story 2

- [X] T017 [P] [US2] Backend test in `apps/api/tests/test_workspace_currency.py`: Owner changes
      currency on a zero-record workspace → `200`; Owner attempts change after a record exists
      (including a soft-deleted one) → `409 currency_locked`; Admin/Member/Viewer attempt → `403`;
      unsupported currency code → `422`. (FR-006, FR-007, FR-008, FR-009, SC-002, SC-003)
- [X] T018 [P] [US2] Backend test in
      `apps/api/tests/test_income_expense_currency_matches_workspace.py`: a direct database insert
      attempt (bypassing the service layer) with a currency different from the workspace's current
      currency is rejected by the `enforce_record_currency_matches_workspace` trigger from T003.
      (FR-010, FR-011)

### Implementation for User Story 2

- [X] T019 [US2] Extend `apps/api/app/schemas/workspaces.py`: `Workspace`,
      `WorkspaceUpdateRequest`, and `WorkspaceSettingsResponse` gain an optional
      `currency: SupportedCurrency` field (import `SupportedCurrency` from T005's
      `app/schemas/currency.py`). (depends on T005) (FR-006, FR-007)
- [X] T020 [US2] Extend `update_workspace` in `apps/api/app/routes/workspaces.py`
      (currently lines 124-174) to accept `currency`, pre-check the lock (existence query against
      `incomes`/`expenses` for the workspace) before issuing the update and return
      `409 {"code": "currency_locked", ...}` on conflict, per
      `contracts/workspace-currency-api.md`. (depends on T019) (FR-008, FR-009)
- [X] T021 [US2] Update the income/expense create paths in `apps/api/app/services/incomes.py` and
      `apps/api/app/services/expenses.py` to read `currency` from the owning workspace's `currency`
      column instead of defaulting the literal `"SAR"`. (depends on T005) (FR-010)
- [X] T022 [P] [US2] Create `apps/web/components/settings/WorkspaceCurrencySelector.tsx`: an
      Owner-only `<Select>` mirroring `LanguageSwitcher.tsx`'s structure/accessibility, showing a
      locked/disabled state with an explanatory message once the workspace has any income/expense
      record. (depends on T006) (FR-008, FR-009)
- [X] T023 [US2] Extend `apps/web/lib/api/workspaces.ts`: the `Workspace` type gains `currency`, and
      the update call accepts it. (depends on T006) (FR-006)
- [X] T024 [US2] Wire `WorkspaceCurrencySelector` into the workspace Settings page alongside the
      existing `LanguageSwitcher` and auto-delete toggle. (depends on T022, T023) (FR-006)
- [X] T025 [P] [US2] Add en/ar strings for the currency selector and the "currency locked" message
      to `apps/web/messages/en.json` / `ar.json`. (FR-009)

**Checkpoint**: User Stories 1 and 2 both work independently — durable language preference and a
lockable workspace base currency both exist end-to-end.

---

## Phase 5: User Story 3 - Money, numbers, and dates format consistently everywhere (Priority: P2)

**Goal**: Every financial surface (dashboard, records, reports, AI review, history) displays money
using the workspace's actual currency and formats numbers/dates per the active language.

**Independent Test**: In a non-SAR workspace, view all five surfaces in both languages and confirm
currency-correct formatting everywhere, including 3-decimal currencies (quickstart.md §3).

### Tests for User Story 3

- [X] T026 [P] [US3] Frontend unit test in `apps/web/tests/unit/money-formatting.test.ts`:
      `toDisplayAmount`/`parseInputToMinor` produce correct output for all 10 supported currencies,
      including the 3-decimal-digit cases (`KWD`, `BHD`, `OMR`) and both locales. (FR-012, FR-013)
- [X] T027 [P] [US3] Backend test in `apps/api/tests/test_reports_currency_awareness.py`: dashboard,
      reports, and history responses report the workspace's actual configured currency (not a
      hard-coded `SAR` default); re-run of the existing financial-accuracy edge states (zero
      income, zero expenses, negative remaining balance, edited record, deleted record, pending AI
      draft, failed AI extraction, multiple workspaces, viewer restriction) against a non-SAR
      workspace fixture, asserting outcomes are unchanged. (FR-015, FR-018, SC-006)
- [X] T028 [P] [US3] Frontend e2e test in
      `apps/web/e2e/workspace-currency-formatting.spec.ts`: dashboard, records, reports, AI
      extraction review, and history all show the workspace's configured currency correctly in
      both English and Arabic (quickstart.md §3). (FR-012, FR-013, SC-004)

### Implementation for User Story 3

- [X] T029 [US3] Update `apps/api/app/schemas/dashboard.py`, `apps/api/app/schemas/expenses.py`,
      `apps/api/app/schemas/incomes.py`, and `apps/api/app/schemas/reports.py`: replace
      `Currency = Literal["SAR"]` / loose `str` currency fields with the `SupportedCurrency` type
      from T005, removing the single-value `"SAR"` field defaults. (depends on T005) (FR-017)
- [X] T030 [US3] Update `apps/api/app/services/dashboard.py` and `apps/api/app/services/reports.py`
      so every response's `currency` field is derived from the owning workspace's `currency` column
      instead of a literal default. (depends on T029) (FR-015)
- [X] T031 [US3] Update `apps/web/lib/money.ts`: `toDisplayAmount(minor, locale, currency)` and
      `parseInputToMinor(input, currency)`, parameterized using T006's `minorUnitDigits` map instead
      of the hard-coded `SAR_FRACTION_DIGITS` / `MINOR_UNITS_PER_SAR` constants. (depends on T006)
      (FR-012, FR-013, FR-014)
- [X] T032 [P] [US3] Update `apps/web/lib/api/dashboard.ts`, `apps/web/lib/api/expenses.ts`,
      `apps/web/lib/api/incomes.ts`, and `apps/web/lib/api/reports.ts`: replace the hard-coded
      `"SAR"` literal currency type with `SupportedCurrency` from T006. (depends on T006) (FR-017)
- [X] T033 [US3] Update every component call site currently calling `toDisplayAmount(minor,
      locale)` across the dashboard, records, reports, AI review, and history surfaces to also pass
      the relevant `currency` value from the API response. (depends on T031, T032) (FR-012, SC-004)

**Checkpoint**: All three of US1–US3 work independently and together — the phase's core new
capability (language persistence + workspace currency) is now visibly and correctly reflected
everywhere money is shown.

---

## Phase 6: User Story 4 - RTL/LTR layout correctness is protected (Priority: P3)

**Goal**: Confirm the pre-existing Arabic RTL / English LTR behavior has zero regression from this
phase's changes.

**Independent Test**: Re-run the existing localization/RTL automated suite and the manual
verification checklist after this phase's changes land, including at least one non-SAR workspace
case (quickstart.md §4).

### Implementation for User Story 4

- [ ] T034 [P] [US4] Re-run `apps/web/tests/unit/localization-rtl.test.tsx`,
      `apps/web/tests/e2e/locale-rtl.spec.ts`, and `apps/web/e2e/acc-localization-rtl.spec.ts`;
      extend them with at least one non-SAR-currency case each; confirm no regression in existing
      assertions. (FR-004, FR-019, SC-005)
- [ ] T035 [US4] Re-walk
      `specs/010-testing-security-deployment/manual-ar-en-rtl-checklist.md` against a workspace
      configured with a non-SAR currency and record the result (append a dated re-verification
      note rather than editing the original Phase 10 rows). (FR-019, SC-005)

**Checkpoint**: All four user stories are independently functional; no AR/EN/RTL regression.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cross-reference cleanup spanning all stories.

- [ ] T036 [P] Run the full `quickstart.md` validation guide end-to-end and record the outcome of
      each of its five sections. (FR-020, SC-001–SC-006)
- [ ] T037 [P] Update the SAR-only scope note in `specs/009-reports-summaries-history/spec.md`
      (FR-034) and its `plan.md` Constitution Check row to cross-reference that Phase 12
      (`specs/012-i18n-base-currency`) supersedes SAR-only reporting with
      workspace-currency-aware reporting — documentation cross-reference only, no behavior change.
- [ ] T038 Run the full regression pass: `cd apps/api && pytest`; `cd apps/web && npm run test &&
      npm run test:e2e`. (FR-020, FR-018, FR-019)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001–T002 inform T003) — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational (Phase 2) completion.
  - US1 and US2 are both P1 and mutually independent — can proceed in parallel.
  - US3 depends on US1's locale plumbing being irrelevant to it but **does** depend on US2's
    `workspaces.currency` column and T005/T006 (Foundational) for the `SupportedCurrency` type — so
    US3 should start after US2's schema tasks (T019) land, even though it is a separate story.
  - US4 depends on US1–US3 being substantially complete (it is a regression check over their
    combined effect).
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependency on US2/US3/US4.
- **US2 (P1)**: Can start after Foundational — no dependency on US1; US3 depends on US2's schema
  work (T019), not the reverse.
- **US3 (P2)**: Depends on Foundational (T005, T006) and on US2's `workspaces.currency` column
  (T003/T019) to have real per-workspace currency data to format.
- **US4 (P3)**: Depends on US1–US3 being in place (it verifies their combined non-regression).

### Parallel Opportunities

- T001/T002 (Setup) in parallel.
- T005/T006 (Foundational shared types) in parallel with each other, after T003/T004.
- Within US1: T007/T008 (tests) in parallel; T009/T012/T013/T016 in parallel; T014/T015 depend on
  T012.
- Within US2: T017/T018 (tests) in parallel; T022 in parallel with T019–T021.
- Within US3: T026/T027/T028 (tests) in parallel; T032 in parallel with T029–T031.
- US1 and US2 implementation work can proceed in parallel (different files, no shared state).

---

## Parallel Example: Foundational Phase

```bash
# After T003 (migration) and T004 (apply+verify) land:
Task: "Create apps/api/app/schemas/currency.py with SupportedCurrency + MINOR_UNIT_DIGITS"
Task: "Create apps/web/lib/currency.ts with SupportedCurrency + minorUnitDigits"
```

## Parallel Example: User Story 1

```bash
Task: "Backend test in apps/api/tests/test_users_locale.py"
Task: "Frontend e2e test in apps/web/e2e/locale-preference-persistence.spec.ts"
Task: "Create apps/api/app/schemas/users.py"
Task: "Create apps/web/lib/api/me.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational — CRITICAL, blocks everything).
2. Complete Phase 3 (US1) and Phase 4 (US2), in parallel if staffed.
3. **STOP and VALIDATE**: durable language persistence and a lockable workspace currency both work
   independently (quickstart.md §1–2), even before formatting (US3) is updated everywhere.

### Incremental Delivery

1. Setup + Foundational → schema and shared types ready.
2. US1 → language preference durably persists (independently testable/demoable).
3. US2 → workspace currency exists, is owner-gated, and locks correctly (independently
   testable/demoable).
4. US3 → every financial surface reflects the new currency/locale correctly (the phase's visible
   payoff).
5. US4 → regression-proves nothing broke in the existing AR/EN/RTL experience.
6. Polish → full quickstart + cross-reference cleanup + full regression pass.

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task.
- Every task lists an exact file path; none are vague.
- Commit after each task or logical group, per repository convention from prior phases.
- No task in this phase modifies `apps/web/i18n/routing.ts`, the locale-prefixed route tree, or
  `LocaleDirectionSync` — those are treated as a stable, unmodified dependency (research.md §8).
