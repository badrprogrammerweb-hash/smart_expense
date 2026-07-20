create table public.supported_currencies (
    code text primary key,
    minor_unit_digits smallint not null default 2
);

insert into public.supported_currencies (code, minor_unit_digits) values
    ('SAR', 2),
    ('USD', 2),
    ('EUR', 2),
    ('GBP', 2),
    ('AED', 2),
    ('EGP', 2),
    ('KWD', 3),
    ('QAR', 2),
    ('BHD', 3),
    ('OMR', 3);

grant select on public.supported_currencies to authenticated;

alter table public.user_profiles
    add column locale text not null default 'en'
        constraint user_profiles_locale_check check (locale in ('en', 'ar'));

alter table public.workspaces
    add column currency text not null default 'SAR'
        constraint workspaces_currency_fkey references public.supported_currencies(code);

alter table public.incomes
    drop constraint incomes_currency_check,
    add constraint incomes_currency_fkey
        foreign key (currency) references public.supported_currencies(code);

alter table public.expenses
    drop constraint expenses_currency_check,
    add constraint expenses_currency_fkey
        foreign key (currency) references public.supported_currencies(code);

create or replace function public.enforce_record_currency_matches_workspace()
returns trigger
language plpgsql
as $$
declare
    workspace_currency text;
begin
    select currency into workspace_currency
    from public.workspaces
    where id = new.workspace_id;

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
