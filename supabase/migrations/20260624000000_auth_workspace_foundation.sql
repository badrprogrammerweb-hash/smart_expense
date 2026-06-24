create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    display_name text,
    created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
    id uuid primary key default gen_random_uuid(),
    type text not null check (type in ('personal', 'team')),
    name text not null check (length(btrim(name)) > 0),
    created_by uuid not null references public.user_profiles(id) on delete cascade,
    created_at timestamptz not null default now()
);

create unique index if not exists workspaces_one_personal_per_creator
    on public.workspaces(created_by)
    where type = 'personal';

create table if not exists public.workspace_memberships (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references public.user_profiles(id) on delete cascade,
    role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
    created_at timestamptz not null default now(),
    unique (workspace_id, user_id)
);

create or replace function public.find_user_profile_by_email(lookup_email text)
returns table(id uuid, email text)
language sql
security definer
set search_path = public
as $$
    select user_profiles.id, user_profiles.email
    from public.user_profiles
    where lower(user_profiles.email) = lower(btrim(lookup_email))
    limit 1;
$$;

revoke all on function public.find_user_profile_by_email(text) from public;
grant execute on function public.find_user_profile_by_email(text) to authenticated;

create or replace function public.workspace_role_for(target_workspace_id uuid, target_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
    select role
    from public.workspace_memberships
    where workspace_id = target_workspace_id
      and user_id = target_user_id
    limit 1;
$$;

revoke all on function public.workspace_role_for(uuid, uuid) from public;
grant execute on function public.workspace_role_for(uuid, uuid) to authenticated;

create or replace function public.is_workspace_member(target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select public.workspace_role_for(target_workspace_id, target_user_id) is not null;
$$;

revoke all on function public.is_workspace_member(uuid, uuid) from public;
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;

create or replace function public.shares_workspace_with(target_user_id uuid, viewer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1
        from public.workspace_memberships mine
        join public.workspace_memberships theirs
          on theirs.workspace_id = mine.workspace_id
        where mine.user_id = viewer_id
          and theirs.user_id = target_user_id
    );
$$;

revoke all on function public.shares_workspace_with(uuid, uuid) from public;
grant execute on function public.shares_workspace_with(uuid, uuid) to authenticated;

create or replace function public.ensure_personal_workspace(target_user_id uuid, target_email text)
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

revoke all on function public.ensure_personal_workspace(uuid, text) from public;
grant execute on function public.ensure_personal_workspace(uuid, text) to authenticated;

grant select, update on public.user_profiles to authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_memberships to authenticated;

alter table public.user_profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

create policy "Users can read own profile"
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

create policy "Members can read co-members profiles"
on public.user_profiles
for select
to authenticated
using (public.shares_workspace_with(user_profiles.id, auth.uid()));

create policy "Users can update own profile"
on public.user_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Members can read their workspaces"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(workspaces.id, auth.uid()));

create policy "Authenticated users can create owned workspaces"
on public.workspaces
for insert
to authenticated
with check (created_by = auth.uid());

create policy "Owners and admins can update workspaces"
on public.workspaces
for update
to authenticated
using (public.workspace_role_for(workspaces.id, auth.uid()) in ('owner', 'admin'))
with check (public.workspace_role_for(workspaces.id, auth.uid()) in ('owner', 'admin'));

create policy "Members can read workspace memberships"
on public.workspace_memberships
for select
to authenticated
using (public.is_workspace_member(workspace_memberships.workspace_id, auth.uid()));

create policy "Owners and admins can add non-owner memberships"
on public.workspace_memberships
for insert
to authenticated
with check (
    role in ('admin', 'member', 'viewer')
    and public.workspace_role_for(workspace_memberships.workspace_id, auth.uid()) in ('owner', 'admin')
);

create policy "Owners and admins can update membership roles"
on public.workspace_memberships
for update
to authenticated
using (
    public.workspace_role_for(workspace_memberships.workspace_id, auth.uid()) = 'owner'
    or (
        public.workspace_role_for(workspace_memberships.workspace_id, auth.uid()) = 'admin'
        and workspace_memberships.role <> 'owner'
    )
)
with check (
    public.workspace_role_for(workspace_memberships.workspace_id, auth.uid()) = 'owner'
    or (
        public.workspace_role_for(workspace_memberships.workspace_id, auth.uid()) = 'admin'
        and workspace_memberships.role in ('admin', 'member', 'viewer')
    )
);

create policy "Owners admins and self can delete memberships"
on public.workspace_memberships
for delete
to authenticated
using (
    user_id = auth.uid()
    or public.workspace_role_for(workspace_memberships.workspace_id, auth.uid()) = 'owner'
    or (
        public.workspace_role_for(workspace_memberships.workspace_id, auth.uid()) = 'admin'
        and workspace_memberships.role <> 'owner'
    )
);

create or replace function public.prevent_workspace_type_change()
returns trigger
language plpgsql
as $$
begin
    if old.type is distinct from new.type then
        raise exception 'workspace_type_immutable';
    end if;
    return new;
end;
$$;

drop trigger if exists workspaces_prevent_type_change on public.workspaces;
create trigger workspaces_prevent_type_change
before update of type on public.workspaces
for each row execute function public.prevent_workspace_type_change();

create or replace function public.assign_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.workspace_memberships(workspace_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (workspace_id, user_id) do update
        set role = 'owner'
        where public.workspace_memberships.role is distinct from 'owner';

    return new;
end;
$$;

drop trigger if exists workspaces_assign_owner on public.workspaces;
create trigger workspaces_assign_owner
after insert on public.workspaces
for each row execute function public.assign_workspace_owner();

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.enforce_workspace_membership_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    workspace_type text;
    member_count integer;
begin
    select type
    into workspace_type
    from public.workspaces
    where id = new.workspace_id;

    if workspace_type is null then
        raise exception 'workspace_not_found';
    end if;

    select count(*)
    into member_count
    from public.workspace_memberships
    where workspace_id = new.workspace_id;

    if workspace_type = 'personal' and member_count >= 1 then
        raise exception 'personal_workspace_single_member';
    end if;

    if workspace_type = 'team' and member_count >= 10 then
        raise exception 'member_limit_reached';
    end if;

    return new;
end;
$$;

drop trigger if exists workspace_memberships_enforce_limits on public.workspace_memberships;
create trigger workspace_memberships_enforce_limits
before insert on public.workspace_memberships
for each row execute function public.enforce_workspace_membership_limits();

create or replace function public.protect_last_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    owner_count integer;
begin
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

drop trigger if exists workspace_memberships_protect_last_owner_delete on public.workspace_memberships;
create trigger workspace_memberships_protect_last_owner_delete
before delete on public.workspace_memberships
for each row execute function public.protect_last_workspace_owner();

drop trigger if exists workspace_memberships_protect_last_owner_update on public.workspace_memberships;
create trigger workspace_memberships_protect_last_owner_update
before update of role on public.workspace_memberships
for each row execute function public.protect_last_workspace_owner();
