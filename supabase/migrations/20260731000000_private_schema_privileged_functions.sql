create schema if not exists private;

grant usage on schema private to authenticated;

do $$
declare
    public_matches integer;
    private_matches integer;
begin
    select count(*) into public_matches
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'ensure_personal_workspace'
      and regexp_replace(
          pg_get_function_identity_arguments(p.oid),
          '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
      ) = 'uuid, text';

    select count(*) into private_matches
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'ensure_personal_workspace'
      and regexp_replace(
          pg_get_function_identity_arguments(p.oid),
          '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
      ) = 'uuid, text';

    if public_matches = 1 and private_matches = 0 then
        alter function public.ensure_personal_workspace(uuid, text) set schema private;
    elsif public_matches = 0 and private_matches = 1 then
        null;
    elsif public_matches = 0 and private_matches = 0 then
        raise exception 'Expected function ensure_personal_workspace(uuid,text) exists in neither public nor private schema';
    else
        raise exception 'Ambiguous function state for ensure_personal_workspace(uuid,text): public=%, private=%',
            public_matches, private_matches;
    end if;
end
$$;

do $$
declare
    public_matches integer;
    private_matches integer;
begin
    select count(*) into public_matches
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_workspace_ai_key_for_extraction'
      and regexp_replace(
          pg_get_function_identity_arguments(p.oid),
          '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
      ) = 'uuid';

    select count(*) into private_matches
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'get_workspace_ai_key_for_extraction'
      and regexp_replace(
          pg_get_function_identity_arguments(p.oid),
          '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
      ) = 'uuid';

    if public_matches = 1 and private_matches = 0 then
        alter function public.get_workspace_ai_key_for_extraction(uuid) set schema private;
    elsif public_matches = 0 and private_matches = 1 then
        null;
    elsif public_matches = 0 and private_matches = 0 then
        raise exception 'Expected function get_workspace_ai_key_for_extraction(uuid) exists in neither public nor private schema';
    else
        raise exception 'Ambiguous function state for get_workspace_ai_key_for_extraction(uuid): public=%, private=%',
            public_matches, private_matches;
    end if;
end
$$;

do $$
declare
    public_matches integer;
    private_matches integer;
begin
    select count(*) into public_matches
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'find_user_profile_by_email'
      and regexp_replace(
          pg_get_function_identity_arguments(p.oid),
          '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
      ) = 'text';

    select count(*) into private_matches
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'find_user_profile_by_email'
      and regexp_replace(
          pg_get_function_identity_arguments(p.oid),
          '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
      ) = 'text';

    if public_matches = 1 and private_matches = 0 then
        alter function public.find_user_profile_by_email(text) set schema private;
    elsif public_matches = 0 and private_matches = 1 then
        null;
    elsif public_matches = 0 and private_matches = 0 then
        raise exception 'Expected function find_user_profile_by_email(text) exists in neither public nor private schema';
    else
        raise exception 'Ambiguous function state for find_user_profile_by_email(text): public=%, private=%',
            public_matches, private_matches;
    end if;
end
$$;

do $$
declare
    public_matches integer;
    private_matches integer;
begin
    select count(*) into public_matches
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'shares_workspace_with'
      and regexp_replace(
          pg_get_function_identity_arguments(p.oid),
          '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
      ) = 'uuid, uuid';

    select count(*) into private_matches
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'shares_workspace_with'
      and regexp_replace(
          pg_get_function_identity_arguments(p.oid),
          '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
      ) = 'uuid, uuid';

    if public_matches = 1 and private_matches = 0 then
        alter function public.shares_workspace_with(uuid, uuid) set schema private;
    elsif public_matches = 0 and private_matches = 1 then
        null;
    elsif public_matches = 0 and private_matches = 0 then
        raise exception 'Expected function shares_workspace_with(uuid,uuid) exists in neither public nor private schema';
    else
        raise exception 'Ambiguous function state for shares_workspace_with(uuid,uuid): public=%, private=%',
            public_matches, private_matches;
    end if;
end
$$;

revoke all on function private.ensure_personal_workspace(uuid, text) from public, anon;
grant execute on function private.ensure_personal_workspace(uuid, text) to authenticated;

revoke all on function private.get_workspace_ai_key_for_extraction(uuid) from public, anon;
grant execute on function private.get_workspace_ai_key_for_extraction(uuid) to authenticated;

revoke all on function private.find_user_profile_by_email(text) from public, anon;
grant execute on function private.find_user_profile_by_email(text) to authenticated;

revoke all on function private.shares_workspace_with(uuid, uuid) from public, anon;
grant execute on function private.shares_workspace_with(uuid, uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
    perform private.ensure_personal_workspace(new.id, coalesce(new.email, ''));
    return new;
end;
$$;

create or replace function private.ensure_personal_workspace(target_user_id uuid, target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    existing_personal_id uuid;
begin
    -- Defence in depth: relocation is the primary control, but it depends on the
    -- hosted project's exposed-schema setting, which lives outside version control.
    -- NULL-tolerant on purpose: handle_new_user() invokes this from an AFTER INSERT
    -- trigger on auth.users, where there is no request context and auth.uid() is NULL.
    -- `is distinct from` (not <>) so a NULL target_user_id compares safely.
    if auth.uid() is not null
       and auth.uid() is distinct from target_user_id then
        raise exception 'identity_mismatch'
            using errcode = '42501';
    end if;

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

-- DO NOT revoke EXECUTE on public.workspace_role_for / public.is_workspace_member
-- from `authenticated`. Every RLS policy in this database calls them AS THE
-- REQUESTING USER (~55 references; see specs/018-.../data-model.md). Revoking
-- EXECUTE disables tenant isolation on every table and takes the product down.
-- Those two helpers are deliberately NOT relocated in this phase — see
-- specs/018-.../research.md R-003.
