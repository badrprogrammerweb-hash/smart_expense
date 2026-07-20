# Contract: Schema Migration — Locale + Workspace Currency

New migration file: `supabase/migrations/20260720000000_i18n_locale_workspace_currency.sql`.
Purely additive; no destructive change to any existing table/column/row.

## New table: `public.supported_currencies`

```sql
create table public.supported_currencies (
    code text primary key,
    minor_unit_digits smallint not null default 2
);

insert into public.supported_currencies (code, minor_unit_digits) values
    ('SAR', 2), ('USD', 2), ('EUR', 2), ('GBP', 2), ('AED', 2),
    ('EGP', 2), ('KWD', 3), ('QAR', 2), ('BHD', 3), ('OMR', 3);

grant select on public.supported_currencies to authenticated;
```

No RLS (non-tenant reference data).

## Altered table: `public.user_profiles`

```sql
alter table public.user_profiles
    add column locale text not null default 'en'
    check (locale in ('en', 'ar'));
```

Resolves FR-001, FR-004, FR-005.

## Altered table: `public.workspaces`

```sql
alter table public.workspaces
    add column currency text not null default 'SAR'
    references public.supported_currencies(code);
```

Resolves FR-006, FR-007.

### Trigger: lock currency once the workspace has any income/expense row

```sql
create or replace function public.enforce_workspace_currency_lock()
returns trigger
language plpgsql
as $$
begin
  if new.currency is distinct from old.currency then
    if exists (select 1 from public.incomes where workspace_id = old.id)
       or exists (select 1 from public.expenses where workspace_id = old.id) then
      raise exception 'workspace currency is locked once income or expense records exist'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger workspaces_currency_lock
  before update of currency on public.workspaces
  for each row
  execute function public.enforce_workspace_currency_lock();
```

The `exists` checks intentionally do not filter on `status`, so soft-deleted
(`status = 'deleted'`) rows still count toward the lock (FR-009).

## Altered tables: `public.incomes`, `public.expenses`

```sql
alter table public.incomes
    drop constraint incomes_currency_check,  -- or the actual generated name
    alter column currency drop default,
    alter column currency set default 'SAR',
    add constraint incomes_currency_fkey
        foreign key (currency) references public.supported_currencies(code);

-- same pattern for public.expenses
```

> The exact existing constraint name must be confirmed against
> `20260625000000_income_expense_category_core.sql` at implementation time
> (`\d incomes` / `\d expenses`) rather than assumed; drop-and-recreate must
> use the real name.

### Trigger: record currency must match its workspace's currency

```sql
create or replace function public.enforce_record_currency_matches_workspace()
returns trigger
language plpgsql
as $$
declare
  workspace_currency text;
begin
  select currency into workspace_currency
  from public.workspaces where id = new.workspace_id;

  if new.currency is distinct from workspace_currency then
    raise exception 'record currency must match the workspace currency'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger incomes_currency_matches_workspace
  before insert or update on public.incomes
  for each row
  execute function public.enforce_record_currency_matches_workspace();

create trigger expenses_currency_matches_workspace
  before insert or update on public.expenses
  for each row
  execute function public.enforce_record_currency_matches_workspace();
```

Resolves FR-010, FR-011.

## Non-destructiveness check (for migration review)

- Every existing `workspaces` row gets `currency = 'SAR'` (column default).
- Every existing `incomes`/`expenses` row already has `currency = 'SAR'`, so
  the new FK constraint and the new "matches workspace" trigger both hold
  immediately for 100% of pre-existing data — no backfill statement is
  required.
- Every existing `user_profiles` row gets `locale = 'en'` (column default),
  matching the app's current default locale, so no existing user's rendered
  language changes because of this migration alone.
