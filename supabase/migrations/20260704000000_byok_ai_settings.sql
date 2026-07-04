create extension if not exists supabase_vault with schema vault;

create table public.workspace_ai_settings (
    workspace_id    uuid primary key references public.workspaces(id) on delete cascade,
    provider        text not null check (provider in ('gemini', 'openai')),
    vault_secret_id uuid not null,
    key_last4       text not null check (char_length(key_last4) <= 4),
    updated_by      uuid not null references public.user_profiles(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.workspace_ai_settings enable row level security;

create policy "Members can read ai settings status"
on public.workspace_ai_settings
for select
to authenticated
using (public.workspace_role_for(workspace_id, auth.uid()) is not null);

revoke insert, update, delete on public.workspace_ai_settings from authenticated, anon;
grant select on public.workspace_ai_settings to authenticated;

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
    if public.workspace_role_for(p_workspace_id, auth.uid()) is distinct from 'owner' then
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

alter function public.set_workspace_ai_key(uuid, text, text) owner to postgres;
revoke all on function public.set_workspace_ai_key(uuid, text, text) from public, anon;
grant execute on function public.set_workspace_ai_key(uuid, text, text) to authenticated;

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
    if public.workspace_role_for(p_workspace_id, auth.uid()) is distinct from 'owner' then
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

alter function public.clear_workspace_ai_key(uuid) owner to postgres;
revoke all on function public.clear_workspace_ai_key(uuid) from public, anon;
grant execute on function public.clear_workspace_ai_key(uuid) to authenticated;
