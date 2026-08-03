-- Phase 18, Phase 9: remove the two RLS helpers from PostgREST's published
-- public schema while preserving their OIDs, policy dependencies, behavior,
-- and authenticated execution posture.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Relocate only the exact workspace_role_for(uuid,uuid) signature. ALTER
-- FUNCTION preserves the function OID, so pg_policy dependencies follow it.
do $$
declare
    public_matches integer;
    private_matches integer;
    original_oid oid;
begin
    select count(*), min(p.oid)
      into public_matches, original_oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'workspace_role_for'
       and regexp_replace(
           pg_get_function_identity_arguments(p.oid),
           '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
       ) = 'uuid, uuid';

    select count(*)
      into private_matches
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'workspace_role_for'
       and regexp_replace(
           pg_get_function_identity_arguments(p.oid),
           '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
       ) = 'uuid, uuid';

    if public_matches = 1 and private_matches = 0 then
        alter function public.workspace_role_for(uuid, uuid) set schema private;
        if to_regprocedure('private.workspace_role_for(uuid,uuid)')::oid
           is distinct from original_oid then
            raise exception 'workspace_role_for(uuid,uuid) OID changed during relocation';
        end if;
    elsif public_matches = 0 and private_matches = 1 then
        null;
    elsif public_matches = 0 and private_matches = 0 then
        raise exception 'Expected function workspace_role_for(uuid,uuid) exists in neither public nor private schema';
    else
        raise exception 'Ambiguous function state for workspace_role_for(uuid,uuid): public=%, private=%',
            public_matches, private_matches;
    end if;
end
$$;

-- Relocate only the exact is_workspace_member(uuid,uuid) signature. Its RLS
-- policy dependencies are likewise OID-bound and follow the relocation.
do $$
declare
    public_matches integer;
    private_matches integer;
    original_oid oid;
begin
    select count(*), min(p.oid)
      into public_matches, original_oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'is_workspace_member'
       and regexp_replace(
           pg_get_function_identity_arguments(p.oid),
           '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
       ) = 'uuid, uuid';

    select count(*)
      into private_matches
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname = 'is_workspace_member'
       and regexp_replace(
           pg_get_function_identity_arguments(p.oid),
           '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
       ) = 'uuid, uuid';

    if public_matches = 1 and private_matches = 0 then
        alter function public.is_workspace_member(uuid, uuid) set schema private;
        if to_regprocedure('private.is_workspace_member(uuid,uuid)')::oid
           is distinct from original_oid then
            raise exception 'is_workspace_member(uuid,uuid) OID changed during relocation';
        end if;
    elsif public_matches = 0 and private_matches = 1 then
        null;
    elsif public_matches = 0 and private_matches = 0 then
        raise exception 'Expected function is_workspace_member(uuid,uuid) exists in neither public nor private schema';
    else
        raise exception 'Ambiguous function state for is_workspace_member(uuid,uuid): public=%, private=%',
            public_matches, private_matches;
    end if;
end
$$;

revoke all on function private.workspace_role_for(uuid, uuid) from public, anon;
grant execute on function private.workspace_role_for(uuid, uuid) to authenticated;

revoke all on function private.is_workspace_member(uuid, uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid, uuid) to authenticated;

-- PL/pgSQL and SQL body references are name-bound at execution time rather
-- than tracked like pg_policy dependencies, so all five live bodies are
-- recreated with the relocated helper qualified explicitly.
create or replace function private.is_workspace_member(target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select private.workspace_role_for(target_workspace_id, target_user_id) is not null;
$$;

create or replace function public.set_workspace_ai_key(
    p_workspace_id uuid,
    p_provider     text,
    p_api_key      text
)
returns table (
    provider    text,
    key_last4   text,
    updated_by  uuid,
    updated_at  timestamptz
)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v_secret_id uuid;
begin
    if private.workspace_role_for(p_workspace_id, auth.uid()) is distinct from 'owner' then
        raise exception 'not_owner' using errcode = '42501';
    end if;

    if p_provider not in ('gemini', 'openai') then
        raise exception 'invalid_provider' using errcode = '22023';
    end if;
    if p_api_key is null or length(btrim(p_api_key)) = 0 then
        raise exception 'empty_key' using errcode = '22023';
    end if;

    select s.vault_secret_id
      into v_secret_id
      from public.workspace_ai_settings s
     where s.workspace_id = p_workspace_id
     for update;

    if v_secret_id is null then
        v_secret_id := vault.create_secret(
            p_api_key,
            'workspace_ai_key:' || p_workspace_id::text,
            'BYOK provider key'
        );

        insert into public.workspace_ai_settings (
            workspace_id,
            provider,
            vault_secret_id,
            key_last4,
            updated_by
        )
        values (
            p_workspace_id,
            p_provider,
            v_secret_id,
            right(p_api_key, 4),
            auth.uid()
        );
    else
        perform vault.update_secret(
            v_secret_id,
            p_api_key,
            'workspace_ai_key:' || p_workspace_id::text,
            'BYOK provider key'
        );

        update public.workspace_ai_settings s
           set provider = p_provider,
               key_last4 = right(p_api_key, 4),
               updated_by = auth.uid(),
               updated_at = now()
         where s.workspace_id = p_workspace_id;
    end if;

    return query
        select s.provider, s.key_last4, s.updated_by, s.updated_at
          from public.workspace_ai_settings s
         where s.workspace_id = p_workspace_id;
end;
$$;

create or replace function public.clear_workspace_ai_key(
    p_workspace_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v_secret_id uuid;
begin
    if private.workspace_role_for(p_workspace_id, auth.uid()) is distinct from 'owner' then
        raise exception 'not_owner' using errcode = '42501';
    end if;

    select s.vault_secret_id
      into v_secret_id
      from public.workspace_ai_settings s
     where s.workspace_id = p_workspace_id
     for update;

    if v_secret_id is null then
        return false;
    end if;

    delete from vault.secrets where id = v_secret_id;
    delete from public.workspace_ai_settings where workspace_id = p_workspace_id;
    return true;
end;
$$;

create or replace function private.get_workspace_ai_key_for_extraction(
    p_workspace_id uuid
)
returns table (
    provider text,
    api_key  text
)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v_role text;
begin
    -- Owner/Admin/Member only -- the same set that may trigger extraction.
    -- A Viewer (or non-member) is rejected here even though Viewers can
    -- never reach this call through the app (defense in depth). FR-005.
    -- NOTE: `workspace_role_for` returns NULL for a non-member, and a plain
    -- `NOT IN` against NULL evaluates to NULL (neither true nor false), so
    -- plpgsql's `IF` would silently skip the raise and leak the key to a
    -- non-member. Assign to a variable and check IS NULL explicitly instead
    -- (mirrors Phase 7's `IS DISTINCT FROM` null-safety for the same reason).
    v_role := private.workspace_role_for(p_workspace_id, auth.uid());
    if v_role is null or v_role not in ('owner', 'admin', 'member') then
        raise exception 'not_authorized' using errcode = '42501';
    end if;

    return query
        select s.provider, d.decrypted_secret
          from public.workspace_ai_settings s
          join vault.decrypted_secrets d on d.id = s.vault_secret_id
         where s.workspace_id = p_workspace_id;
    -- Zero rows = BYOK not configured for this workspace; the backend maps
    -- that to FR-002's "ai_not_configured" response. This function does not
    -- raise for that case -- only for unauthorized access.
end;
$$;

create or replace function public.confirm_ai_extraction(
    p_extraction_id uuid,
    p_amount_minor  bigint,
    p_occurred_on   date,
    p_category_id   uuid,
    p_merchant_name text,
    p_description   text
)
returns table (
    expense_id           uuid,
    should_delete_binary boolean,
    storage_path         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_workspace_id   uuid;
    v_file_id        uuid;
    v_status         text;
    v_triggered_by   uuid;
    v_role           text;
    v_expense_id     uuid;
    v_auto_delete    boolean;
    v_storage_path   text;
    v_currency       text;
begin
    -- `for update` locks the row so a second concurrent confirm call (e.g. a
    -- double-click or two admins racing) blocks here until the first commits,
    -- then re-reads the now-committed status and hits the already_resolved
    -- check below instead of racing past it and inserting a duplicate
    -- expense (mirrors Phase 7's set_workspace_ai_key/clear_workspace_ai_key
    -- locking pattern for the same race shape).
    select workspace_id, file_id, status, triggered_by
      into v_workspace_id, v_file_id, v_status, v_triggered_by
      from public.ai_extractions
     where id = p_extraction_id
     for update;

    v_role := private.workspace_role_for(v_workspace_id, auth.uid());

    if v_workspace_id is null or v_role is null then
        raise exception 'not_found' using errcode = 'P0002';  -- hide existence, mirrors Phase 7 convention
    end if;

    if v_status <> 'ready_for_review' then
        raise exception 'already_resolved' using errcode = '22023';
    end if;

    if not (v_role in ('owner', 'admin') or (v_role = 'member' and v_triggered_by = auth.uid())) then
        raise exception 'not_authorized' using errcode = '42501';
    end if;

    if p_amount_minor is null or p_amount_minor <= 0 then
        raise exception 'invalid_amount' using errcode = '22023';
    end if;
    if p_occurred_on is null then
        raise exception 'invalid_date' using errcode = '22023';
    end if;

    select currency into v_currency from public.workspaces where id = v_workspace_id;

    insert into public.expenses
        (workspace_id, created_by, category_id, amount_minor, currency, occurred_on, description, merchant_name)
    values
        (v_workspace_id, auth.uid(), p_category_id, p_amount_minor, v_currency, p_occurred_on, p_description, p_merchant_name)
    returning id into v_expense_id;
    -- existing validate_expense_category trigger fires unchanged here.

    update public.files set expense_id = v_expense_id where id = v_file_id;

    select auto_delete_after_extraction into v_auto_delete
      from public.workspaces where id = v_workspace_id;

    if v_auto_delete then
        -- Qualified with the table alias: `storage_path` alone is ambiguous
        -- here between this column and the function's own `storage_path`
        -- OUT parameter (from `returns table (..., storage_path text)`),
        -- which plpgsql treats as an implicit local variable of the same
        -- name.
        select f.storage_path into v_storage_path from public.files f where f.id = v_file_id;
        update public.files
           set status = 'deleted', deleted_at = now(), deleted_by = auth.uid()
         where id = v_file_id;
    end if;

    update public.ai_extractions
       set status = 'confirmed',
           expense_id = v_expense_id,
           confirmed_by = auth.uid(),
           confirmed_at = now(),
           updated_at = now()
     where id = p_extraction_id
       and status = 'ready_for_review';  -- idempotency guard: duplicate/concurrent confirm no-ops here

    return query select v_expense_id, coalesce(v_auto_delete, false), v_storage_path;
end;
$$;

-- Residual posture cleanup: these helpers remain public because existing
-- policy/trigger callers resolve them there, but only authenticated may invoke
-- either exact signature directly.
revoke all on function public.receipt_object_workspace_id(text) from public, anon;
grant execute on function public.receipt_object_workspace_id(text) to authenticated;

revoke all on function public.validate_category_assignment(uuid, uuid, text) from public, anon;
grant execute on function public.validate_category_assignment(uuid, uuid, text) to authenticated;

-- Fail the migration if its exact final catalog/body invariants were not met.
do $$
declare
    helper_name text;
    helper_oid oid;
    helper_definition text;
    public_matches integer;
    private_matches integer;
begin
    foreach helper_name in array array['workspace_role_for', 'is_workspace_member']
    loop
        select count(*) into public_matches
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = helper_name
           and regexp_replace(
               pg_get_function_identity_arguments(p.oid),
               '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
           ) = 'uuid, uuid';

        select count(*), min(p.oid)
          into private_matches, helper_oid
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'private'
           and p.proname = helper_name
           and regexp_replace(
               pg_get_function_identity_arguments(p.oid),
               '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
           ) = 'uuid, uuid';

        if public_matches <> 0 or private_matches <> 1 then
            raise exception 'Invalid final schema state for %(uuid,uuid): public=%, private=%',
                helper_name, public_matches, private_matches;
        end if;
        if not has_function_privilege('authenticated', helper_oid, 'EXECUTE')
           or has_function_privilege('anon', helper_oid, 'EXECUTE')
           or exists (
               select 1
                 from pg_proc p,
                      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                where p.oid = helper_oid
                  and acl.grantee = 0
                  and acl.privilege_type = 'EXECUTE'
           ) then
            raise exception 'Invalid final ACL for private.%(uuid,uuid)', helper_name;
        end if;
    end loop;

    foreach helper_oid in array array[
        'private.is_workspace_member(uuid,uuid)'::regprocedure::oid,
        'public.set_workspace_ai_key(uuid,text,text)'::regprocedure::oid,
        'public.clear_workspace_ai_key(uuid)'::regprocedure::oid,
        'private.get_workspace_ai_key_for_extraction(uuid)'::regprocedure::oid,
        'public.confirm_ai_extraction(uuid,bigint,date,uuid,text,text)'::regprocedure::oid
    ]
    loop
        helper_definition := pg_get_functiondef(helper_oid);
        if position('private.workspace_role_for' in helper_definition) = 0
           or position('public.workspace_role_for' in helper_definition) > 0 then
            raise exception 'Dependent function % was not requalified to private.workspace_role_for',
                helper_oid::regprocedure;
        end if;
    end loop;

    foreach helper_oid in array array[
        'public.receipt_object_workspace_id(text)'::regprocedure::oid,
        'public.validate_category_assignment(uuid,uuid,text)'::regprocedure::oid
    ]
    loop
        if not has_function_privilege('authenticated', helper_oid, 'EXECUTE')
           or has_function_privilege('anon', helper_oid, 'EXECUTE')
           or exists (
               select 1
                 from pg_proc p,
                      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                where p.oid = helper_oid
                  and acl.grantee = 0
                  and acl.privilege_type = 'EXECUTE'
           ) then
            raise exception 'Invalid final ACL for %', helper_oid::regprocedure;
        end if;
    end loop;
end
$$;
