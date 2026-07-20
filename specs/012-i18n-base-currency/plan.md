# Implementation Plan: Internationalization and Workspace Currency

**Branch**: `012-i18n-base-currency` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-i18n-base-currency/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Close the two remaining gaps against the Phase 12 exit criteria in
`docs/implementation-plan.md`. Arabic/English, RTL/LTR, and the language
switcher already ship (via `next-intl`); this phase does **not** rebuild that
infrastructure. It (1) adds durable per-user language-preference storage
(`user_profiles.locale` + a new minimal `GET/PATCH /me`) so a user's chosen
language follows them across devices instead of living only in a `NEXT_LOCALE`
cookie, and (2) introduces exactly one base currency per workspace
(`workspaces.currency`, defaulting to and remaining SAR unless the Owner
changes it before any record exists), replacing the hard-coded `SAR`-only
`CHECK` constraints, `Literal["SAR"]` backend schemas, hard-coded `"SAR"`
frontend API types, and the hard-coded `SAR_FRACTION_DIGITS`/
`MINOR_UNITS_PER_SAR` constants in `apps/web/lib/money.ts` with
currency-aware equivalents. No exchange-rate conversion or mixed-currency
accounting is introduced (constitution Principle III); a workspace's currency
locks permanently the moment it has its first income or expense row.

## Technical Context

**Language/Version**: Python 3.12 for `apps/api` (extended this phase); SQL
(Postgres 15, Supabase-managed) for one new tracked migration under
`supabase/migrations/`; TypeScript 5.7 on Next.js 16.x (App Router) / React
for `apps/web` (extended this phase). This phase touches `apps/api`,
`apps/web`, and `supabase/`.

**Primary Dependencies**: No new dependency in either app. Backend: FastAPI,
SQLAlchemy async engine + `asyncpg`, Pydantic v2 — all already in
`apps/api/requirements.txt`. Frontend: already-present `next-intl` (locale
routing/messages, untouched), `@supabase/supabase-js` + `@supabase/ssr`
(auth/session, extended to call the new `/me` endpoint once per sign-in),
`@tanstack/react-query` (a `use-me` hook follows the existing hook pattern),
`shadcn/ui` + Tailwind (a currency `<Select>` on the Settings page, matching
the existing `LanguageSwitcher` styling).

**Storage**: Supabase Postgres. One new migration,
`20260720000000_i18n_locale_workspace_currency.sql`: new
`public.supported_currencies` reference table (10 seed rows, SAR default);
new `user_profiles.locale` column; new `workspaces.currency` column (FK to
`supported_currencies`); replace the `incomes`/`expenses`
`check (currency = 'SAR')` constraints with FK references to
`supported_currencies` plus a same-workspace-currency trigger; a
currency-lock trigger on `workspaces`. Full detail in `data-model.md` and
`contracts/schema-migration.md`. No Supabase Vault or Storage changes.

**Testing**: `pytest` + `pytest-asyncio` + `httpx` (ASGI transport) for
route-level backend tests against real local-Auth test users (Phases 2–10
pattern), covering locale persistence/precedence and workspace-currency
selection/locking/authorization. Frontend: Vitest + React Testing Library for
the extended `money.ts` formatting logic and the currency selector component;
Playwright for the cross-session locale-persistence flow and a
currency-aware formatting e2e pass across dashboard/records/reports/AI-
review/history. The existing AR/EN/RTL automated suites
(`apps/web/tests/unit/localization-rtl.test.tsx`,
`apps/web/tests/e2e/locale-rtl.spec.ts`,
`apps/web/e2e/acc-localization-rtl.spec.ts`) are re-run unmodified as a
regression gate, extended only with non-SAR-currency cases.

**Target Platform**: Local development via Supabase CLI (Docker stack);
hosted Supabase for staging/production; `apps/web` in the browser (desktop +
mobile web). Unchanged deployment posture (Bunny Magic Containers, Phase 10).

**Project Type**: Web application (existing `apps/api` + `apps/web` monolith
repository).

**Performance Goals**: No raw throughput/latency SLA. The one deliberate
performance constraint is negative: `apps/web/middleware.ts` (which runs on
every matched request) gets **zero** new database calls — the stored-locale
lookup happens only once, right after sign-in (research.md §2), not per
request. Currency-lock and currency-match checks are single-row
existence/lookup queries on already-indexed `workspace_id` columns.

**Constraints**:
- **No mixed currency, no conversion (constitution III, NON-NEGOTIABLE for
  this phase):** a workspace has exactly one currency at all times; a record's
  currency must equal its workspace's currency, enforced by a database
  trigger, not application code alone (FR-010, FR-011).
- **Currency lock (FR-009):** Owner may change currency only while the
  workspace has zero rows (including soft-deleted) in `incomes`/`expenses`;
  enforced by a `BEFORE UPDATE OF currency` trigger, re-checked in the
  application layer to return a specific `409 currency_locked` rather than a
  raw database error.
- **Owner-only currency changes (FR-008):** identical role check to the
  existing `auto_delete_after_extraction` PATCH
  (`apps/api/app/routes/workspaces.py:124-174`).
- **Non-regression on SAR (SC-002, SC-005):** every pre-existing workspace
  defaults to `currency = 'SAR'`; every pre-existing record already has
  `currency = 'SAR'`; no backfill statement is needed and no existing
  formatting output may change for a workspace that stays on SAR.
- **Locale precedence (FR-002, FR-003):** an explicit in-session locale
  choice (path segment / `NEXT_LOCALE` cookie) always wins over the stored
  preference for that session; the stored preference only decides the
  starting locale when no explicit in-session choice exists yet (i.e. right
  after a fresh sign-in).
- **Financial accuracy unaffected (constitution IX, X):** money remains
  integer minor units regardless of currency; `minor_unit_digits` (2, or 3 for
  KWD/BHD/OMR) only affects display formatting and text-input parsing, never
  the stored integer value or backend totals math.
- **RTL/LTR non-regression (FR-019):** no change to `apps/web/i18n/routing.ts`,
  the locale-prefixed route tree, or `LocaleDirectionSync`; existing AR/EN/RTL
  suites must keep passing unmodified in expectation, extended only with
  currency-aware cases.

**Scale/Scope**: 1 new migration (1 new table + 2 new columns + 2 new trigger
functions/4 triggers); 1 new backend router+schema (`users.py`, `GET`/`PATCH
/me`); 1 extended backend router (`workspaces.py` — `currency` added to the
existing PATCH); 4 backend schema files updated from `Literal["SAR"]`/`str`
defaults to a 10-value currency literal derived from the workspace row
(`dashboard.py`, `expenses.py`, `incomes.py`, `reports.py`); 1 extended
frontend utility (`lib/money.ts`, currency + digit-count parameterization); ~6
frontend API-client files updated from the `"SAR"` literal to the shared
currency union type; 1 new Settings UI control (workspace currency selector,
mirroring the existing `LanguageSwitcher`); `LanguageSwitcher.tsx` extended to
call `PATCH /me`; sign-in flow extended to call `GET /me` once. No new page
routes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Core Product Principle | PASS | Interface language and workspace currency are presentation/settings concerns within the existing expense-tracking surface; no new product domain added. |
| II. Budgeting Philosophy | PASS | Remaining balance formula (income − expenses) is untouched; currency changes only the unit label/formatting, never the arithmetic. |
| III. MVP Scope Discipline | PASS | Explicitly implements the MVP's stated "readiness for later English localization and LTR switching" and stays within the constitution's express exclusion of mixed-currency records and exchange-rate conversion — a workspace has exactly one currency, permanently, from its first record onward. |
| IV. Saudi-First Default | PASS | SAR remains the default for every new and pre-existing workspace; Arabic remains a first-class, fully supported language; this phase only makes English/other-currency choices durable rather than removing any Saudi-first default. |
| V. Manual-First, AI-Optional | PASS | No AI behavior changes; AI extraction review simply displays/confirms amounts in whatever currency the workspace is configured for (see Edge Cases in spec.md). |
| VI. Privacy and Security | PASS | No new secret material; `GET/PATCH /me` only ever returns the caller's own profile (`current_user.user_id`), never another user's. |
| VII. Multi-Tenant Isolation | PASS | Currency is a `workspaces`-row setting, gated by the existing membership/role lookup; `/me` is account-scoped to the authenticated caller only, not workspace data. |
| VIII. Storage and File Retention | PASS | Not touched by this phase. |
| IX. Architecture Authority | PASS | Currency-lock and record/workspace-currency-match invariants are enforced by database triggers (justified below, mirrors the Phase 9 `activity_history` trigger precedent) plus a backend pre-check for a friendlier error code; the frontend performs no authorization or financial calculation. |
| X. Financial Accuracy (NON-NEGOTIABLE) | PASS | Money stays integer minor units; currency choice never introduces floating-point arithmetic; existing financial-accuracy edge-state tests are re-run against a non-SAR workspace fixture as part of this phase (FR-020, SC-006). |
| XI. Reports Integrity | PASS | Reports remain confirmed-only; only the currency label/formatting changes, sourced from the workspace's single configured currency (supersedes the SAR-only note in `specs/009-reports-summaries-history`, as flagged in that spec's own scope note and in spec.md's Assumptions). |
| XII. History Tracking | PASS | Not touched by this phase; a currency change is a `workspaces` row update, already covered by the Phase 9 `workspaces` activity trigger (the same column-update shape as the existing auto-delete-setting change). |
| XIII. Free Product and Optional Support | PASS | No billing/payment surface touched. |
| XIV. Testing Requirements | PASS | Plan mandates locale-persistence/precedence tests, workspace-currency selection/lock/authorization tests, currency-aware formatting tests across all financial surfaces, and re-running the full existing financial-accuracy and AR/EN/RTL suites against a non-SAR fixture. |
| XV / XVI. Scope Control / Spec-Kit | PASS | Focused spec+plan for this feature only; explicitly excludes exchange-rate conversion, mixed-currency accounting, and a third interface language; sequenced after Phase 11, before Phase 13. |

No violations. Complexity Tracking table is intentionally empty; the one
piece of added complexity (two new Postgres trigger functions) is justified
below and in `research.md` §3 by the project's existing precedent of using
triggers for cross-row invariants that a plain `CHECK` constraint cannot
express (Phase 9's `activity_history` triggers, Phase 8's
`confirm_ai_extraction`).

## Project Structure

### Documentation (this feature)

```text
specs/012-i18n-base-currency/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── schema-migration.md       # supported_currencies table + user_profiles/workspaces columns + triggers
│   ├── user-preferences-api.md   # GET/PATCH /me
│   └── workspace-currency-api.md # PATCH /workspaces/{id} currency extension
├── checklists/
│   └── requirements.md   # Spec quality checklist (/speckit-specify output)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── routes/
│   │   ├── users.py                  # NEW: GET /me, PATCH /me (locale only, self-scoped)
│   │   └── workspaces.py             # EDIT: WorkspaceUpdateRequest/Response gain optional `currency`;
│   │                                  #   update_workspace pre-checks the currency lock -> 409 currency_locked
│   ├── services/
│   │   ├── incomes.py                 # EDIT: currency on create is read from the workspace row, not a literal default
│   │   ├── expenses.py                # EDIT: same as incomes.py
│   │   └── dashboard.py / reports.py  # EDIT: currency in every response is read from the workspace row
│   └── schemas/
│       ├── currency.py                # NEW: SupportedCurrency = Literal["SAR","USD","EUR","GBP","AED","EGP",
│       │                                #   "KWD","QAR","BHD","OMR"] + MINOR_UNIT_DIGITS map — single backend
│       │                                #   source of truth imported by every schema file below
│       ├── users.py                   # NEW: UserProfile (id, email, display_name, locale), LocaleUpdateRequest
│       ├── workspaces.py              # EDIT: Workspace/WorkspaceUpdateRequest/WorkspaceSettingsResponse gain
│       │                                #   `currency: SupportedCurrency` (imported from currency.py)
│       ├── dashboard.py               # EDIT: Currency = SupportedCurrency (imported from currency.py), no more
│       │                                #   single-value "SAR" literal/default
│       ├── expenses.py                 # EDIT: same Currency = SupportedCurrency import, no more single-value default
│       ├── incomes.py                  # EDIT: same Currency = SupportedCurrency import
│       └── reports.py                  # EDIT: currency fields typed against SupportedCurrency
│   └── main.py                        # EDIT: include_router(users_router)
└── tests/
    ├── test_users_locale.py                    # NEW: GET/PATCH /me; persists across "sessions"; invalid locale -> 422
    ├── test_workspace_currency.py               # NEW: owner sets currency pre-record; locked after first record
    │                                             #   (incl. soft-deleted); non-owner denied; unsupported code -> 422
    ├── test_income_expense_currency_matches_workspace.py  # NEW: record currency always equals workspace currency;
    │                                             #   direct-DB attempt to insert a mismatched currency is rejected
    │                                             #   by the trigger even bypassing the service layer
    └── test_reports_currency_awareness.py        # NEW: dashboard/reports/history currency fields reflect the
                                                  #   workspace's actual currency, not a hard-coded SAR default;
                                                  #   re-run of the Phase 9/10 financial-accuracy edge states against
                                                  #   a non-SAR workspace fixture

supabase/migrations/
└── 20260720000000_i18n_locale_workspace_currency.sql   # NEW (tracked): supported_currencies table + seed rows;
                                                          #   user_profiles.locale; workspaces.currency; incomes/expenses
                                                          #   currency FK + workspace-match trigger; currency-lock trigger

apps/web/
├── lib/
│   ├── money.ts                       # EDIT: toDisplayAmount(minor, locale, currency) and parseInputToMinor(input,
│   │                                  #   currency) parameterized by currency + its minor_unit_digits (2 or 3),
│   │                                  #   instead of hard-coded SAR_FRACTION_DIGITS/MINOR_UNITS_PER_SAR
│   ├── currency.ts                    # NEW: SupportedCurrency union + minorUnitDigits map, single source used by
│   │                                  #   money.ts and every component that renders/edits an amount
│   └── api/
│       ├── me.ts                      # NEW: getMe() / updateLocale(locale)
│       ├── dashboard.ts               # EDIT: currency: SupportedCurrency (not literal "SAR")
│       ├── expenses.ts                # EDIT: same
│       ├── incomes.ts                 # EDIT: same
│       ├── reports.ts                 # EDIT: same
│       └── workspaces.ts              # EDIT: Workspace type gains `currency`; update() accepts it
├── hooks/
│   └── use-me.ts                      # NEW: react-query hook for GET /me (used once at sign-in redirect logic)
├── components/settings/
│   ├── LanguageSwitcher.tsx           # EDIT: also calls PATCH /me with the newly selected locale
│   └── WorkspaceCurrencySelector.tsx  # NEW: Owner-only currency <Select>; shows "locked" state once workspace has
│                                      #   any income/expense record; mirrors LanguageSwitcher's structure/a11y
├── app/[locale]/sign-in/              # EDIT (wherever post-auth redirect lives): call GET /me once, redirect to the
│                                      #   preferred locale path if no NEXT_LOCALE cookie is present yet
└── messages/                          # EDIT: en + ar strings for the currency selector, "currency locked" message,
                                      #   and any new /me-related error text
```

**Structure Decision**: Web-application monolith, same layout as Phases 4–9.
This phase deliberately makes no changes to `apps/web/i18n/routing.ts`, the
locale-prefixed route tree, or `LocaleDirectionSync` — the existing AR/EN/RTL
infrastructure is treated as a stable dependency, not something to rebuild.
Currency support follows the exact `auto_delete_after_extraction` precedent
(extend the existing `PATCH /workspaces/{id}`) rather than a new sub-router,
since it is a single owner-gated column with no secret material or
independent lifecycle (unlike Phase 7's `ai_settings`). The `supported_currencies`
reference table is the single source of truth for both the allowed-value list
and the minor-unit-digit count, so the frontend's `lib/currency.ts` and the
database constraint can never drift from each other by more than a
data-review step. Locale-preference persistence is deliberately kept out of
the request-hot-path middleware and confined to the sign-in flow, so this
phase adds zero per-request latency.

## Complexity Tracking

> No constitution violations — this table is intentionally empty. The two
> new trigger functions (currency lock; record-matches-workspace-currency) are
> the one piece of added complexity, justified in the Constitution Check
> (Principle IX) and `research.md` §3: a plain `CHECK` constraint cannot
> reference another table's row, so a trigger is the only mechanism that makes
> "no mixed currency, ever, enforced by the database and not just application
> code" actually true, mirroring the project's existing precedent
> (`activity_history` triggers, `confirm_ai_extraction`).
