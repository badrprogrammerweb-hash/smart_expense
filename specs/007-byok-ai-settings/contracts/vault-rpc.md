# Contract: Vault RPC + table + RLS (SQL)

This is the database contract implemented by the single new migration
`supabase/migrations/20260704000000_byok_ai_settings.sql`. SQL below is the
**intended shape** at contract altitude; the implementer writes the final
migration and must confirm the Vault calls in the target stack (research
Decision 3 precondition). Nothing here reads or returns the secret; nothing logs
it.

## Table + RLS

```sql
create table if not exists public.workspace_ai_settings (
    workspace_id    uuid primary key
                      references public.workspaces(id) on delete cascade,
    provider        text not null check (provider in ('gemini', 'openai')),
    vault_secret_id uuid not null,                         -- references vault.secrets.id (cross-schema; not a DB FK)
    key_last4       text not null check (char_length(key_last4) <= 4),
    updated_by      uuid not null references public.user_profiles(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.workspace_ai_settings enable row level security;

-- Read status: any member of the workspace (incl. Viewer). FR-021 / FR-023.
create policy "Members can read ai settings status"
on public.workspace_ai_settings
for select
to authenticated
using (public.workspace_role_for(workspace_id, auth.uid()) is not null);

-- No INSERT/UPDATE/DELETE policies for authenticated: all writes go through the
-- SECURITY DEFINER RPCs below (deny-by-default for direct table writes). FR-020.

-- Direct table writes are not granted to app roles; only SELECT is reachable.
revoke insert, update, delete on public.workspace_ai_settings from authenticated, anon;
grant  select on public.workspace_ai_settings to authenticated;
```

## RPC: `set_workspace_ai_key` (configure / replace / switch)

```sql
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
    -- Owner-only authorization inside the definer (privilege can't be misused). FR-020.
    if public.workspace_role_for(p_workspace_id, auth.uid()) is distinct from 'owner' then
        raise exception 'not_owner' using errcode = '42501';  -- insufficient_privilege -> 403
    end if;

    if p_provider not in ('gemini', 'openai') then
        raise exception 'invalid_provider' using errcode = '22023';
    end if;
    if p_api_key is null or length(btrim(p_api_key)) = 0 then
        raise exception 'empty_key' using errcode = '22023';
    end if;

    select s.vault_secret_id into v_secret_id
      from public.workspace_ai_settings s
     where s.workspace_id = p_workspace_id;

    if v_secret_id is null then
        -- First-time configuration. VERIFY signature/return in target stack.
        v_secret_id := vault.create_secret(
            p_api_key,
            'workspace_ai_key:' || p_workspace_id::text,
            'BYOK provider key'
        );
        insert into public.workspace_ai_settings
            (workspace_id, provider, vault_secret_id, key_last4, updated_by)
        values
            (p_workspace_id, p_provider, v_secret_id, right(p_api_key, 4), auth.uid());
    else
        -- Rotate / switch: overwrite plaintext in place (keeps id, no gap). FR-013.
        perform vault.update_secret(v_secret_id, p_api_key);
        update public.workspace_ai_settings s
           set provider   = p_provider,
               key_last4  = right(p_api_key, 4),
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

revoke all on function public.set_workspace_ai_key(uuid, text, text) from public, anon;
grant execute on function public.set_workspace_ai_key(uuid, text, text) to authenticated;
```

## RPC: `clear_workspace_ai_key` (remove)

```sql
create or replace function public.clear_workspace_ai_key(
    p_workspace_id uuid
)
returns boolean          -- true if a config was removed, false if nothing existed
language plpgsql
security definer
set search_path = public, vault
as $$
declare
    v_secret_id uuid;
begin
    if public.workspace_role_for(p_workspace_id, auth.uid()) is distinct from 'owner' then
        raise exception 'not_owner' using errcode = '42501';
    end if;

    select s.vault_secret_id into v_secret_id
      from public.workspace_ai_settings s
     where s.workspace_id = p_workspace_id;

    if v_secret_id is null then
        return false;                                   -- no-op safe. FR-016.
    end if;

    delete from vault.secrets where id = v_secret_id;   -- destroy the secret. FR-013/FR-015.
    delete from public.workspace_ai_settings where workspace_id = p_workspace_id;
    return true;
end;
$$;

revoke all on function public.clear_workspace_ai_key(uuid) from public, anon;
grant execute on function public.clear_workspace_ai_key(uuid) to authenticated;
```

## Ownership / privilege requirement (implementer precondition)

- Both functions must be **owned by a role that can execute `vault.create_secret`
  / `vault.update_secret` and delete from `vault.secrets`** (locally `postgres`
  can). Under `SECURITY DEFINER` the function runs as its owner, so app callers
  never need direct Vault privileges.
- `authenticated` gets `EXECUTE` on both functions and `SELECT` on the table —
  nothing more. `anon` gets nothing. The `vault.decrypted_secrets` view is never
  granted to `authenticated`/`anon`.
- Confirm the migration runner applies these as the intended owner (research
  Decision 3). If the runner is not Vault-privileged, set ownership explicitly
  (`alter function … owner to postgres;`).

## SQL contract test checklist

- [ ] `set_workspace_ai_key` as Owner creates a Vault secret + row (first time)
      and updates in place on second call (same `vault_secret_id`).
- [ ] `set_workspace_ai_key` as Admin/Member/Viewer raises `42501` (→ 403).
- [ ] `clear_workspace_ai_key` as Owner deletes the secret and row; returns
      `false` (no error) when nothing was configured.
- [ ] After clear/replace, the prior secret id is absent from `vault.secrets`
      (not decryptable) (SC-005/SC-006).
- [ ] `authenticated` cannot `insert/update/delete` the table directly (RLS/grant
      deny), only `select` its own workspaces' rows (SC-007).
- [ ] Neither function writes `p_api_key` to logs; `key_last4` is exactly the last
      ≤4 chars.
