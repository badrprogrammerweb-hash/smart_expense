-- Phase 18 follow-up: make Supabase Auth user deletion possible.
--
-- Deleting any user from Supabase Auth (Dashboard -> Authentication -> Users,
-- or the Admin API) failed with the generic "Database error deleting user".
-- The underlying cause was two guards that fire during the cascade teardown
-- `auth.users -> user_profiles -> workspaces / workspace_memberships -> ...`
-- and were never written with that path in mind. Both blocked *every* account,
-- including one with no records at all.
--
--   1. `protect_last_workspace_owner()` (20260624000000) raises
--      `last_owner_protected` whenever the last owner membership of a workspace
--      is deleted. Every user is the sole owner of their own personal
--      workspace, so the very first cascade step always raised. Reproduced:
--
--        ERROR:  P0001: last_owner_protected
--        CONTEXT: PL/pgSQL function protect_last_workspace_owner() line 13
--        SQL statement "DELETE FROM ONLY "public"."workspace_memberships"
--                       WHERE $1 OPERATOR(pg_catalog.=) "user_id""
--
--   2. `record_activity()` (20260708000000, current body 20260722000000) is an
--      AFTER ROW trigger. Postgres queues AFTER triggers until the end of the
--      statement, by which point the cascade has already removed the owning
--      workspace, so its `activity_history` INSERT violates the FK to
--      `workspaces`. Reproduced (with defect 1 patched out):
--
--        ERROR:  insert or update on table "activity_history" violates foreign
--                key constraint "activity_history_workspace_id_fkey"
--        DETAIL: Key (workspace_id)=(...) is not present in table "workspaces".
--
-- Fixing those two makes teardown succeed -- and thereby makes a third,
-- previously unreachable path reachable: `workspaces.created_by` is
-- `on delete cascade`, so deleting the creator of a *team* workspace destroys
-- that workspace together with every other member's incomes, expenses, files,
-- categories and history. Guard 3 below refuses that teardown outright rather
-- than let the fix open a silent shared-data-loss path. Deciding what should
-- happen to a departing user's records inside a workspace other people still
-- use is a product decision (transfer ownership / anonymise authorship /
-- retain), and is deliberately NOT made here.
--
-- Scope note: `incomes.created_by`, `expenses.created_by` and
-- `files.uploaded_by` are `on delete restrict`, and `ai_extractions.*_by` /
-- `workspace_ai_settings.updated_by` are `no action`. Those are intentional
-- protections for financial and audit records and are left untouched, so a
-- user who has ever recorded an income, expense or file still cannot be
-- deleted. That is the missing account-deletion workflow, not a defect in the
-- cascade, and it is out of scope for this migration.


-- =====================================================================
-- Fix 1: do not enforce the last-owner invariant during account teardown
-- =====================================================================
--
-- The invariant exists to stop a *surviving* workspace from being left without
-- an owner: the API's "remove member" and "leave workspace" paths
-- (apps/api/app/routes/workspace_members.py, which maps the exception to HTTP
-- 409 `last_owner_protected`). In both of those the membership row goes away
-- while the workspace and the member's `user_profiles` row both remain, so the
-- guard below still applies to them unchanged.
--
-- It has nothing to say about a teardown, where the workspace is being
-- destroyed anyway or the member no longer exists as a user. Two escape
-- conditions are needed because the two referential actions that reach
-- `workspace_memberships` fire in an unspecified order:
--
--   * `workspaces.id`  cascade -> the workspace row is already gone
--   * `user_profiles.id` cascade -> the profile row is already gone
--     (RI cascades run as AFTER DELETE triggers on the parent, so the parent
--     row is committed-deleted by the time the child DELETE runs)
--
-- This mirrors the escape hatch `prevent_referenced_category_delete()` already
-- carries for the same teardown path (20260722000000, part 6).
create or replace function public.protect_last_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    owner_count integer;
begin
    if tg_op = 'DELETE'
       and (
            not exists (select 1 from public.workspaces w where w.id = old.workspace_id)
            or not exists (select 1 from public.user_profiles up where up.id = old.user_id)
       ) then
        return old;
    end if;

    if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
        select count(*)
        into owner_count
        from public.workspace_memberships
        where workspace_id = old.workspace_id
          and role = 'owner';

        if owner_count <= 1 then
            raise exception 'last_owner_protected';
        end if;
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;
end;
$$;


-- =====================================================================
-- Fix 2: do not write history for a workspace that no longer exists
-- =====================================================================
--
-- Identical body to 20260722000000 apart from the guard inserted right after
-- `begin`. The guard is a no-op for every path except teardown: on a DELETE
-- whose owning workspace is already gone, the `activity_history` row could not
-- be inserted (FK violation) and would in any case have been removed
-- immediately by `activity_history.workspace_id`'s own cascade. Skipping the
-- write is therefore behaviour-preserving, not a loss of audit history.
--
-- Deliberately preserved: when a member leaves or is removed from a workspace
-- that *survives* -- including when they delete their own account -- the
-- `member_removed` event is still recorded in that workspace's history.
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
    v_teardown_workspace_id uuid;
begin
    -- Teardown guard. Every table this trigger is attached to carries a
    -- `workspace_id` except `workspaces` itself, whose trigger is
    -- AFTER UPDATE OF auto_delete_after_extraction only (the DELETE branch is
    -- unreachable and kept purely for symmetry with the block below).
    --
    -- The column is selected with plpgsql IF branches rather than a single SQL
    -- `case ... end` expression on purpose. A SQL CASE is planned as a whole,
    -- so *both* arms must resolve against the trigger's OLD record even though
    -- only one is evaluated -- and `workspace_ai_settings` has no `id` column
    -- (its primary key is `workspace_id`), which makes `old.id` a hard
    -- "record \"old\" has no field \"id\"" error on every DELETE from that
    -- table. plpgsql plans each branch lazily on first execution instead, so
    -- the untaken arm is never resolved. The block below relies on the same
    -- property.
    if tg_op = 'DELETE' then
        if tg_table_name = 'workspaces' then
            v_teardown_workspace_id := old.id;
        else
            v_teardown_workspace_id := old.workspace_id;
        end if;

        if not exists (
            select 1 from public.workspaces w where w.id = v_teardown_workspace_id
        ) then
            return old;
        end if;
    end if;

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

-- Unchanged from 20260708000000: this function writes rows that `authenticated`
-- may not insert directly, so it stays owned by postgres and unexecutable by
-- public/anon. Re-asserted here because CREATE OR REPLACE keeps the existing
-- owner and ACL, and this makes that explicit rather than assumed.
alter function public.record_activity() owner to postgres;
revoke all on function public.record_activity() from public, anon;


-- =====================================================================
-- Fix 3: refuse to tear down a team workspace other people are still in
-- =====================================================================
--
-- With fixes 1 and 2 in place the teardown reaches `workspaces.created_by`,
-- which is `on delete cascade`. For a personal workspace that is correct and
-- self-contained: it has exactly one member by construction
-- (`enforce_workspace_membership_limits`), and everything in it belongs to the
-- departing user. For a *team* workspace it is not: the cascade would remove
-- the workspace and, through it, every other member's incomes, expenses,
-- categories, files, extractions and history -- data those users created and
-- still rely on, in a workspace they are still members of.
--
-- Note that `incomes/expenses/files`'s `on delete restrict` does NOT protect
-- against this. Restrict fires on the *record author's* profile being deleted;
-- here the author survives and the records are removed through
-- `workspace_id`'s cascade instead. So the protection is asymmetric: a member
-- who wrote an expense in a shared workspace cannot delete their account, but
-- the workspace's creator can delete theirs and take that same expense with
-- it. This guard closes that asymmetry in the safe direction.
--
-- The intended resolution is an account-deletion workflow that transfers or
-- explicitly disposes of shared workspaces first. Until that exists, a clear
-- error is strictly better than silent destruction.
--
-- Scope: `public.user_profiles` has RLS enabled and carries only SELECT and
-- UPDATE policies -- there is no DELETE (or ALL) policy for `authenticated` or
-- `anon`. With RLS on and no permissive DELETE policy, a DELETE issued by
-- either role matches zero rows, so application rows are only ever removed by
-- the `auth.users` cascade or by an administrator. This trigger therefore
-- governs account deletion exclusively and cannot be reached from the
-- application.
--
-- The invariant is deliberately stated in terms of RLS rather than table
-- grants. Whether `anon`/`authenticated` hold a table-level DELETE privilege on
-- a `public` table depends on which role created it: Supabase ships default
-- ACLs for schema `public` from two grantors, and they differ --
-- `supabase_admin`'s grants `arwdDxtm` (DELETE included) while `postgres`'s
-- grants `Dxtm` (DELETE excluded). A migration therefore lands with or without
-- that grant depending on how it was applied, which makes the grant an unstable
-- thing to assert on. RLS is the actual enforcement boundary here, and it is
-- identical in every environment.
create or replace function public.prevent_shared_workspace_teardown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    blocking_workspace_id uuid;
begin
    select w.id
    into blocking_workspace_id
    from public.workspaces w
    where w.created_by = old.id
      and w.type = 'team'
      and exists (
          select 1
          from public.workspace_memberships m
          where m.workspace_id = w.id
            and m.user_id is distinct from old.id
      )
    limit 1;

    if blocking_workspace_id is not null then
        -- foreign_key_violation: this is a referential-integrity refusal, and
        -- it keeps the failure in the same class Auth already surfaces for a
        -- blocked delete.
        raise exception 'shared_workspace_requires_transfer: workspace % still has other members', blocking_workspace_id
            using errcode = '23503';
    end if;

    return old;
end;
$$;

alter function public.prevent_shared_workspace_teardown() owner to postgres;
revoke all on function public.prevent_shared_workspace_teardown() from public, anon;

drop trigger if exists user_profiles_prevent_shared_workspace_teardown on public.user_profiles;
create trigger user_profiles_prevent_shared_workspace_teardown
before delete on public.user_profiles
for each row execute function public.prevent_shared_workspace_teardown();


-- =====================================================================
-- Post-conditions
-- =====================================================================
do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgname = 'user_profiles_prevent_shared_workspace_teardown'
          and tgrelid = 'public.user_profiles'::regclass
          and not tgisinternal
    ) then
        raise exception 'user_profiles_prevent_shared_workspace_teardown trigger missing';
    end if;

    -- The two patched bodies must carry their teardown escapes.
    if position('prevent_shared_workspace_teardown' in
                pg_get_functiondef('public.prevent_shared_workspace_teardown()'::regprocedure)) = 0 then
        raise exception 'prevent_shared_workspace_teardown body missing';
    end if;

    if position('from public.user_profiles up where up.id = old.user_id' in
                pg_get_functiondef('public.protect_last_workspace_owner()'::regprocedure)) = 0 then
        raise exception 'protect_last_workspace_owner teardown escape missing';
    end if;

    if position('Teardown guard' in
                pg_get_functiondef('public.record_activity()'::regprocedure)) = 0 then
        raise exception 'record_activity teardown guard missing';
    end if;

    -- The last-owner invariant must still be enforced for surviving workspaces.
    if position('last_owner_protected' in
                pg_get_functiondef('public.protect_last_workspace_owner()'::regprocedure)) = 0 then
        raise exception 'protect_last_workspace_owner no longer raises last_owner_protected';
    end if;

    -- `user_profiles` must remain undeletable from the application, so that
    -- `prevent_shared_workspace_teardown` governs account deletion only.
    --
    -- This is asserted through RLS, not through table grants: a table-level
    -- DELETE privilege for `anon`/`authenticated` is normal on hosted Supabase
    -- (see the note above `prevent_shared_workspace_teardown`) and proves
    -- nothing either way, because RLS is evaluated after the privilege check.
    -- The three conditions below are what actually make a DELETE from those
    -- roles match zero rows, and they hold identically in every environment.

    -- (a) RLS must be switched on at all.
    if not (select relrowsecurity from pg_class where oid = 'public.user_profiles'::regclass) then
        raise exception 'user_profiles does not have row level security enabled';
    end if;

    -- (b) No DELETE policy -- and no ALL policy, which would imply one -- may be
    --     reachable by an application role or by PUBLIC.
    if exists (
        select 1
        from pg_policy p
        where p.polrelid = 'public.user_profiles'::regclass
          and p.polcmd in ('d', '*')
          and (
              p.polroles = '{0}'::oid[]                     -- PUBLIC
              or 'anon'::regrole = any (p.polroles)
              or 'authenticated'::regrole = any (p.polroles)
          )
    ) then
        raise exception 'user_profiles exposes a DELETE-capable RLS policy to an application role';
    end if;

    -- (c) Neither application role may sidestep RLS: BYPASSRLS, or owning the
    --     table (an owner is exempt unless FORCE ROW LEVEL SECURITY is set).
    if exists (
        select 1 from pg_roles
        where rolname in ('anon', 'authenticated') and rolbypassrls
    ) then
        raise exception 'an application role holds BYPASSRLS';
    end if;

    if (select pg_get_userbyid(relowner) from pg_class where oid = 'public.user_profiles'::regclass)
       in ('anon', 'authenticated') then
        raise exception 'user_profiles is owned by an application role';
    end if;
end
$$;
