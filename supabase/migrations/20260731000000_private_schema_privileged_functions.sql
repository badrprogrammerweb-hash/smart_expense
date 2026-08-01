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

-- DO NOT revoke EXECUTE on public.workspace_role_for / public.is_workspace_member
-- from `authenticated`. Every RLS policy in this database calls them AS THE
-- REQUESTING USER (~55 references; see specs/018-.../data-model.md). Revoking
-- EXECUTE disables tenant isolation on every table and takes the product down.
-- Those two helpers are deliberately NOT relocated in this phase — see
-- specs/018-.../research.md R-003.
