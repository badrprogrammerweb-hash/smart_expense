# Contract: Private-Schema Migration

**Feature**: `018-security-remediation-hardening` | **Date**: 2026-07-30

Target file: `supabase/migrations/20260731000000_private_schema_privileged_functions.sql`
(one migration, no others).

---

## Proof obligations — MUST be discharged before this migration is authored

Spec FR-015. The entire design rests on one PostgreSQL behaviour and one failure mode. Both are
proven on a **disposable** database (a scratch database or a container that is thrown away), never
against the developer's working database.

### P-1 — RLS policy expressions are OID-bound and follow a relocated function

```sql
create schema if not exists proof_a;
create table t (id int, owner text);
alter table t enable row level security;
create function public.p_helper(x text) returns boolean language sql stable as $$ select x = 'ok' $$;
create policy t_sel on t for select using (public.p_helper(owner));
-- relocate
alter function public.p_helper(text) set schema proof_a;
-- EXPECT: the policy still exists, still enforces, and now renders as proof_a.p_helper(...)
select polname, pg_get_expr(polqual, polrelid) from pg_policy where polname = 't_sel';
```

**Expected**: qualified name shows `proof_a.p_helper`, and a `select` still filters correctly.
**If this fails**, abandon the "policies auto-follow" design and use fallback F-1 below.

### P-2 — Function bodies are name-bound and fail at RUNTIME, not at migration time

```sql
create function public.p_caller(x text) returns boolean language plpgsql stable
  set search_path = public as $$ begin return public.p_helper(x); end $$;
-- p_helper is already in proof_a from P-1
select public.p_caller('ok');
-- EXPECT: ERROR — function public.p_helper(text) does not exist
```

**Expected**: the error appears only when the function is *called*, not when it was relocated.
This is the failure mode that makes a missed body reference dangerous, and the reason
`handle_new_user` must be re-created in the same migration.

Record both outcomes in this file before proceeding.

## Proof run

### T001 — Disposable environment

- **Database/container type**: Isolated Docker container, `postgres:15-alpine`, named
  `phase18-pg-proof-20260801` (label: `purpose=phase18-disposable-proof`).
- **PostgreSQL version**: `15.18` (`show server_version;`).
- **Safe redacted connection description**: local Docker-only PostgreSQL database
  `proof_phase18`, reached only through `docker exec`; no host port is published and no
  password or other secret is recorded.
- **Creation command**:

  ```powershell
  docker run --name phase18-pg-proof-20260801 --label purpose=phase18-disposable-proof --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=proof_phase18 --detach postgres:15-alpine
  ```

- **Isolation confirmation**: This container has an empty, independently initialized PostgreSQL
  data directory and no published host port. It is separate from the working local Supabase
  database; no project database connection was made.

### T002 — P-1: policy expression follows the relocated function OID

- **Command executed**:

  ```powershell
  <P-1 SQL below> | docker exec -i phase18-pg-proof-20260801 psql --username postgres --dbname proof_phase18 --no-psqlrc --set ON_ERROR_STOP=1 --echo-all --pset pager=off
  ```

- **SQL executed**:

  ```sql
  create schema if not exists proof_a;
  create table t (id int, owner text);
  alter table t enable row level security;
  create function public.p_helper(x text) returns boolean language sql stable as $$ select x = 'ok' $$;
  create policy t_sel on t for select using (public.p_helper(owner));
  create role proof_reader nologin;
  grant select on t to proof_reader;
  insert into t (id, owner) values (1, 'ok'), (2, 'blocked');
  alter function public.p_helper(text) set schema proof_a;
  select polname, pg_get_expr(polqual, polrelid) from pg_policy where polname = 't_sel';
  set role proof_reader;
  select id, owner from t order by id;
  reset role;
  ```

- **Raw relevant PostgreSQL output**:

  ```text
  CREATE SCHEMA
  CREATE TABLE
  ALTER TABLE
  CREATE FUNCTION
  CREATE POLICY
  CREATE ROLE
  GRANT
  INSERT 0 2
  ALTER FUNCTION
   polname |       pg_get_expr
  ---------+-------------------------
   t_sel   | proof_a.p_helper(owner)
  (1 row)

  SET
   id | owner
  ----+-------
    1 | ok
  (1 row)

  RESET
  ```

- **Expected result**: `pg_get_expr` renders `proof_a.p_helper(...)`; the policy remains in
  place and, under an RLS-subject non-owner role, allows only the `owner = 'ok'` row.
- **Actual result**: `pg_get_expr` rendered `proof_a.p_helper(owner)` after `ALTER FUNCTION`, and
  `proof_reader` selected exactly the one `ok` row; the `blocked` row was filtered out.
- **Outcome**: **PASS** — the policy followed the helper function by OID and RLS filtering remained
  correct after relocation.

### T003 — P-2: PL/pgSQL function body resolves by name at invocation time

- **Command executed**:

  ```powershell
  <P-2 SQL below> | docker exec -i phase18-pg-proof-20260801 psql --username postgres --dbname proof_phase18 --no-psqlrc --set ON_ERROR_STOP=1 --echo-all --pset pager=off
  ```

- **SQL executed**:

  ```sql
  create function public.p_caller(x text) returns boolean language plpgsql stable
    set search_path = public as $$ begin return public.p_helper(x); end $$;
  -- p_helper is already in proof_a from P-1
  select public.p_caller('ok');
  ```

- **Raw relevant PostgreSQL output**:

  ```text
  CREATE FUNCTION
  ERROR:  function public.p_helper(text) does not exist
  LINE 1: public.p_helper(x)
          ^
  HINT:  No function matches the given name and argument types. You might need to add explicit type casts.
  QUERY:  public.p_helper(x)
  CONTEXT:  PL/pgSQL function p_caller(text) line 1 at RETURN
  PSQL_EXIT_CODE=3 (expected for invocation-time undefined-function error)
  ```

- **Expected result**: the dependent function is created successfully; relocation (already completed
  successfully in P-1) does not reject it; only calling it fails with
  `function public.p_helper(text) does not exist`.
- **Actual result**: `CREATE FUNCTION` succeeded, the P-1 `ALTER FUNCTION` had already succeeded,
  and `select public.p_caller('ok')` produced exactly the expected undefined-function error at
  `PL/pgSQL function p_caller(text) line 1 at RETURN`.
- **Outcome**: **PASS** — the dependent PL/pgSQL body remained name-bound and failed only at runtime.

### T004 — Proof conclusion

**P-1 outcome (verbatim)**: **PASS** — the policy followed the helper function by OID and RLS
filtering remained correct after relocation.

**P-2 outcome (verbatim)**: **PASS** — the dependent PL/pgSQL body remained name-bound and failed
only at runtime.

**Conclusion**: The migration design is **validated**. RLS policy expressions safely follow a
relocated function by OID, while dependent function bodies must be re-created in the same migration
when they use the original name. **Phase 3 is allowed to proceed** once separately authorized.
Fallback **F-1 replanning is not required**.

### T005 — Disposable environment destruction

- **Destruction command**:

  ```powershell
  docker rm --force phase18-pg-proof-20260801
  ```

- **Destruction output**: `phase18-pg-proof-20260801`
- **Confirmation**: A Docker name-filter query after the command returned no matching container;
  the disposable PostgreSQL container no longer exists.
- **Project database safety confirmation**: All proof SQL was executed solely with `docker exec`
  against `proof_phase18`. The working local Supabase database was never connected to or modified.

### Fallback F-1 (only if P-1 fails)

Enumerate every affected policy from `data-model.md` §1, then in the migration `drop policy` and
`create policy` each one in dependency order inside a single transaction. This is a materially larger
change and must be re-planned rather than improvised — it would also invalidate the decision to defer
`workspace_role_for` / `is_workspace_member`, since their ~55 policy references would then need the
same treatment.

## Phase 2 configuration verification

### T009 — Supabase API schemas verification

`supabase/config.toml:11` remains `schemas = ["public"]`; `private` is not listed and the file was
not modified. Adding `private` to this client-facing API schema list would expose the security-sensitive
schema and defeat the Phase 3 relocation control.

---

## Migration structure

Ordering is normative (spec FR-016). Every step is guarded so the migration converges from a clean
`supabase db reset` **or** from the developer's diverged local database (spec FR-012, SC-016).

### Step 1 — Schema

```sql
create schema if not exists private;
```

Inert on its own. Safe if the migration aborts here.

### Step 2 — Schema usage

```sql
grant usage on schema private to authenticated;
```

**Required, not optional.** The backend and every RLS policy execute as `authenticated`. Without
`USAGE` on the schema, `EXECUTE` on a function inside it is unusable.

### Step 3 — Guarded relocations

One `do $$ ... $$` block per function, keyed on `pg_proc` + `pg_namespace` so re-running is a no-op:

```sql
do $$
begin
    if exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'ensure_personal_workspace'
          and pg_get_function_identity_arguments(p.oid) = 'uuid, text'
    ) then
        alter function public.ensure_personal_workspace(uuid, text) set schema private;
    end if;
end $$;
```

Repeat for:

| Function | Identity arguments |
|---|---|
| `ensure_personal_workspace` | `uuid, text` |
| `get_workspace_ai_key_for_extraction` | `uuid` |
| `find_user_profile_by_email` | `text` |
| `shares_workspace_with` | `uuid, uuid` |

Matching on identity arguments as well as name prevents relocating an unintended overload.

### Step 4 — Re-grant on relocated functions

```sql
revoke all on function private.<fn>(<args>) from public, anon;
grant execute on function private.<fn>(<args>) to authenticated;
```

`ALTER FUNCTION ... SET SCHEMA` preserves existing grants, so this step is belt-and-braces — but it
makes the intended end state explicit and self-documenting, and it is required if the function was
created fresh in `private` on a divergent database.

### Step 5 — The one dependent body

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, private
as $$
begin
    perform private.ensure_personal_workspace(new.id, coalesce(new.email, ''));
    return new;
end;
$$;
```

Changed from `public.ensure_personal_workspace` (`20260624000000_auth_workspace_foundation.sql:283`).
The call is fully qualified so `search_path` is not strictly load-bearing, but `private` is added for
clarity. **The existing `on_auth_user_created` trigger is not re-created** — `CREATE OR REPLACE`
retains the same OID, so the trigger binding is untouched.

If this step is omitted, **every new signup breaks at runtime** while the migration reports success.

### Step 6 — Identity guard

```sql
create or replace function private.ensure_personal_workspace(target_user_id uuid, target_email text)
returns void language plpgsql security definer
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
    if auth.uid() is not null and auth.uid() is distinct from target_user_id then
        raise exception 'identity_mismatch' using errcode = '42501';
    end if;

    -- ... remainder byte-identical to 20260624000000_auth_workspace_foundation.sql:105-138 ...
end;
$$;
```

Everything after the guard is copied unchanged. `search_path = public` remains correct because the
body references only `public.user_profiles`, `public.workspaces`, and
`public.workspace_memberships`.

### Step 7 — Required inline warning comment

The migration MUST carry this comment, because the obvious-looking fix is catastrophic:

```sql
-- DO NOT revoke EXECUTE on public.workspace_role_for / public.is_workspace_member
-- from `authenticated`. Every RLS policy in this database calls them AS THE
-- REQUESTING USER (~55 references; see specs/018-.../data-model.md). Revoking
-- EXECUTE disables tenant isolation on every table and takes the product down.
-- Those two helpers are deliberately NOT relocated in this phase — see
-- specs/018-.../research.md R-003.
```

---

## Prohibited statements

A reviewer verifies the tenant-isolation guarantee (spec FR-010, SC-006) by grepping the migration
for these and finding **zero** matches:

- `create policy` / `drop policy` / `alter policy`
- `create table` / `alter table` / `drop table`
- `revoke` targeting `workspace_role_for` or `is_workspace_member`
- any reference to `SUPABASE_SERVICE_ROLE_KEY` or the `service_role` role
- `force row level security`

---

## Post-migration verification queries

```sql
-- 1. All four relocated, none left in public
select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname in ('ensure_personal_workspace','get_workspace_ai_key_for_extraction',
                     'find_user_profile_by_email','shares_workspace_with');
-- EXPECT: exactly 4 rows, all nspname = 'private'

-- 2. The one policy that referenced a moved function auto-followed
select pg_get_expr(polqual, polrelid) from pg_policy
 where polname = 'Members can read co-members profiles';
-- EXPECT: renders private.shares_workspace_with(...)

-- 3. Deferred helpers untouched
select n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname in ('workspace_role_for','is_workspace_member');
-- EXPECT: all rows nspname = 'public'

-- 4. Grants intact
select has_schema_privilege('authenticated','private','USAGE');            -- EXPECT: true
select has_function_privilege('authenticated',
  'private.ensure_personal_workspace(uuid,text)','EXECUTE');               -- EXPECT: true

-- 5. Trigger binding survived the CREATE OR REPLACE
select tgname from pg_trigger where tgname = 'on_auth_user_created';       -- EXPECT: 1 row
```

## Idempotency check (spec SC-016)

Apply the migration file twice in the same database. Second application must complete without error
and leave query results 1–5 identical.

## Reversal

`specs/018-security-remediation-hardening/rollback.sql`. **Never placed in
`supabase/migrations/`** — that directory is replayed by `supabase db reset`, so a reversal file there
would undo the fix on every environment rebuild (spec FR-013).

The two changes are independently reversible (spec FR-014): reverting the relocation does not require
reverting the identity guard, and vice versa. `rollback.sql` is split into two clearly labelled
sections accordingly.

## Phase 3 local migration verification

- **Timestamp**: 2026-08-02 02:20:23 +03:00
- **Environment**: Local-only Supabase development stack for project `smart-expense-ai`; database
  container `supabase_db_smart-expense-ai`, image
  `public.ecr.aws/supabase/postgres:15.8.1.085`. No hosted environment was contacted.
- **Pre-apply state commands**:

  ```powershell
  npx --no-install supabase migration list --local
  docker exec supabase_db_smart-expense-ai psql -U postgres -d postgres -X -At -c "select count(*) from supabase_migrations.schema_migrations where version='20260731000000';"
  ```

  The migration list showed local version `20260731000000` with an empty remote/applied value, and
  the history query returned `0`.
- **Apply command and raw output**:

  ```text
  > npx --no-install supabase migration up --local
  Connecting to local database...
  Applying migration 20260731000000_private_schema_privileged_functions.sql...
  {"applied":["D:\\claude\\smart_expense\\supabase\\migrations\\20260731000000_private_schema_privileged_functions.sql"],"message":"Migrations applied"}
  Exit code: 0
  ```

The five contract queries were sent to the local container with:

```powershell
$sql = @'
-- The exact five-query SQL block from "Post-migration verification queries" above.
'@
$sql | docker exec -i supabase_db_smart-expense-ai psql -U postgres -d postgres -X -P pager=off
```

The executed SQL was exactly:

```sql
select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname in ('ensure_personal_workspace','get_workspace_ai_key_for_extraction',
                     'find_user_profile_by_email','shares_workspace_with');
select pg_get_expr(polqual, polrelid) from pg_policy
 where polname = 'Members can read co-members profiles';
select n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname in ('workspace_role_for','is_workspace_member');
select has_schema_privilege('authenticated','private','USAGE');
select has_function_privilege('authenticated',
  'private.ensure_personal_workspace(uuid,text)','EXECUTE');
select tgname from pg_trigger where tgname = 'on_auth_user_created';
```

Raw relevant PostgreSQL output:

```text
 nspname |               proname
---------+-------------------------------------
 private | ensure_personal_workspace
 private | find_user_profile_by_email
 private | get_workspace_ai_key_for_extraction
 private | shares_workspace_with
(4 rows)

                  pg_get_expr
-----------------------------------------------
 private.shares_workspace_with(id, auth.uid())
(1 row)

 nspname
---------
 public
 public
(2 rows)

 has_schema_privilege
----------------------
 t
(1 row)

 has_function_privilege
------------------------
 t
(1 row)

        tgname
----------------------
 on_auth_user_created
(1 row)
```

| Verification | Expected | Actual | Result |
|---|---|---|---|
| 1 — relocation | Exactly four target rows, all in `private`; no public version | Exactly four rows, all `private` | **PASS** |
| 2 — policy OID binding | Policy renders `private.shares_workspace_with(...)` | `private.shares_workspace_with(id, auth.uid())` | **PASS** |
| 3 — deferred helpers | Both remain in `public` | Two `public` rows | **PASS** |
| 4 — grants | Private schema `USAGE` and relocated function `EXECUTE` are true for `authenticated` | Both returned `t` | **PASS** |
| 5 — trigger | One `on_auth_user_created` row remains | One row returned | **PASS** |

Supplemental privilege/signature inspection returned the four intended named signatures in
`private`; each had `authenticated_execute = t`, `anon_execute = f`, and
`public_execute = f`. `workspace_role_for(uuid,uuid)` and
`is_workspace_member(uuid,uuid)` remained in `public` with `authenticated_execute = t`. Trigger
inspection resolved `on_auth_user_created` to `public.handle_new_user`, whose `prosrc` calls
`private.ensure_personal_workspace` and whose setting is `search_path=public, private`.

The focused MG-1 test executed the migration SQL twice in the same transaction and compared the
complete intended state after each application; it passed. No reset was used, and the local database
was left in the post-migration Phase 3 state for Phase 4.

## Phase 4 local identity-guard application

- **Timestamp**: 2026-08-02 03:02:38 +03:00
- **Environment**: Local-only Supabase development stack, database container
  `supabase_db_smart-expense-ai` (`public.ecr.aws/supabase/postgres:15.8.1.085`). No hosted
  environment was contacted.
- **Pre-application state**: migration history contained exactly one `20260731000000` row; all four
  targets existed only in `private`; `position('identity_mismatch' in prosrc)` returned `0` for
  `private.ensure_personal_workspace`.
- **Direct application command** (no password or connection secret used):

  ```powershell
  Get-Content -Raw -Encoding utf8 supabase/migrations/20260731000000_private_schema_privileged_functions.sql |
    docker exec -i supabase_db_smart-expense-ai psql -U postgres -d postgres -X --set ON_ERROR_STOP=1 --pset pager=off
  ```

- **Raw output**:

  ```text
  CREATE SCHEMA
  GRANT
  DO
  DO
  DO
  DO
  REVOKE
  GRANT
  REVOKE
  GRANT
  REVOKE
  GRANT
  REVOKE
  GRANT
  CREATE FUNCTION
  CREATE FUNCTION
  NOTICE: schema "private" already exists, skipping
  Exit code: 0
  ```

Post-application catalog verification returned:

```text
migration_history_rows: 1

private.ensure_personal_workspace(uuid,text):
  security_definer=t, search_path=public,
  authenticated_execute=t, anon_execute=f, public_execute=f
private.find_user_profile_by_email(text): authenticated_execute=t, anon_execute=f, public_execute=f
private.get_workspace_ai_key_for_extraction(uuid): authenticated_execute=t, anon_execute=f, public_execute=f
private.shares_workspace_with(uuid,uuid): authenticated_execute=t, anon_execute=f, public_execute=f

guard_position=578
null_check_position=471
mismatch_check_position=505
sqlstate_position=626

on_auth_user_created -> public.handle_new_user
handle_new_user private-call position=20
handle_new_user search_path=public, private
authenticated private-schema usage=t
```

**Outcome**: **PASS**. The complete idempotent migration replayed directly without altering or
duplicating migration history. The four targets remain private with their Phase 3 grants, the trigger
and dependent function remain intact, and the live function body contains the exact NULL-tolerant
`identity_mismatch` / `42501` guard.

Static body comparison normalized only line endings and the intended `public` → `private` function
header. Rollback Section B is otherwise identical to the Phase 3 pre-guard definition, and removing
the new comment/guard block from the forward definition leaves a body identical to
`20260624000000_auth_workspace_foundation.sql`. Section B therefore removes only the guard while
preserving relocation, `SECURITY DEFINER`, `search_path = public`, and Phase 3 grants.
