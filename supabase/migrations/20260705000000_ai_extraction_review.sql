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

drop trigger if exists ai_extractions_set_updated_at on public.ai_extractions;
create trigger ai_extractions_set_updated_at
before update on public.ai_extractions
for each row execute function public.set_updated_at();

alter table public.ai_extractions enable row level security;

-- Read: any workspace member, including Viewer (FR-010; Clarifications).
drop policy if exists "Members can view extractions" on public.ai_extractions;
create policy "Members can view extractions"
on public.ai_extractions
for select
to authenticated
using (public.workspace_role_for(workspace_id, auth.uid()) is not null);

-- Trigger: Owner/Admin/Member only; file must be active, in-workspace, and
-- unlinked (FR-003a); BYOK must be configured (FR-002, defense-in-depth).
drop policy if exists "Members can trigger extraction" on public.ai_extractions;
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
drop policy if exists "Owners/Admins any, Members own extraction" on public.ai_extractions;
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

-- RPC: get_workspace_ai_key_for_extraction (read the decrypted key)
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

alter function public.get_workspace_ai_key_for_extraction(uuid) owner to postgres;
revoke all on function public.get_workspace_ai_key_for_extraction(uuid) from public, anon;
grant execute on function public.get_workspace_ai_key_for_extraction(uuid) to authenticated;

-- RPC: confirm_ai_extraction (atomic confirm)
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

alter function public.confirm_ai_extraction(uuid, bigint, date, uuid, text, text) owner to postgres;
revoke all on function public.confirm_ai_extraction(uuid, bigint, date, uuid, text, text) from public, anon;
grant execute on function public.confirm_ai_extraction(uuid, bigint, date, uuid, text, text) to authenticated;
