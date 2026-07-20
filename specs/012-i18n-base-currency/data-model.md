# Data Model: Internationalization and Workspace Currency

All changes are additive on top of the schema shipped through
`20260708000000_reports_history.sql`. New migration:
`20260720000000_i18n_locale_workspace_currency.sql`.

## `public.supported_currencies` (new table)

Reference list of currencies a workspace may be configured to use, and the
number of fractional/minor-unit digits each uses for display formatting
(money itself is always stored as an integer count of minor units regardless
of this number — this column only drives display formatting and
minor-unit-per-major-unit conversion at input/output boundaries).

| Column | Type | Notes |
|---|---|---|
| `code` | `text primary key` | ISO 4217 alphabetic code, e.g. `SAR`, `USD`. |
| `minor_unit_digits` | `smallint not null default 2` | `2` for most; `3` for `KWD`, `BHD`, `OMR`. |

Seed rows (fixed for this phase; extending the list later is a data change,
not a migration to this design): `SAR(2)` [default], `USD(2)`, `EUR(2)`,
`GBP(2)`, `AED(2)`, `EGP(2)`, `KWD(3)`, `QAR(2)`, `BHD(3)`, `OMR(3)`.

No RLS needed (readable reference data, not workspace-owned); grant `select`
to the authenticated role.

## `public.user_profiles` (extended)

| Column | Type | Notes |
|---|---|---|
| `locale` | `text not null default 'en' check (locale in ('en','ar'))` | **New.** The user's durably stored interface-language preference (FR-001). Default matches the existing app default locale (`apps/web/i18n/routing.ts`'s `defaultLocale`), so pre-existing users see no change until they explicitly choose a language. |

No relationship changes; `id` still references `auth.users(id)`.

## `public.workspaces` (extended)

| Column | Type | Notes |
|---|---|---|
| `currency` | `text not null default 'SAR' references public.supported_currencies(code)` | **New.** The workspace's single base currency (FR-006, FR-007). Defaults to `SAR` for new and pre-existing workspaces. |

**Lifecycle rule (FR-009)**: `currency` may be updated by the workspace Owner
only, and only while the workspace has zero rows in `incomes` and zero rows in
`expenses` (checked by existence, including soft-deleted rows with
`status = 'deleted'` — a `BEFORE UPDATE OF currency` trigger enforces this
regardless of the calling code path). Once any such row exists, `currency` is
permanently locked for the life of the workspace. Unconfirmed AI-extraction
drafts (rows in the extraction table that have not yet been confirmed into an
`incomes`/`expenses` row) do **not** count toward the lock.

## `public.incomes` / `public.expenses` (constraint change only)

The existing `currency text not null default 'SAR' check (currency = 'SAR')`
becomes `currency text not null references public.supported_currencies(code)`.
A new `BEFORE INSERT OR UPDATE` trigger on each table enforces
`new.currency = (select currency from public.workspaces where id = new.workspace_id)`
(FR-010), so a record can never be created or edited into a currency other
than its own workspace's current currency. No change to `amount_minor`,
`status`, `deleted_at`, or any other existing column — money remains integer
minor units regardless of which supported currency is configured (FR-015,
constitution Principle X).

Existing rows are unaffected: every pre-existing `incomes`/`expenses` row
already has `currency = 'SAR'`, and every pre-existing workspace defaults to
`currency = 'SAR'`, so the new trigger's invariant holds for all data as of
this migration with no backfill.

## Key Entities (from spec, mapped to schema)

- **User Language Preference** → `user_profiles.locale`.
- **Workspace Base Currency** → `workspaces.currency`, validated against and
  described by `supported_currencies`.
- **Income / Expense Record (extended)** → unchanged shape; `currency` now
  FK-validated and workspace-matching instead of a fixed literal.
- **Supported Currency List** → `public.supported_currencies`.

## State / Validation Summary

```text
supported_currencies (code, minor_unit_digits)  — reference data, 10 rows

user_profiles
  locale ∈ {en, ar}, default en                 — FR-001, FR-004, FR-005

workspaces
  currency ∈ supported_currencies.code, default SAR   — FR-006, FR-007
  currency mutable only while:
    not exists (select 1 from incomes where workspace_id = workspaces.id)
    and not exists (select 1 from expenses where workspace_id = workspaces.id)
                                                        — FR-009

incomes / expenses
  currency ∈ supported_currencies.code
  currency = (owning workspace's current currency)     — FR-010, FR-011
```
