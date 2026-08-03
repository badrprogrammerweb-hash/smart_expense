-- Phase 18 rollback procedures.
--
-- This file executes EXACTLY ONE rollback target per invocation. It must be run
-- with an explicit target; there is no default and there is no whole-file mode:
--
--   psql "$DISPOSABLE_DB_URL" -v rollback_target=phase3         -f rollback.sql
--   psql "$DISPOSABLE_DB_URL" -v rollback_target=identity_guard -f rollback.sql
--
-- A missing or unrecognized target aborts before any statement that could change
-- the database. The two targets are mutually exclusive by construction: psql skips
-- the untaken branch entirely, so they can never be composed in one run. Composing
-- them previously produced an invalid duplicate state (a guarded public copy plus an
-- unguarded private copy of ensure_personal_workspace) — see
-- contracts/security-regression-tests.md.
--
--   phase3          Reverse the Phase 3 privileged-function relocation ONLY.
--                   REQUIRES A COORDINATED APPLICATION ROLLBACK: the current
--                   application tree calls these routines private-qualified
--                   (app/core/auth.py, app/routes/workspace_members.py,
--                   app/services/ai_summary.py, app/services/extractions.py) and
--                   WILL NOT WORK unchanged against this target. Deploy a
--                   compatible application revision whose SQL calls use `public.`
--                   in the same change window.
--                   The Phase 4 identity guard is deliberately RETAINED.
--
--   identity_guard  Reverse the Phase 4 identity guard ONLY. All four Phase 3
--                   routines stay in `private`. The current application remains
--                   compatible; no application rollback is required.
--
-- Neither target reverses Phase 9 (20260732000000_private_schema_rls_helpers.sql).
-- `workspace_role_for` and `is_workspace_member` stay in `private` under both.
--
-- Test the selected target on a disposable database before any operational use.

\set ON_ERROR_STOP on

-- Substitute an invalid sentinel when the caller passed no target, so the
-- validation below reports the real problem instead of a psql parse error.
\if :{?rollback_target}
\else
\set rollback_target '<unset>'
\endif

-- Resolve the target. These comparisons are the only place the psql variable is
-- read; psql does not interpolate variables inside dollar-quoted bodies, so the
-- branch decision is made here and the sections below see only static SQL.
select (:'rollback_target' = 'phase3')                            as run_phase3,
       (:'rollback_target' = 'identity_guard')                    as run_identity_guard,
       (:'rollback_target' in ('phase3', 'identity_guard'))       as target_is_valid
\gset

-- Fail closed on a missing or unknown target. Nothing above this point changes
-- the database, so an invalid invocation exits non-zero with the database
-- untouched.
\if :target_is_valid
\else
\echo 'rollback.sql: missing or unknown rollback target:' :'rollback_target'
do $$
begin
    raise exception 'rollback.sql: missing or unknown rollback target'
        using errcode = '22023',
              detail = 'Valid targets: phase3 (reverse Phase 3 relocation), identity_guard (reverse Phase 4 guard).',
              hint = 'Re-run as: psql <db> -v rollback_target=phase3 -f rollback.sql';
end
$$;
\endif

-- ============================================================================
-- Target: phase3 — reverse the Phase 3 privileged-function relocation
-- ============================================================================
-- Returns the four routines to `public`, restores their original effective
-- grants, and restores handle_new_user's original public-qualified dependency.
-- The Phase 4 identity guard travels with the body and is retained by design; if
-- it has already been removed this target refuses to run, because the resulting
-- state would be neither the documented Phase 3 rollback target nor the
-- pre-Phase-18 state.

\if :run_phase3

begin;

-- Relocate each exact signature. An ambiguous state (copies in both schemas)
-- raises instead of silently no-opping, so a partially composed rollback can
-- never be mistaken for success.
do $$
declare
    targets text[][] := array[
        ['ensure_personal_workspace',           'uuid, text'],
        ['get_workspace_ai_key_for_extraction', 'uuid'],
        ['find_user_profile_by_email',          'text'],
        ['shares_workspace_with',               'uuid, uuid']
    ];
    fn              text;
    args            text;
    public_matches  integer;
    private_matches integer;
begin
    for i in 1 .. array_length(targets, 1) loop
        fn   := targets[i][1];
        args := targets[i][2];

        select count(*) into public_matches
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = fn
          and regexp_replace(
              pg_get_function_identity_arguments(p.oid),
              '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
          ) = args;

        select count(*) into private_matches
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private'
          and p.proname = fn
          and regexp_replace(
              pg_get_function_identity_arguments(p.oid),
              '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
          ) = args;

        if private_matches = 1 and public_matches = 0 then
            execute format('alter function private.%I(%s) set schema public', fn, args);
        elsif private_matches = 0 and public_matches = 1 then
            null;  -- already reversed; re-running this target is a no-op
        elsif private_matches = 0 and public_matches = 0 then
            raise exception 'rollback(phase3): %(%) exists in neither public nor private', fn, args;
        else
            raise exception 'rollback(phase3): ambiguous state for %(%): public=%, private=%. Refusing to proceed — resolve the duplicate manually.',
                fn, args, public_matches, private_matches;
        end if;
    end loop;
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

-- Fail the transaction if the intended end state was not reached.
do $$
declare
    targets text[][] := array[
        ['ensure_personal_workspace',           'uuid, text'],
        ['get_workspace_ai_key_for_extraction', 'uuid'],
        ['find_user_profile_by_email',          'text'],
        ['shares_workspace_with',               'uuid, uuid']
    ];
    fn              text;
    args            text;
    public_matches  integer;
    private_matches integer;
    target_oid      oid;
begin
    for i in 1 .. array_length(targets, 1) loop
        fn   := targets[i][1];
        args := targets[i][2];

        select count(*), min(p.oid) into public_matches, target_oid
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = fn
          and regexp_replace(
              pg_get_function_identity_arguments(p.oid),
              '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
          ) = args;

        select count(*) into private_matches
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private'
          and p.proname = fn
          and regexp_replace(
              pg_get_function_identity_arguments(p.oid),
              '(^|, )[[:alnum:]_"]+ ', '\1', 'g'
          ) = args;

        if public_matches <> 1 or private_matches <> 0 then
            raise exception 'rollback(phase3): invalid final state for %(%): public=%, private=%',
                fn, args, public_matches, private_matches;
        end if;

        if not has_function_privilege('authenticated', target_oid, 'EXECUTE')
           or has_function_privilege('anon', target_oid, 'EXECUTE')
           or exists (
               select 1
                 from pg_proc p,
                      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                where p.oid = target_oid
                  and acl.grantee = 0
                  and acl.privilege_type = 'EXECUTE'
           ) then
            raise exception 'rollback(phase3): invalid final ACL for public.%(%)', fn, args;
        end if;
    end loop;

    -- The Phase 4 guard is retained by this target, not reversed by it.
    if position('identity_mismatch' in
                pg_get_functiondef('public.ensure_personal_workspace(uuid,text)'::regprocedure)) = 0 then
        raise exception 'rollback(phase3): the Phase 4 identity guard is absent from public.ensure_personal_workspace. This target reverses relocation only and does not produce a pre-Phase-18 state.';
    end if;

    -- handle_new_user must depend on the public routine again.
    if position('public.ensure_personal_workspace' in
                pg_get_functiondef('public.handle_new_user()'::regprocedure)) = 0
       or position('private.ensure_personal_workspace' in
                pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0 then
        raise exception 'rollback(phase3): handle_new_user was not re-qualified to public.ensure_personal_workspace';
    end if;

    if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
        raise exception 'rollback(phase3): the on_auth_user_created trigger is missing';
    end if;

    -- Phase 9 is NOT reversed here, and the relocated-to-public
    -- get_workspace_ai_key_for_extraction body still calls private.workspace_role_for
    -- by name. Losing Phase 9 would break it at runtime, not at rollback time.
    if to_regprocedure('private.workspace_role_for(uuid,uuid)') is null then
        raise exception 'rollback(phase3): private.workspace_role_for(uuid,uuid) is absent. Phase 9 must remain in place for this target.';
    end if;
end
$$;

commit;

\endif

-- ============================================================================
-- Target: identity_guard — reverse the Phase 4 ensure_personal_workspace guard
-- ============================================================================
-- Removes only the Phase 4 identity check while the routine remains in `private`.
-- The body below is the exact pre-guard Phase 3 behavior, byte-identical to
-- 20260624000000_auth_workspace_foundation.sql:102-138 apart from the schema in
-- its header. Private placement, SECURITY DEFINER, search_path, and the Phase 3
-- grants are all preserved.

\if :run_identity_guard

begin;

-- Preconditions. `create or replace` would otherwise CREATE the routine when it
-- is absent from `private` — the exact defect that made whole-file execution
-- manufacture a duplicate.
create temporary table _rollback_identity_guard_precheck on commit drop as
select to_regprocedure('private.ensure_personal_workspace(uuid,text)')::oid as original_oid;

do $$
begin
    if to_regprocedure('private.ensure_personal_workspace(uuid,text)') is null then
        raise exception 'rollback(identity_guard): private.ensure_personal_workspace(uuid,text) does not exist. This target reverses the guard in place and must not create the routine; reverse Phase 3 with -v rollback_target=phase3 instead.';
    end if;
    if to_regprocedure('public.ensure_personal_workspace(uuid,text)') is not null then
        raise exception 'rollback(identity_guard): a public.ensure_personal_workspace(uuid,text) copy already exists. Refusing to proceed — resolve the duplicate manually.';
    end if;
end
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

-- Fail the transaction if the intended end state was not reached.
do $$
declare
    target_oid  oid;
    original_id oid;
begin
    select original_oid into original_id from _rollback_identity_guard_precheck;

    if to_regprocedure('public.ensure_personal_workspace(uuid,text)') is not null then
        raise exception 'rollback(identity_guard): a public duplicate of ensure_personal_workspace was created';
    end if;

    target_oid := to_regprocedure('private.ensure_personal_workspace(uuid,text)')::oid;
    if target_oid is null then
        raise exception 'rollback(identity_guard): private.ensure_personal_workspace(uuid,text) is missing after replacement';
    end if;
    if target_oid is distinct from original_id then
        raise exception 'rollback(identity_guard): ensure_personal_workspace OID changed during replacement';
    end if;

    if position('identity_mismatch' in pg_get_functiondef(target_oid)) > 0 then
        raise exception 'rollback(identity_guard): the identity guard is still present';
    end if;

    if not has_function_privilege('authenticated', target_oid, 'EXECUTE')
       or has_function_privilege('anon', target_oid, 'EXECUTE')
       or exists (
           select 1
             from pg_proc p,
                  lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
            where p.oid = target_oid
              and acl.grantee = 0
              and acl.privilege_type = 'EXECUTE'
       ) then
        raise exception 'rollback(identity_guard): invalid final ACL for private.ensure_personal_workspace(uuid,text)';
    end if;

    -- Relocation is NOT reversed by this target.
    if to_regprocedure('private.get_workspace_ai_key_for_extraction(uuid)') is null
       or to_regprocedure('private.find_user_profile_by_email(text)') is null
       or to_regprocedure('private.shares_workspace_with(uuid,uuid)') is null then
        raise exception 'rollback(identity_guard): the Phase 3 relocation was altered; this target must leave all four routines in private';
    end if;

    if position('private.ensure_personal_workspace' in
                pg_get_functiondef('public.handle_new_user()'::regprocedure)) = 0 then
        raise exception 'rollback(identity_guard): handle_new_user no longer calls private.ensure_personal_workspace';
    end if;

    if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
        raise exception 'rollback(identity_guard): the on_auth_user_created trigger is missing';
    end if;
end
$$;

commit;

\endif
