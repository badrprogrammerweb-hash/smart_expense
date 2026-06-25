create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null check (length(btrim(name)) > 0),
    sort_order integer not null,
    is_archived boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.incomes (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    created_by uuid not null references public.user_profiles(id) on delete restrict,
    amount_minor bigint not null check (amount_minor > 0),
    currency text not null default 'SAR' check (currency = 'SAR'),
    occurred_on date not null,
    description text,
    status text not null default 'confirmed' check (status in ('confirmed', 'deleted')),
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    created_by uuid not null references public.user_profiles(id) on delete restrict,
    category_id uuid references public.categories(id) on delete restrict,
    amount_minor bigint not null check (amount_minor > 0),
    currency text not null default 'SAR' check (currency = 'SAR'),
    occurred_on date not null,
    description text,
    merchant_name text,
    status text not null default 'confirmed' check (status in ('confirmed', 'deleted')),
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.categories(workspace_id, name, sort_order)
    values
        (new.id, 'Restaurants', 0),
        (new.id, 'Groceries', 1),
        (new.id, 'Fuel', 2),
        (new.id, 'Transportation', 3),
        (new.id, 'Rent', 4),
        (new.id, 'Utilities', 5),
        (new.id, 'Internet & Mobile', 6),
        (new.id, 'Health', 7),
        (new.id, 'Education', 8),
        (new.id, 'Family', 9),
        (new.id, 'Shopping', 10),
        (new.id, 'Entertainment', 11),
        (new.id, 'Travel', 12),
        (new.id, 'Subscriptions', 13),
        (new.id, 'Other', 14)
    on conflict do nothing;

    return new;
end;
$$;

drop trigger if exists workspaces_seed_default_categories on public.workspaces;
create trigger workspaces_seed_default_categories
after insert on public.workspaces
for each row execute function public.seed_default_categories();

create unique index if not exists categories_unique_active_name
    on public.categories(workspace_id, lower(name))
    where not is_archived;

create or replace function public.validate_expense_category()
returns trigger
language plpgsql
as $$
declare
    category_workspace_id uuid;
    category_is_archived boolean;
begin
    if new.category_id is null then
        return new;
    end if;

    if tg_op = 'UPDATE' and old.category_id is not distinct from new.category_id then
        return new;
    end if;

    select c.workspace_id, c.is_archived
    into category_workspace_id, category_is_archived
    from public.categories c
    where c.id = new.category_id;

    if category_workspace_id is null or category_workspace_id is distinct from new.workspace_id then
        raise exception 'category_not_in_workspace';
    end if;

    if category_is_archived then
        raise exception 'category_archived';
    end if;

    return new;
end;
$$;

drop trigger if exists expenses_validate_category on public.expenses;
create trigger expenses_validate_category
before insert or update of category_id on public.expenses
for each row execute function public.validate_expense_category();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists incomes_set_updated_at on public.incomes;
create trigger incomes_set_updated_at
before update on public.incomes
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

grant select, insert, update on public.categories to authenticated;
grant select, insert, update on public.incomes to authenticated;
grant select, insert, update on public.expenses to authenticated;

alter table public.categories enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;

create policy "Members can read categories"
on public.categories
for select
to authenticated
using (public.is_workspace_member(categories.workspace_id, auth.uid()));

create policy "Owners and admins can create categories"
on public.categories
for insert
to authenticated
with check (public.workspace_role_for(categories.workspace_id, auth.uid()) in ('owner', 'admin'));

create policy "Owners and admins can update categories"
on public.categories
for update
to authenticated
using (public.workspace_role_for(categories.workspace_id, auth.uid()) in ('owner', 'admin'))
with check (public.workspace_role_for(categories.workspace_id, auth.uid()) in ('owner', 'admin'));

create policy "Members can read incomes"
on public.incomes
for select
to authenticated
using (public.is_workspace_member(incomes.workspace_id, auth.uid()));

create policy "Owners and admins can create incomes"
on public.incomes
for insert
to authenticated
with check (
    incomes.created_by = auth.uid()
    and public.workspace_role_for(incomes.workspace_id, auth.uid()) in ('owner', 'admin')
);

create policy "Owners and admins can update incomes"
on public.incomes
for update
to authenticated
using (public.workspace_role_for(incomes.workspace_id, auth.uid()) in ('owner', 'admin'))
with check (public.workspace_role_for(incomes.workspace_id, auth.uid()) in ('owner', 'admin'));

create policy "Members can read expenses"
on public.expenses
for select
to authenticated
using (public.is_workspace_member(expenses.workspace_id, auth.uid()));

create policy "Owners admins and members can create expenses"
on public.expenses
for insert
to authenticated
with check (
    expenses.created_by = auth.uid()
    and public.workspace_role_for(expenses.workspace_id, auth.uid()) in ('owner', 'admin', 'member')
);

create policy "Owners admins and creators can update expenses"
on public.expenses
for update
to authenticated
using (
    public.workspace_role_for(expenses.workspace_id, auth.uid()) in ('owner', 'admin')
    or (
        public.workspace_role_for(expenses.workspace_id, auth.uid()) = 'member'
        and expenses.created_by = auth.uid()
    )
)
with check (
    public.workspace_role_for(expenses.workspace_id, auth.uid()) in ('owner', 'admin')
    or (
        public.workspace_role_for(expenses.workspace_id, auth.uid()) = 'member'
        and expenses.created_by = auth.uid()
    )
);
