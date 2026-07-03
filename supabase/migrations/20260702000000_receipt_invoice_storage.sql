alter table public.workspaces
    add column if not exists auto_delete_after_extraction boolean not null default false;

create table if not exists public.files (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    uploaded_by uuid not null references public.user_profiles(id) on delete restrict,
    expense_id uuid references public.expenses(id) on delete set null,
    original_filename text not null check (
        length(btrim(original_filename)) > 0
        and length(original_filename) <= 255
    ),
    content_type text not null check (
        content_type in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')
    ),
    size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
    storage_path text not null,
    status text not null default 'active' check (status in ('active', 'deleted')),
    deleted_at timestamptz,
    deleted_by uuid references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_files_workspace_active
    on public.files(workspace_id)
    where status = 'active';

create index if not exists idx_files_expense
    on public.files(expense_id)
    where expense_id is not null;

drop trigger if exists files_set_updated_at on public.files;
create trigger files_set_updated_at
before update on public.files
for each row execute function public.set_updated_at();

create or replace function public.validate_file_expense()
returns trigger
language plpgsql
as $$
declare
    expense_workspace_id uuid;
begin
    if new.expense_id is null then
        return new;
    end if;

    if tg_op = 'UPDATE' and old.expense_id is not distinct from new.expense_id then
        return new;
    end if;

    select expenses.workspace_id
    into expense_workspace_id
    from public.expenses
    where expenses.id = new.expense_id;

    if expense_workspace_id is null or expense_workspace_id is distinct from new.workspace_id then
        raise exception 'expense_not_in_workspace';
    end if;

    return new;
end;
$$;

drop trigger if exists files_validate_expense on public.files;
create trigger files_validate_expense
before insert or update of expense_id on public.files
for each row execute function public.validate_file_expense();

grant select, insert, update on public.files to authenticated;

alter table public.files enable row level security;

create policy "Members can read files"
on public.files
for select
to authenticated
using (public.is_workspace_member(files.workspace_id, auth.uid()));

create policy "Owners admins and members can create files"
on public.files
for insert
to authenticated
with check (
    files.uploaded_by = auth.uid()
    and public.workspace_role_for(files.workspace_id, auth.uid()) in ('owner', 'admin', 'member')
);

create policy "Owners admins and uploaders can update files"
on public.files
for update
to authenticated
using (
    public.workspace_role_for(files.workspace_id, auth.uid()) in ('owner', 'admin')
    or (
        public.workspace_role_for(files.workspace_id, auth.uid()) = 'member'
        and files.uploaded_by = auth.uid()
    )
)
with check (
    public.workspace_role_for(files.workspace_id, auth.uid()) in ('owner', 'admin')
    or (
        public.workspace_role_for(files.workspace_id, auth.uid()) = 'member'
        and files.uploaded_by = auth.uid()
    )
);

insert into storage.buckets(id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update
set public = false;

create or replace function public.receipt_object_workspace_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
    workspace_id_text text;
begin
    workspace_id_text := split_part(object_name, '/', 1);
    if workspace_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        return null;
    end if;

    return workspace_id_text::uuid;
exception
    when invalid_text_representation then
        return null;
end;
$$;

-- storage.objects already has row level security enabled by Supabase; only the
-- receipt-scoped policies below are added here. (Re-enabling RLS would be
-- redundant locally and can fail on hosted Supabase, where storage.objects is
-- owned by supabase_storage_admin rather than the migration role.)

create policy "Workspace members can read receipt objects"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'receipts'
    and public.receipt_object_workspace_id(name) is not null
    and public.is_workspace_member(public.receipt_object_workspace_id(name), auth.uid())
);

create policy "Non viewers can create receipt objects"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'receipts'
    and public.receipt_object_workspace_id(name) is not null
    and public.workspace_role_for(public.receipt_object_workspace_id(name), auth.uid()) in ('owner', 'admin', 'member')
);

create policy "Non viewers can update receipt objects"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'receipts'
    and public.receipt_object_workspace_id(name) is not null
    and public.workspace_role_for(public.receipt_object_workspace_id(name), auth.uid()) in ('owner', 'admin', 'member')
)
with check (
    bucket_id = 'receipts'
    and public.receipt_object_workspace_id(name) is not null
    and public.workspace_role_for(public.receipt_object_workspace_id(name), auth.uid()) in ('owner', 'admin', 'member')
);

create policy "Owners and admins can delete receipt objects"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'receipts'
    and public.receipt_object_workspace_id(name) is not null
    and public.workspace_role_for(public.receipt_object_workspace_id(name), auth.uid()) in ('owner', 'admin')
);
