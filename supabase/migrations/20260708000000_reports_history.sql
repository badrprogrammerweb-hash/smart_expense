create table if not exists public.activity_history (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    event_type text not null check (event_type in (
        'income_created','income_updated','income_deleted',
        'expense_created','expense_updated','expense_deleted',
        'category_created','category_updated','category_archived',
        'file_uploaded','file_deleted',
        'extraction_started','extraction_completed','extraction_failed',
        'ai_draft_confirmed',
        'member_added','member_removed','role_changed',
        'setting_changed'
    )),
    actor_user_id uuid references public.user_profiles(id) on delete set null,
    entity_table text not null,
    entity_id uuid,
    summary jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists activity_history_ws_created_idx
    on public.activity_history (workspace_id, created_at desc, id desc);

create or replace function public.record_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
        if tg_op = 'INSERT' then
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
$$;

alter function public.record_activity() owner to postgres;
revoke all on function public.record_activity() from public, anon;

drop trigger if exists incomes_record_activity on public.incomes;
create trigger incomes_record_activity
after insert or update or delete on public.incomes
for each row execute function public.record_activity();

drop trigger if exists expenses_record_activity on public.expenses;
create trigger expenses_record_activity
after insert or update or delete on public.expenses
for each row execute function public.record_activity();

drop trigger if exists categories_record_activity on public.categories;
create trigger categories_record_activity
after insert or update or delete on public.categories
for each row execute function public.record_activity();

drop trigger if exists files_record_activity on public.files;
create trigger files_record_activity
after insert or update or delete on public.files
for each row execute function public.record_activity();

drop trigger if exists ai_extractions_record_activity on public.ai_extractions;
create trigger ai_extractions_record_activity
after insert or update or delete on public.ai_extractions
for each row execute function public.record_activity();

drop trigger if exists workspace_memberships_record_activity on public.workspace_memberships;
create trigger workspace_memberships_record_activity
after insert or update or delete on public.workspace_memberships
for each row execute function public.record_activity();

drop trigger if exists workspaces_record_activity on public.workspaces;
create trigger workspaces_record_activity
after update of auto_delete_after_extraction on public.workspaces
for each row execute function public.record_activity();

drop trigger if exists workspace_ai_settings_record_activity on public.workspace_ai_settings;
create trigger workspace_ai_settings_record_activity
after insert or update or delete on public.workspace_ai_settings
for each row execute function public.record_activity();

alter table public.activity_history enable row level security;

drop policy if exists "Owners/Admins can view history" on public.activity_history;
create policy "Owners/Admins can view history"
on public.activity_history
for select
to authenticated
using (public.workspace_role_for(workspace_id, auth.uid()) in ('owner', 'admin'));

revoke all on public.activity_history from anon;
revoke insert, update, delete on public.activity_history from authenticated;
grant select on public.activity_history to authenticated;
