-- Phase 7's confirm_ai_extraction() hardcoded currency = 'SAR', which was
-- safe only because every workspace's currency was locked to SAR at the
-- time. Phase 12 lets a workspace's currency be anything in
-- supported_currencies, so confirming an extraction in a non-SAR workspace
-- now violates enforce_record_currency_matches_workspace() (added in
-- 20260720000000_i18n_locale_workspace_currency.sql) and fails. Fix: read
-- the owning workspace's current currency instead of hardcoding 'SAR',
-- mirroring how apps/api/app/routes/incomes.py and routes/expenses.py
-- already source currency from the workspace for manually created records.
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
