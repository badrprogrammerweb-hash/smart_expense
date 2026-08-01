-- Phase 18 rollback procedures.
-- Run only the section needed for the change being reversed. Each section is
-- independently runnable and must be reviewed against the target environment first.

-- ============================================================================
-- Section A: reverse Phase 3 privileged-function relocation
-- ============================================================================
-- Intended order: run this section alone to return the four routines to public,
-- restore their original effective grants, and restore handle_new_user's original
-- public-qualified dependency. Do not run Section B as a prerequisite.

begin;

do $$
begin
    if to_regprocedure('private.ensure_personal_workspace(uuid,text)') is not null
       and to_regprocedure('public.ensure_personal_workspace(uuid,text)') is null then
        alter function private.ensure_personal_workspace(uuid, text) set schema public;
    elsif to_regprocedure('public.ensure_personal_workspace(uuid,text)') is null then
        raise exception 'Cannot reverse ensure_personal_workspace(uuid,text): expected function is absent';
    end if;
end
$$;

do $$
begin
    if to_regprocedure('private.get_workspace_ai_key_for_extraction(uuid)') is not null
       and to_regprocedure('public.get_workspace_ai_key_for_extraction(uuid)') is null then
        alter function private.get_workspace_ai_key_for_extraction(uuid) set schema public;
    elsif to_regprocedure('public.get_workspace_ai_key_for_extraction(uuid)') is null then
        raise exception 'Cannot reverse get_workspace_ai_key_for_extraction(uuid): expected function is absent';
    end if;
end
$$;

do $$
begin
    if to_regprocedure('private.find_user_profile_by_email(text)') is not null
       and to_regprocedure('public.find_user_profile_by_email(text)') is null then
        alter function private.find_user_profile_by_email(text) set schema public;
    elsif to_regprocedure('public.find_user_profile_by_email(text)') is null then
        raise exception 'Cannot reverse find_user_profile_by_email(text): expected function is absent';
    end if;
end
$$;

do $$
begin
    if to_regprocedure('private.shares_workspace_with(uuid,uuid)') is not null
       and to_regprocedure('public.shares_workspace_with(uuid,uuid)') is null then
        alter function private.shares_workspace_with(uuid, uuid) set schema public;
    elsif to_regprocedure('public.shares_workspace_with(uuid,uuid)') is null then
        raise exception 'Cannot reverse shares_workspace_with(uuid,uuid): expected function is absent';
    end if;
end
$$;

revoke all on function public.ensure_personal_workspace(uuid, text) from public, anon;
grant execute on function public.ensure_personal_workspace(uuid, text) to authenticated;

revoke all on function public.get_workspace_ai_key_for_extraction(uuid) from public, anon;
grant execute on function public.get_workspace_ai_key_for_extraction(uuid) to authenticated;

revoke all on function public.find_user_profile_by_email(text) from public, anon;
grant execute on function public.find_user_profile_by_email(text) to authenticated;

revoke all on function public.shares_workspace_with(uuid, uuid) from public, anon;
grant execute on function public.shares_workspace_with(uuid, uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.ensure_personal_workspace(new.id, coalesce(new.email, ''));
    return new;
end;
$$;

commit;

-- ============================================================================
-- Section B: reverse the Phase 4 ensure_personal_workspace identity guard
-- ============================================================================
-- Intended order: run this section alone while the routine remains in private.
-- It removes only the Phase 4 identity check and does not reverse Phase 3 relocation.

begin;

create or replace function private.ensure_personal_workspace(target_user_id uuid, target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    existing_personal_id uuid;
begin
    insert into public.user_profiles(id, email)
    values (target_user_id, lower(btrim(target_email)))
    on conflict (id) do update
        set email = excluded.email
        where public.user_profiles.email is distinct from excluded.email;

    select id
    into existing_personal_id
    from public.workspaces
    where created_by = target_user_id
      and type = 'personal'
    order by created_at asc
    limit 1;

    if existing_personal_id is null then
        insert into public.workspaces(type, name, created_by)
        values ('personal', 'Personal Workspace', target_user_id);
    else
        update public.workspace_memberships
        set role = 'owner'
        where workspace_id = existing_personal_id
          and user_id = target_user_id
          and role is distinct from 'owner';

        insert into public.workspace_memberships(workspace_id, user_id, role)
        select existing_personal_id, target_user_id, 'owner'
        where not exists (
            select 1
            from public.workspace_memberships
            where workspace_id = existing_personal_id
              and user_id = target_user_id
        );
    end if;
end;
$$;

revoke all on function private.ensure_personal_workspace(uuid, text) from public, anon;
grant execute on function private.ensure_personal_workspace(uuid, text) to authenticated;

commit;
