# Contract: Extraction RPCs + table + RLS (SQL)

This is the database contract implemented by the single new migration
`supabase/migrations/20260705000000_ai_extraction_review.sql`. SQL below is
the **intended shape** at contract altitude; the implementer writes the final
migration and must verify it against the local Supabase stack (same
implementer precondition Phase 7's contract called out for Vault). Nothing
here logs or returns the decrypted API key beyond what's explicitly
documented.

## Table + RLS

```sql
create table if not exists public.ai_extractions (
    id                  uuid primary key default gen_random_uuid(),
    workspace_id        uuid not null references public.workspaces(id) on delete cascade,
    file_id             uuid not null references public.files(id) on delete cascade,
    provider            text not null check (provider in ('gemini', 'openai')),
    status              text not null default 'processing'
                          check (status in ('processing','ready_for_review','failed','confirmed','discarded')),
    amount_minor        bigint check (amount_minor is null or amount_minor > 0),
    extracted_currency  text,
    occurred_on         date,
    vendor_name         text,
    suggested_category  text,
    failure_reason      text check (failure_reason is null or failure_reason in
                          ('invalid_key','rate_limited','timeout','unreadable_file','malformed_response','provider_error')),
    triggered_by        uuid not null references public.user_profiles(id),
    triggered_at        timestamptz not null default now(),
    confirmed_by        uuid references public.user_profiles(id),
    confirmed_at        timestamptz,
    discarded_by        uuid references public.user_profiles(id),
    discarded_at        timestamptz,
    expense_id          uuid references public.expenses(id) on delete set null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create unique index if not exists ai_extractions_one_active_per_file
    on public.ai_extractions (file_id)
    where status in ('processing', 'ready_for_review');

alter table public.ai_extractions enable row level security;

-- Read: any workspace member, including Viewer (FR-010; Clarifications).
create policy "Members can view extractions"
on public.ai_extractions
for select
to authenticated
using (public.workspace_role_for(workspace_id, auth.uid()) is not null);

-- Trigger: Owner/Admin/Member only; file must be active, in-workspace, and
-- unlinked (FR-003a); BYOK must be configured (FR-002, defense-in-depth).
create policy "Members can trigger extraction"
on public.ai_extractions
for insert
to authenticated
with check (
    public.workspace_role_for(workspace_id, auth.uid()) in ('owner', 'admin', 'member')
    and triggered_by = auth.uid()
    and exists (
        select 1 from public.files f
         where f.id = file_id
           and f.workspace_id = ai_extractions.workspace_id
           and f.status = 'active'
           and f.expense_id is null
    )
    and exists (
        select 1 from public.workspace_ai_settings s
         where s.workspace_id = ai_extractions.workspace_id
    )
);

-- Update: covers both the system's own processing->terminal write and
-- discard. Owner/Admin act on any row; Member only on a row they triggered.
create policy "Owners/Admins any, Members own extraction"
on public.ai_extractions
for update
to authenticated
using (
    public.workspace_role_for(workspace_id, auth.uid()) in ('owner', 'admin')
    or (public.workspace_role_for(workspace_id, auth.uid()) = 'member' and triggered_by = auth.uid())
)
with check (
    public.workspace_role_for(workspace_id, auth.uid()) in ('owner', 'admin')
    or (public.workspace_role_for(workspace_id, auth.uid()) = 'member' and triggered_by = auth.uid())
);

-- No delete policy: extraction rows are permanent history.

revoke insert, update, delete on public.ai_extractions from anon;
revoke all on public.ai_extractions from anon;
grant select, insert, update on public.ai_extractions to authenticated;
```

## RPC: `get_workspace_ai_key_for_extraction` (read the decrypted key)

```sql
create or replace function public.get_workspace_ai_key_for_extraction(
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
    v_role := public.workspace_role_for(p_workspace_id, auth.uid());
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

revoke all on function public.get_workspace_ai_key_for_extraction(uuid) from public, anon;
grant execute on function public.get_workspace_ai_key_for_extraction(uuid) to authenticated;
```

**The decrypted key is returned to the backend only.** The backend service
holds it in memory for exactly one extraction attempt, uses it to call the
configured provider, and discards it; it is never included in any HTTP
response, log line, or persisted column outside Vault (research Decisions
1–3; dedicated test `test_extraction_secrecy.py`).

## RPC: `confirm_ai_extraction` (atomic confirm)

```sql
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
begin
    select workspace_id, file_id, status, triggered_by
      into v_workspace_id, v_file_id, v_status, v_triggered_by
      from public.ai_extractions
     where id = p_extraction_id;

    v_role := public.workspace_role_for(v_workspace_id, auth.uid());

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

    -- currency is always SAR regardless of the extraction's detected currency
    -- (expenses.currency's existing check constraint would reject anything else).
    insert into public.expenses
        (workspace_id, created_by, category_id, amount_minor, currency, occurred_on, description, merchant_name)
    values
        (v_workspace_id, auth.uid(), p_category_id, p_amount_minor, 'SAR', p_occurred_on, p_description, p_merchant_name)
    returning id into v_expense_id;
    -- existing validate_expense_category trigger fires unchanged here.

    update public.files set expense_id = v_expense_id where id = v_file_id;

    select auto_delete_after_extraction into v_auto_delete
      from public.workspaces where id = v_workspace_id;

    if v_auto_delete then
        select storage_path into v_storage_path from public.files where id = v_file_id;
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

revoke all on function public.confirm_ai_extraction(uuid, bigint, date, uuid, text, text) from public, anon;
grant execute on function public.confirm_ai_extraction(uuid, bigint, date, uuid, text, text) to authenticated;
```

**Ordering note (mirrors `services/files.py`'s existing delete path)**: this
function only ever soft-deletes the file's **metadata** row when auto-delete
applies — it cannot call Supabase Storage's REST API from SQL. The backend
calls `storage.remove_object(storage_path)` **after** this transaction commits
successfully, exactly the same rollback-safe ordering
`services/files.py` already uses for manual file deletion.

## Ownership / privilege requirement (implementer precondition)

- Both functions must be owned by the same Vault-privileged role that owns
  Phase 7's `set_workspace_ai_key` / `clear_workspace_ai_key` (locally
  `postgres`).
- `authenticated` gets `EXECUTE` on both functions; `anon` gets nothing.
  `vault.decrypted_secrets` remains ungranted to `authenticated`/`anon` —
  only reachable through `get_workspace_ai_key_for_extraction`.
- `confirm_ai_extraction`'s writes to `files` (link and, when auto-delete
  applies, soft-delete) succeed only because `SECURITY DEFINER` bypasses
  `files` RLS — this is load-bearing for a Member confirming their own
  extraction, since Phase 6 normally restricts file deletion to Owner/Admin.
  **Verify** `files` has no `FORCE ROW LEVEL SECURITY` and the owning role is
  not itself RLS-restricted, or a Member's auto-delete-triggering confirm will
  silently fail to soft-delete the file (research Decision 9).

## SQL contract test checklist

- [ ] `get_workspace_ai_key_for_extraction` as Owner/Admin/Member with BYOK
      configured returns `(provider, api_key)`; as Viewer or non-member raises
      `42501` (→ 403); with no BYOK configured returns zero rows.
- [ ] The decrypted key never appears in a Postgres log line for any call
      (parameter logging off, matching Phase 7 Decision 7).
- [ ] `confirm_ai_extraction` on a `ready_for_review` row owned by the caller
      (or by anyone, if caller is Owner/Admin) creates exactly one `expenses`
      row with `currency = 'SAR'`, links `files.expense_id`, and marks the
      extraction `confirmed`.
- [ ] `confirm_ai_extraction` by a Member who did not trigger the extraction
      raises `42501`.
- [ ] `confirm_ai_extraction` with `p_amount_minor <= 0` or a null
      `p_occurred_on` raises a validation error and creates no expense.
- [ ] Calling `confirm_ai_extraction` twice on the same extraction (simulated
      concurrent confirm) creates exactly one expense; the second call's
      `WHERE status = 'ready_for_review'` update affects zero rows.
- [ ] With `workspaces.auto_delete_after_extraction = true`,
      `should_delete_binary = true` and `storage_path` is returned, and the
      file row is soft-deleted in the same transaction as the expense insert.
- [ ] With `auto_delete_after_extraction = false`, `should_delete_binary =
      false` and the file row is untouched.
- [ ] `INSERT` into `ai_extractions` for a file that already has an active
      (`processing`/`ready_for_review`) extraction violates the partial unique
      index.
- [ ] `INSERT` for a file with `expense_id is not null` fails the `INSERT`
      policy's `with check` (FR-003a).
- [ ] Cross-workspace: a member of workspace B cannot `SELECT`/`INSERT`/
      `UPDATE` workspace A's extraction rows, and `confirm_ai_extraction`/
      `get_workspace_ai_key_for_extraction` called with workspace A's id by a
      workspace B member raise `not_found`/`42501` respectively.
