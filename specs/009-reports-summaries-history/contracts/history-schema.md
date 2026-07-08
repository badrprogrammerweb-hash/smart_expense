# Contract: `activity_history` Schema, Triggers, RLS

Migration file: `supabase/migrations/20260708000000_reports_history.sql` (tracked).
Reuses the existing `public.workspace_role_for(workspace_id, user_id)` helper and the
project's established RLS/grant conventions (mirrors the Phase 8 `ai_extractions`
block). This is the **only** schema change in Phase 9; reports/summaries persist
nothing.

> **Codex note (stray DB state):** apply this migration against the *tracked* schema
> via the normal migration flow and reconcile any locally psql-applied
> `ai_extractions` drift first — the `ai_extractions` trigger depends on the committed
> status vocabulary (research Decision 7).

---

## Table

```
public.activity_history (
    id             uuid primary key default gen_random_uuid(),
    workspace_id   uuid not null references public.workspaces(id) on delete cascade,
    event_type     text not null check (event_type in (
                      'income_created','income_updated','income_deleted',
                      'expense_created','expense_updated','expense_deleted',
                      'category_created','category_updated','category_archived',
                      'file_uploaded','file_deleted',
                      'extraction_started','extraction_completed','extraction_failed',
                      'ai_draft_confirmed',
                      'member_added','member_removed','role_changed',
                      'setting_changed')),
    actor_user_id  uuid references public.user_profiles(id) on delete set null,
    entity_table   text not null,
    entity_id      uuid,
    summary        jsonb not null default '{}'::jsonb,
    created_at     timestamptz not null default now()
)
```

**Index**
```
create index activity_history_ws_created_idx
    on public.activity_history (workspace_id, created_at desc, id desc);
```

---

## Trigger function (SECURITY DEFINER)

One shared function, `public.record_activity()`, `returns trigger`,
`language plpgsql`, `security definer`, `set search_path = public`. It:

1. Derives `workspace_id` from `NEW`/`OLD` (`coalesce(NEW.workspace_id, OLD.workspace_id)`;
   for `workspace_memberships` the column is `workspace_id`).
2. Derives `event_type` from `TG_TABLE_NAME` + `TG_OP` + OLD/NEW deltas per the
   mapping in data-model.md.
3. **Skips insertion** (returns without logging) when an UPDATE changed nothing
   meaningful (i.e. only `updated_at` differs) — compare the relevant columns, not the
   whole row, so bookkeeping bumps do not create noise.
4. Inserts one `activity_history` row with `actor_user_id = auth.uid()`,
   `entity_table = TG_TABLE_NAME`, `entity_id = coalesce(NEW.id, OLD.id)`, and a small
   non-sensitive `summary` jsonb (e.g. amount/merchant for expenses, old/new role for
   memberships). **Never** place secrets, keys, or decrypted values in `summary`.
5. Returns `NEW` (or `OLD` for DELETE).

Because it is `SECURITY DEFINER` and owned by `postgres`, it can insert into
`activity_history` even though `authenticated` has no direct insert grant. `auth.uid()`
inside the definer still resolves to the calling user (the JWT GUC survives), so the
actor is correct on every RLS-session and RPC-driven write path (research Decision 7 —
verified: no service-role writes to the eight source tables).

> Implementation may split into a few small functions if per-table delta logic reads
> cleaner (e.g. `record_activity_status_table()` for incomes/expenses that share the
> `status → deleted` rule). The contract is the mapping + the "meaningful change only"
> + "actor = auth.uid()" + "no secrets in summary" guarantees, not the exact function
> count.

---

## Triggers

`AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW EXECUTE FUNCTION public.record_activity()`
on:

- `public.incomes`
- `public.expenses`
- `public.categories`
- `public.files`
- `public.ai_extractions`
- `public.workspace_memberships`
- `public.workspaces` (fires only when `auto_delete_after_extraction` changed)
- `public.workspace_ai_settings`

`AFTER` (not `BEFORE`) so the entry is written only once the mutation itself has
succeeded within the transaction (atomic; rolls back together — FR-021).

---

## RLS & grants

```
alter table public.activity_history enable row level security;

-- Read: Owner/Admin members of the workspace only (FR-032).
create policy "Owners/Admins can view history"
on public.activity_history
for select
to authenticated
using (public.workspace_role_for(workspace_id, auth.uid()) in ('owner','admin'));

-- No insert/update/delete policy for authenticated: entries are created only by the
-- SECURITY DEFINER trigger, and are append-only + immutable-by-absence-of-policy
-- (FR-023). This is lightweight, not audit-grade enforcement.

revoke all on public.activity_history from anon;
revoke insert, update, delete on public.activity_history from authenticated;
grant select on public.activity_history to authenticated;
```

---

## Invariants this contract must satisfy

- Exactly one entry per tracked mutation; none for a no-op `updated_at` bump
  (SC-004).
- Forward-only: no backfill statement exists in the migration (FR-022).
- Actor captured from `auth.uid()`; nullable FK so user deletion never erases history.
- Every row carries `workspace_id`; select is Owner/Admin-scoped by RLS (FR-025,
  FR-032).
- Append-only: no path grants update/delete to app roles (FR-023).
- `summary` never contains secrets/keys/decrypted values (constitution VI).
