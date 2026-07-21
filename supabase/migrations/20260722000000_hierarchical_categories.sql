-- Phase 13: Hierarchical Categories
-- Adds a second tree (income) alongside the existing expense tree, one
-- level of subcategories under each main category, system-provided
-- translation keys, and the associated validation/history/delete-guard
-- triggers. Backfills the expanded default catalog onto every existing
-- workspace (not only new ones).

-- =====================================================================
-- Part 1: categories — new columns
-- =====================================================================

alter table public.categories
    add column category_type text,
    add column parent_id uuid references public.categories(id) on delete restrict,
    add column is_system boolean not null default false,
    add column translation_key text;

update public.categories
set category_type = 'expense'
where category_type is null;

alter table public.categories
    alter column category_type set not null,
    alter column category_type set default 'expense',
    add constraint categories_category_type_check
        check (category_type in ('income', 'expense'));

-- =====================================================================
-- Part 2: hierarchy integrity trigger (depth <= 2, same workspace/type)
-- =====================================================================

create or replace function public.validate_category_hierarchy()
returns trigger
language plpgsql
as $$
declare
    parent_workspace_id uuid;
    parent_category_type text;
    parent_parent_id uuid;
begin
    if new.parent_id is null then
        return new;
    end if;

    if new.parent_id = new.id then
        raise exception 'invalid_parent_category';
    end if;

    select c.workspace_id, c.category_type, c.parent_id
    into parent_workspace_id, parent_category_type, parent_parent_id
    from public.categories c
    where c.id = new.parent_id;

    if parent_workspace_id is null or parent_workspace_id is distinct from new.workspace_id then
        raise exception 'invalid_parent_category';
    end if;

    if parent_category_type is distinct from new.category_type then
        raise exception 'invalid_parent_category';
    end if;

    if parent_parent_id is not null then
        raise exception 'invalid_parent_category';
    end if;

    return new;
end;
$$;

drop trigger if exists categories_validate_hierarchy on public.categories;
create trigger categories_validate_hierarchy
before insert or update of parent_id, category_type on public.categories
for each row execute function public.validate_category_hierarchy();

-- =====================================================================
-- Part 3: uniqueness — replace the single flat index with two per-level
-- partial indexes
-- =====================================================================

drop index if exists public.categories_unique_active_name;

create unique index categories_unique_active_main_name
    on public.categories (workspace_id, category_type, lower(name))
    where parent_id is null and not is_archived;

create unique index categories_unique_active_sub_name
    on public.categories (workspace_id, parent_id, lower(name))
    where parent_id is not null and not is_archived;

-- =====================================================================
-- Part 4: incomes.category_id
-- =====================================================================

alter table public.incomes
    add column category_id uuid references public.categories(id) on delete restrict;

-- =====================================================================
-- Part 5: shared validation function + per-table triggers
-- =====================================================================

create or replace function public.validate_category_assignment(
    p_category_id uuid,
    p_workspace_id uuid,
    p_expected_type text
)
returns void
language plpgsql
as $$
declare
    v_workspace_id uuid;
    v_category_type text;
    v_is_archived boolean;
    v_parent_id uuid;
    v_parent_is_archived boolean;
begin
    select c.workspace_id, c.category_type, c.is_archived, c.parent_id
    into v_workspace_id, v_category_type, v_is_archived, v_parent_id
    from public.categories c
    where c.id = p_category_id;

    if v_workspace_id is null or v_workspace_id is distinct from p_workspace_id then
        raise exception 'category_not_in_workspace';
    end if;

    if v_category_type is distinct from p_expected_type then
        raise exception 'category_type_mismatch';
    end if;

    if v_is_archived then
        raise exception 'category_archived';
    end if;

    if v_parent_id is not null then
        select c.is_archived into v_parent_is_archived
        from public.categories c
        where c.id = v_parent_id;

        if coalesce(v_parent_is_archived, true) then
            raise exception 'category_archived';
        end if;
    end if;
end;
$$;

create or replace function public.validate_expense_category()
returns trigger
language plpgsql
as $$
begin
    if new.category_id is null then
        return new;
    end if;

    if tg_op = 'UPDATE' and old.category_id is not distinct from new.category_id then
        return new;
    end if;

    perform public.validate_category_assignment(new.category_id, new.workspace_id, 'expense');

    return new;
end;
$$;

create or replace function public.validate_income_category()
returns trigger
language plpgsql
as $$
begin
    if new.category_id is null then
        return new;
    end if;

    if tg_op = 'UPDATE' and old.category_id is not distinct from new.category_id then
        return new;
    end if;

    perform public.validate_category_assignment(new.category_id, new.workspace_id, 'income');

    return new;
end;
$$;

drop trigger if exists incomes_validate_category on public.incomes;
create trigger incomes_validate_category
before insert or update of category_id on public.incomes
for each row execute function public.validate_income_category();

-- =====================================================================
-- Part 6: hard-delete guard, DELETE RLS policy, and history-trigger
-- extension for the newly-introduced category delete capability
-- =====================================================================

create or replace function public.prevent_referenced_category_delete()
returns trigger
language plpgsql
as $$
declare
    v_has_records boolean;
    v_has_children boolean;
begin
    -- If the owning workspace itself no longer exists, this delete is
    -- happening as part of a workspace-level cascade teardown (e.g. account
    -- deletion via auth.users -> user_profiles -> workspaces cascade), not a
    -- standalone category-management delete. The guard below exists only to
    -- protect the standalone API path, so it must not block a full teardown.
    if not exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
        return old;
    end if;

    select
        exists(select 1 from public.incomes i where i.category_id = old.id)
        or exists(select 1 from public.expenses e where e.category_id = old.id)
    into v_has_records;

    if v_has_records then
        raise exception 'category_has_references';
    end if;

    select exists(select 1 from public.categories c where c.parent_id = old.id)
    into v_has_children;

    if v_has_children then
        raise exception 'category_has_references';
    end if;

    return old;
end;
$$;

drop trigger if exists categories_prevent_referenced_delete on public.categories;
create trigger categories_prevent_referenced_delete
before delete on public.categories
for each row execute function public.prevent_referenced_category_delete();

drop policy if exists "Owners and admins can delete categories" on public.categories;
create policy "Owners and admins can delete categories" on public.categories
    for delete
    to authenticated
    using (workspace_role_for(workspace_id, auth.uid()) = any (array['owner', 'admin']));

grant delete on public.categories to authenticated;

alter table public.activity_history
    drop constraint activity_history_event_type_check;

alter table public.activity_history
    add constraint activity_history_event_type_check
    check (event_type in (
        'income_created','income_updated','income_deleted',
        'expense_created','expense_updated','expense_deleted',
        'category_created','category_updated','category_archived','category_deleted',
        'file_uploaded','file_deleted',
        'extraction_started','extraction_completed','extraction_failed',
        'ai_draft_confirmed',
        'member_added','member_removed','role_changed',
        'setting_changed'
    ));

create or replace function public.record_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_workspace_id uuid;
    v_event_type text;
    v_entity_id uuid;
    v_summary jsonb := '{}'::jsonb;
    v_current jsonb := '{}'::jsonb;
    v_previous jsonb := '{}'::jsonb;
begin
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
        return new;
    end if;

    if tg_table_name = 'workspaces' then
        v_workspace_id := case when tg_op = 'DELETE' then old.id else new.id end;
        v_entity_id := v_workspace_id;
    elsif tg_table_name = 'workspace_ai_settings' then
        v_workspace_id := case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;
        v_entity_id := v_workspace_id;
    elsif tg_op = 'DELETE' then
        v_workspace_id := old.workspace_id;
        v_entity_id := old.id;
    else
        v_workspace_id := new.workspace_id;
        v_entity_id := new.id;
    end if;

    if tg_op = 'INSERT' then
        v_current := to_jsonb(new);
    elsif tg_op = 'DELETE' then
        v_current := to_jsonb(old);
        v_previous := to_jsonb(old);
    else
        v_current := to_jsonb(new);
        v_previous := to_jsonb(old);
    end if;

    if tg_table_name = 'incomes' then
        if tg_op = 'INSERT' then
            v_event_type := 'income_created';
        elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'deleted' then
            v_event_type := 'income_deleted';
        elsif tg_op = 'UPDATE' and (
            old.amount_minor is distinct from new.amount_minor
            or old.currency is distinct from new.currency
            or old.occurred_on is distinct from new.occurred_on
            or old.description is distinct from new.description
            or old.status is distinct from new.status
            or old.deleted_at is distinct from new.deleted_at
        ) then
            v_event_type := 'income_updated';
        end if;
        v_summary := jsonb_strip_nulls(jsonb_build_object(
            'amount_minor', nullif(v_current ->> 'amount_minor', '')::bigint,
            'occurred_on', v_current ->> 'occurred_on'
        ));

    elsif tg_table_name = 'expenses' then
        if tg_op = 'INSERT' then
            v_event_type := 'expense_created';
        elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'deleted' then
            v_event_type := 'expense_deleted';
        elsif tg_op = 'UPDATE' and (
            old.category_id is distinct from new.category_id
            or old.amount_minor is distinct from new.amount_minor
            or old.currency is distinct from new.currency
            or old.occurred_on is distinct from new.occurred_on
            or old.description is distinct from new.description
            or old.merchant_name is distinct from new.merchant_name
            or old.status is distinct from new.status
            or old.deleted_at is distinct from new.deleted_at
        ) then
            v_event_type := 'expense_updated';
        end if;
        v_summary := jsonb_strip_nulls(jsonb_build_object(
            'amount_minor', nullif(v_current ->> 'amount_minor', '')::bigint,
            'occurred_on', v_current ->> 'occurred_on',
            'merchant_name', v_current ->> 'merchant_name'
        ));

    elsif tg_table_name = 'categories' then
        if tg_op = 'DELETE' then
            v_event_type := 'category_deleted';
        elsif tg_op = 'INSERT' then
            v_event_type := 'category_created';
        elsif tg_op = 'UPDATE' and old.is_archived is distinct from new.is_archived and new.is_archived then
            v_event_type := 'category_archived';
        elsif tg_op = 'UPDATE' and (
            old.name is distinct from new.name
            or old.sort_order is distinct from new.sort_order
            or old.is_archived is distinct from new.is_archived
        ) then
            v_event_type := 'category_updated';
        end if;
        v_summary := jsonb_strip_nulls(jsonb_build_object(
            'name', v_current ->> 'name',
            'is_archived', nullif(v_current ->> 'is_archived', '')::boolean
        ));

    elsif tg_table_name = 'files' then
        if tg_op = 'INSERT' then
            v_event_type := 'file_uploaded';
        elsif tg_op = 'DELETE' then
            v_event_type := 'file_deleted';
        elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'deleted' then
            v_event_type := 'file_deleted';
        end if;
        v_summary := jsonb_strip_nulls(jsonb_build_object(
            'original_filename', v_current ->> 'original_filename',
            'content_type', v_current ->> 'content_type',
            'size_bytes', nullif(v_current ->> 'size_bytes', '')::bigint
        ));

    elsif tg_table_name = 'ai_extractions' then
        if tg_op = 'INSERT' and new.status = 'processing' then
            v_event_type := 'extraction_started';
        elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'ready_for_review' then
            v_event_type := 'extraction_completed';
        elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'failed' then
            v_event_type := 'extraction_failed';
        elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'confirmed' then
            v_event_type := 'ai_draft_confirmed';
        end if;
        v_summary := jsonb_strip_nulls(jsonb_build_object(
            'provider', v_current ->> 'provider',
            'status', v_current ->> 'status',
            'vendor_name', v_current ->> 'vendor_name',
            'amount_minor', nullif(v_current ->> 'amount_minor', '')::bigint
        ));

    elsif tg_table_name = 'workspace_memberships' then
        if tg_op = 'INSERT' then
            v_event_type := 'member_added';
        elsif tg_op = 'DELETE' then
            v_event_type := 'member_removed';
        elsif tg_op = 'UPDATE' and old.role is distinct from new.role then
            v_event_type := 'role_changed';
        end if;
        v_summary := jsonb_strip_nulls(jsonb_build_object(
            'user_id', v_current ->> 'user_id',
            'old_role', case when tg_op = 'UPDATE' then v_previous ->> 'role' else null end,
            'new_role', case when tg_op <> 'DELETE' then v_current ->> 'role' else null end
        ));

    elsif tg_table_name = 'workspaces' then
        if tg_op = 'UPDATE' and old.auto_delete_after_extraction is distinct from new.auto_delete_after_extraction then
            v_event_type := 'setting_changed';
        end if;
        v_summary := jsonb_strip_nulls(jsonb_build_object(
            'setting', 'auto_delete_after_extraction',
            'old_value', nullif(v_previous ->> 'auto_delete_after_extraction', '')::boolean,
            'new_value', nullif(v_current ->> 'auto_delete_after_extraction', '')::boolean
        ));

    elsif tg_table_name = 'workspace_ai_settings' then
        if tg_op = 'INSERT' then
            v_event_type := 'setting_changed';
        elsif tg_op = 'DELETE' then
            v_event_type := 'setting_changed';
        elsif tg_op = 'UPDATE' and (
            old.provider is distinct from new.provider
            or old.vault_secret_id is distinct from new.vault_secret_id
            or old.key_last4 is distinct from new.key_last4
            or old.updated_by is distinct from new.updated_by
        ) then
            v_event_type := 'setting_changed';
        end if;
        v_summary := jsonb_strip_nulls(jsonb_build_object(
            'setting', 'workspace_ai_settings',
            'provider', v_current ->> 'provider',
            'action', lower(tg_op)
        ));
    end if;

    if v_event_type is null then
        if tg_op = 'DELETE' then
            return old;
        end if;
        return new;
    end if;

    insert into public.activity_history (
        workspace_id,
        event_type,
        actor_user_id,
        entity_table,
        entity_id,
        summary
    )
    values (
        v_workspace_id,
        v_event_type,
        auth.uid(),
        tg_table_name,
        v_entity_id,
        coalesce(v_summary, '{}'::jsonb)
    );

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$function$;

-- =====================================================================
-- Part 7: seed_default_categories() — both trees, with subcategories,
-- for every NEWLY inserted workspace going forward
-- =====================================================================

create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.categories (workspace_id, category_type, name, translation_key, is_system, sort_order)
    values
        (new.id, 'expense', 'Restaurants', 'restaurants', true, 0),
        (new.id, 'expense', 'Groceries', 'groceries', true, 1),
        (new.id, 'expense', 'Fuel', 'fuel', true, 2),
        (new.id, 'expense', 'Transportation', 'transportation', true, 3),
        (new.id, 'expense', 'Rent', 'rent', true, 4),
        (new.id, 'expense', 'Utilities', 'utilities', true, 5),
        (new.id, 'expense', 'Internet & Mobile', 'internet_mobile', true, 6),
        (new.id, 'expense', 'Health', 'health', true, 7),
        (new.id, 'expense', 'Education', 'education', true, 8),
        (new.id, 'expense', 'Family', 'family', true, 9),
        (new.id, 'expense', 'Shopping', 'shopping', true, 10),
        (new.id, 'expense', 'Entertainment', 'entertainment', true, 11),
        (new.id, 'expense', 'Travel', 'travel', true, 12),
        (new.id, 'expense', 'Subscriptions', 'subscriptions', true, 13),
        (new.id, 'expense', 'Other', 'other', true, 14),
        (new.id, 'income', 'Salary', 'salary', true, 0),
        (new.id, 'income', 'Business Income', 'business_income', true, 1),
        (new.id, 'income', 'Gifts', 'gifts', true, 2),
        (new.id, 'income', 'Investment Returns', 'investment_returns', true, 3),
        (new.id, 'income', 'Other Income', 'other_income', true, 4)
    on conflict do nothing;

    insert into public.categories (workspace_id, category_type, parent_id, name, translation_key, is_system, sort_order)
    select new.id, p.category_type, p.id, v.name, p.translation_key || '.' || v.sub_slug, true, v.sort_order
    from (values
        ('restaurants', 'Dining Out', 'dining_out', 0),
        ('restaurants', 'Cafes & Coffee', 'cafes_coffee', 1),
        ('restaurants', 'Delivery', 'delivery', 2),
        ('groceries', 'Supermarket', 'supermarket', 0),
        ('groceries', 'Bulk & Wholesale', 'bulk_wholesale', 1),
        ('transportation', 'Public Transit', 'public_transit', 0),
        ('transportation', 'Ride-Hailing', 'ride_hailing', 1),
        ('transportation', 'Parking & Tolls', 'parking_tolls', 2),
        ('transportation', 'Vehicle Maintenance', 'vehicle_maintenance', 3),
        ('utilities', 'Electricity', 'electricity', 0),
        ('utilities', 'Water', 'water', 1),
        ('utilities', 'Gas', 'gas', 2),
        ('internet_mobile', 'Internet', 'internet', 0),
        ('internet_mobile', 'Mobile Plan', 'mobile_plan', 1),
        ('health', 'Doctor Visits', 'doctor_visits', 0),
        ('health', 'Pharmacy', 'pharmacy', 1),
        ('health', 'Insurance', 'insurance', 2),
        ('education', 'Tuition', 'tuition', 0),
        ('education', 'Books & Supplies', 'books_supplies', 1),
        ('education', 'Courses', 'courses', 2),
        ('family', 'Childcare', 'childcare', 0),
        ('family', 'Household Help', 'household_help', 1),
        ('shopping', 'Clothing', 'clothing', 0),
        ('shopping', 'Electronics', 'electronics', 1),
        ('shopping', 'Home Goods', 'home_goods', 2),
        ('entertainment', 'Movies & Events', 'movies_events', 0),
        ('entertainment', 'Hobbies', 'hobbies', 1),
        ('entertainment', 'Games & Apps', 'games_apps', 2),
        ('travel', 'Flights', 'flights', 0),
        ('travel', 'Hotels', 'hotels', 1),
        ('travel', 'Activities', 'activities', 2),
        ('subscriptions', 'Streaming', 'streaming', 0),
        ('subscriptions', 'Software', 'software', 1),
        ('subscriptions', 'Memberships', 'memberships', 2),
        ('salary', 'Primary Job', 'primary_job', 0),
        ('salary', 'Bonus & Commission', 'bonus_commission', 1),
        ('business_income', 'Sales Revenue', 'sales_revenue', 0),
        ('business_income', 'Services Revenue', 'services_revenue', 1),
        ('investment_returns', 'Dividends', 'dividends', 0),
        ('investment_returns', 'Interest', 'interest', 1)
    ) as v(parent_slug, name, sub_slug, sort_order)
    join public.categories p
        on p.workspace_id = new.id
       and p.translation_key = v.parent_slug
       and p.parent_id is null
    on conflict do nothing;

    return new;
end;
$$;

-- =====================================================================
-- Part 8: one-time backfill for every EXISTING workspace (not a
-- trigger — runs once, now, over every row currently in the tables)
-- =====================================================================

-- (a) Stamp is_system/translation_key on existing main categories whose
-- name still matches one of the 15 original defaults, regardless of
-- current is_archived state. Renamed categories are left untouched
-- (is_system stays false) — matching research.md Decision 8.
update public.categories c
set is_system = true,
    translation_key = m.slug
from (values
    ('restaurants', 'restaurants'),
    ('groceries', 'groceries'),
    ('fuel', 'fuel'),
    ('transportation', 'transportation'),
    ('rent', 'rent'),
    ('utilities', 'utilities'),
    ('internet & mobile', 'internet_mobile'),
    ('health', 'health'),
    ('education', 'education'),
    ('family', 'family'),
    ('shopping', 'shopping'),
    ('entertainment', 'entertainment'),
    ('travel', 'travel'),
    ('subscriptions', 'subscriptions'),
    ('other', 'other')
) as m(name_lc, slug)
where lower(c.name) = m.name_lc
    and c.category_type = 'expense'
    and c.parent_id is null
    and c.translation_key is null;

-- (b) Insert the missing default expense subcategories under whichever
-- row now carries each matched translation_key, for every workspace.
insert into public.categories (workspace_id, category_type, parent_id, name, translation_key, is_system, sort_order)
select p.workspace_id, 'expense', p.id, v.name, p.translation_key || '.' || v.sub_slug, true, v.sort_order
from public.categories p
join (values
    ('restaurants', 'Dining Out', 'dining_out', 0),
    ('restaurants', 'Cafes & Coffee', 'cafes_coffee', 1),
    ('restaurants', 'Delivery', 'delivery', 2),
    ('groceries', 'Supermarket', 'supermarket', 0),
    ('groceries', 'Bulk & Wholesale', 'bulk_wholesale', 1),
    ('transportation', 'Public Transit', 'public_transit', 0),
    ('transportation', 'Ride-Hailing', 'ride_hailing', 1),
    ('transportation', 'Parking & Tolls', 'parking_tolls', 2),
    ('transportation', 'Vehicle Maintenance', 'vehicle_maintenance', 3),
    ('utilities', 'Electricity', 'electricity', 0),
    ('utilities', 'Water', 'water', 1),
    ('utilities', 'Gas', 'gas', 2),
    ('internet_mobile', 'Internet', 'internet', 0),
    ('internet_mobile', 'Mobile Plan', 'mobile_plan', 1),
    ('health', 'Doctor Visits', 'doctor_visits', 0),
    ('health', 'Pharmacy', 'pharmacy', 1),
    ('health', 'Insurance', 'insurance', 2),
    ('education', 'Tuition', 'tuition', 0),
    ('education', 'Books & Supplies', 'books_supplies', 1),
    ('education', 'Courses', 'courses', 2),
    ('family', 'Childcare', 'childcare', 0),
    ('family', 'Household Help', 'household_help', 1),
    ('shopping', 'Clothing', 'clothing', 0),
    ('shopping', 'Electronics', 'electronics', 1),
    ('shopping', 'Home Goods', 'home_goods', 2),
    ('entertainment', 'Movies & Events', 'movies_events', 0),
    ('entertainment', 'Hobbies', 'hobbies', 1),
    ('entertainment', 'Games & Apps', 'games_apps', 2),
    ('travel', 'Flights', 'flights', 0),
    ('travel', 'Hotels', 'hotels', 1),
    ('travel', 'Activities', 'activities', 2),
    ('subscriptions', 'Streaming', 'streaming', 0),
    ('subscriptions', 'Software', 'software', 1),
    ('subscriptions', 'Memberships', 'memberships', 2)
) as v(parent_slug, name, sub_slug, sort_order)
    on p.translation_key = v.parent_slug
where p.is_system = true
    and p.parent_id is null
    and p.category_type = 'expense'
on conflict do nothing;

-- (c) Insert the entire default income tree fresh for every existing
-- workspace (main categories, then their subcategories).
insert into public.categories (workspace_id, category_type, name, translation_key, is_system, sort_order)
select w.id, 'income', v.name, v.slug, true, v.sort_order
from public.workspaces w
cross join (values
    ('Salary', 'salary', 0),
    ('Business Income', 'business_income', 1),
    ('Gifts', 'gifts', 2),
    ('Investment Returns', 'investment_returns', 3),
    ('Other Income', 'other_income', 4)
) as v(name, slug, sort_order)
on conflict do nothing;

insert into public.categories (workspace_id, category_type, parent_id, name, translation_key, is_system, sort_order)
select p.workspace_id, 'income', p.id, v.name, p.translation_key || '.' || v.sub_slug, true, v.sort_order
from public.categories p
join (values
    ('salary', 'Primary Job', 'primary_job', 0),
    ('salary', 'Bonus & Commission', 'bonus_commission', 1),
    ('business_income', 'Sales Revenue', 'sales_revenue', 0),
    ('business_income', 'Services Revenue', 'services_revenue', 1),
    ('investment_returns', 'Dividends', 'dividends', 0),
    ('investment_returns', 'Interest', 'interest', 1)
) as v(parent_slug, name, sub_slug, sort_order)
    on p.translation_key = v.parent_slug
where p.category_type = 'income'
    and p.parent_id is null
on conflict do nothing;
