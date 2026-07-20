# Research: Internationalization and Workspace Currency

All Technical Context items are resolved below; no NEEDS CLARIFICATION remains.

## 1. Where does per-user language preference live?

**Decision**: Add a `locale text not null default 'en' check (locale in ('en','ar'))`
column to the existing `public.user_profiles` table (defined in
`supabase/migrations/20260624000000_auth_workspace_foundation.sql`). Expose it
through a new minimal `GET /me` / `PATCH /me` backend endpoint (no existing
per-user route exists to extend).

**Rationale**: `user_profiles` already models "one row per authenticated user"
(`id references auth.users(id)`), is already read on every request path that
needs the user's identity, and adding one nullable-free column with a default
is the smallest change that satisfies "store the preferred interface language
per user." A new table would be unjustified complexity for a single field.

**Alternatives considered**: A separate `user_preferences` table — rejected,
premature for a single column with no other per-user settings planned this
phase. Storing it only as a longer-lived cookie/localStorage value — rejected,
it was already tried (that's the current gap) and does not follow the user
across devices/browsers, which is the explicit exit criterion.

## 2. How does the stored preference reach the frontend without slowing every request?

**Decision**: Do **not** query the database on every request. Only consult the
stored preference at the two moments FR-002/FR-003 require it:

1. **Immediately after a successful sign-in**, the existing sign-in flow (which
   already knows the authenticated user) fetches `GET /me` once and, if the
   request carries no `NEXT_LOCALE` cookie yet (a fresh session) and the
   returned `locale` differs from the URL's current locale segment, redirects
   to the same path under the preferred locale and lets `next-intl`'s
   middleware set the matching `NEXT_LOCALE` cookie on that redirect (same
   mechanism the existing `LanguageSwitcher` already relies on).
2. **Every explicit language switch** (via `LanguageSwitcher`, extended in this
   phase) calls `PATCH /me` with the newly chosen locale in addition to its
   existing path-swap navigation, so the stored preference and the in-session
   choice are updated together.

Once a `NEXT_LOCALE` cookie exists for the session, it continues to win for
that session (existing `next-intl` behavior, untouched) — this is what "always
wins over the stored preference for the session in which it was made" (spec
Clarifications) means in implementation terms.

**Rationale**: This keeps `apps/web/middleware.ts` (which already runs on
every matched request) completely free of a new database round trip, touching
only the low-frequency sign-in path. It reuses the exact cookie-propagation
mechanism (`redirectPreservingCookies` in `apps/web/middleware.ts`) already in
place for auth redirects.

**Alternatives considered**: Reading `user_profiles.locale` inside
`apps/web/middleware.ts` on every request — rejected, adds a Postgres/PostgREST
round trip to the hot path for a value that only needs to be checked once per
session. Storing the preference only client-side after login (no server
persistence) — rejected, that is the status quo being replaced.

## 3. How is "one base currency per workspace" enforced without allowing mixed currency or conversion?

**Decision**: Introduce a small reference table:

```sql
create table public.supported_currencies (
    code text primary key,
    minor_unit_digits smallint not null default 2
);
insert into public.supported_currencies (code, minor_unit_digits) values
    ('SAR', 2), ('USD', 2), ('EUR', 2), ('GBP', 2), ('AED', 2),
    ('EGP', 2), ('KWD', 3), ('QAR', 2), ('BHD', 3), ('OMR', 3);
```

Add `workspaces.currency text not null default 'SAR' references
public.supported_currencies(code)`. Keep `incomes.currency` / `expenses.currency`
as `text not null references public.supported_currencies(code)` (replacing the
old `check (currency = 'SAR')`), and add a `BEFORE INSERT OR UPDATE` trigger on
each of `incomes` and `expenses` that raises an exception unless
`new.currency = (select currency from public.workspaces where id = new.workspace_id)`.
Add a second `BEFORE UPDATE OF currency ON workspaces` trigger that raises an
exception if the workspace already has any row (including soft-deleted, i.e.
`status = 'deleted'`) in `incomes` or `expenses`.

**Rationale**:
- A reference table is the single source of truth for "which currencies are
  supported" (used by both the workspace-currency check and, importantly, by
  `minor_unit_digits` — three of the ten supported currencies, KWD/BHD/OMR, use
  3 fractional digits, not 2, so the display-formatting layer must not
  hard-code 2 digits everywhere the way `apps/web/lib/money.ts` currently does).
- A same-workspace-currency trigger on `incomes`/`expenses` is the only way to
  enforce "record currency == workspace currency" — a plain `CHECK` constraint
  cannot reference another table's row. This mirrors the project's existing
  precedent of using triggers/`SECURITY DEFINER` functions for cross-row
  invariants (e.g. Phase 9's `activity_history` triggers, Phase 8's
  `confirm_ai_extraction`).
- Locking currency via a trigger (rather than only an application-layer check)
  guarantees the invariant even if a future code path forgets the
  application-layer check — consistent with constitution Principle IX/X
  (backend/database as authority, not frontend-trusted).

**Alternatives considered**: Storing currency only as a `CHECK (currency in
(...))` list duplicated on three columns — rejected, duplicates the supported
list and has no place to hang `minor_unit_digits`. Allowing currency to be
changed at any time and silently re-labeling existing records — rejected
explicitly by the spec (no exchange-rate conversion / no mixed currency); a
silent re-label would misstate historical amounts. A full currency-conversion
ledger — explicitly out of scope (constitution Principle III excludes mixed-
currency records and exchange-rate conversion).

## 4. How do backend schemas move from `Literal["SAR"]` to a dynamic set?

**Decision**: Replace `Currency = Literal["SAR"]` (in
`apps/api/app/schemas/dashboard.py`, `apps/api/app/schemas/expenses.py`,
`apps/api/app/schemas/incomes.py`) with a `SupportedCurrency` literal type
listing all ten supported codes, and loosen `apps/api/app/schemas/reports.py`'s
plain `str` currency fields to the same literal for consistency. Every
response that currently defaults `currency: Currency = "SAR"` instead derives
the value from the owning workspace's `currency` column (already joined/known
in each service function), rather than defaulting to a literal.

**Rationale**: Keeping a closed `Literal[...]` (rather than an open `str`)
preserves the existing validation strength — it still rejects an unsupported
code at the API boundary — while allowing any of the ten supported values.
Deriving the value from the workspace row (instead of a Pydantic field
default) is what actually makes responses currency-correct; the type change
alone does not.

**Alternatives considered**: Loosening to plain `str` — rejected, loses
input/output validation that the existing `Literal["SAR"]` provided.

## 5. How does the frontend format money/numbers/dates per currency and language?

**Decision**: Extend `apps/web/lib/money.ts`'s `toDisplayAmount` to accept a
currency code and look up its fractional-digit count from a small constant
map mirroring `supported_currencies` (`{ SAR: 2, USD: 2, ..., KWD: 3, BHD: 3,
OMR: 3 }`) instead of the hard-coded `SAR_FRACTION_DIGITS = 2` /
`MINOR_UNITS_PER_SAR = 100`; `Intl.NumberFormat(locale, { style: "currency",
currency, minimumFractionDigits, maximumFractionDigits })` already handles
symbol/placement/digit-script correctly once `currency` and the digit counts
are parameters instead of constants. `parseInputToMinor` similarly takes the
currency's digit count as a parameter instead of the SAR-only constant.
Every call site that currently calls `toDisplayAmount(minor, locale)` is
updated to pass the workspace's currency code (already available wherever an
amount is rendered, since it comes from the same API response as the amount).
Dates already render via `Intl.DateTimeFormat`/`next-intl` date formatting
keyed off the active locale (existing behavior) and are not changed beyond
verifying they remain correct once currency is no longer implicitly SAR.

**Rationale**: This is a parameterization, not a rewrite — `Intl.NumberFormat`
already does correct locale-aware currency formatting once given the right
currency code and digit counts; the current code just hard-codes both to SAR's
values.

**Alternatives considered**: Adding a currency-conversion or multi-currency
display layer — explicitly out of scope.

## 6. Migration sequencing and naming

**Decision**: One new migration,
`supabase/migrations/20260720000000_i18n_locale_workspace_currency.sql`,
following the existing `YYYYMMDDHHMMSS_snake_case_description.sql` convention
(latest prior migration is `20260708000000_reports_history.sql`). It is
additive only: new `supported_currencies` table + seed rows, new
`user_profiles.locale` column, new `workspaces.currency` column, replacement of
the two `check (currency = 'SAR')` constraints with FK references to
`supported_currencies`, and the two new trigger functions/triggers described
in §3. No existing row's data changes (`user_profiles.locale` defaults to
`'en'`, matching the existing app default locale; `workspaces.currency`
defaults to `'SAR'`, matching every existing income/expense row's currency, so
the workspace-currency-matches-record trigger is satisfied for all pre-existing
data with no backfill needed).

**Rationale**: Matches the project's established migration convention and
keeps the change additive/non-destructive, consistent with how every prior
phase (006–009) shipped its schema changes.

## 7. Authorization pattern for changing workspace currency

**Decision**: Reuse the exact pattern `PATCH /workspaces/{workspace_id}`
already uses for `auto_delete_after_extraction`
(`apps/api/app/routes/workspaces.py:124-174`): look up the caller's role for
the workspace, require `role == "owner"`, else `403`. Add `currency` as a
second optional field on the same `WorkspaceUpdateRequest`/
`WorkspaceSettingsResponse` pair (both fields remain independently optional to
update) rather than inventing a separate endpoint, since both are
single-workspace-row settings updates gated the same way.

**Rationale**: Consistent with the "reuse existing patterns" approach the
project already follows (Phase 6 justified the `auto_delete_after_extraction`
PATCH exactly this way); avoids a redundant new router for a single-column
update.

**Alternatives considered**: A dedicated `/workspaces/{id}/currency` endpoint
mirroring the Phase 7 `ai_settings` sub-router pattern — considered
unnecessary extra surface for a single owner-gated column, since (unlike AI
settings) currency has no secret material or independent lifecycle.

## 8. Regression protection for existing AR/EN/RTL behavior

**Decision**: No changes to `apps/web/i18n/routing.ts`, the locale-prefixed
route tree, `LocaleDirectionSync`, or the existing `next-intl` message files
beyond adding any new user-facing strings this phase introduces (e.g. the
currency selector's labels, the currency-locked error message). The existing
automated suites (`apps/web/tests/unit/localization-rtl.test.tsx`,
`apps/web/tests/e2e/locale-rtl.spec.ts`, `apps/web/e2e/acc-localization-rtl.spec.ts`)
and the manual checklist
(`specs/010-testing-security-deployment/manual-ar-en-rtl-checklist.md`) are
re-run as regression gates, extended with cases that use a non-SAR workspace
currency.

**Rationale**: The exit criteria explicitly require existing RTL/LTR behavior
to keep working; the safest way to guarantee that is to change nothing about
the direction/locale-routing infrastructure itself and treat the existing
suites as a regression contract.
