-- Phase 5 fixes for receipt/invoice linking.
--
-- Two problems, one root cause: the files UPDATE RLS policy was narrower than
-- the application's link/detach authorization (owner/admin/member), so a member
-- operating on a file uploaded by someone else was silently RLS-filtered.
--
--   1. link/detach of a non-uploaded file returned a misleading 404.
--   2. Deleting an expense is a *soft* delete (status='deleted'), so the
--      files.expense_id `on delete set null` FK never fires; the route's manual
--      unlink UPDATE ran under the deleter's RLS and silently no-opped on any
--      linked file they had not uploaded, leaving a dangling expense_id.

-- Fix #1: link/detach for any non-viewer member (matches US3 and LINK_ROLES).
-- Row-level delete authorization (owner/admin only) stays enforced in the API
-- service layer; this policy only governs row visibility for UPDATE.
drop policy if exists "Owners admins and uploaders can update files" on public.files;

create policy "Non viewers can update files"
on public.files
for update
to authenticated
using (
    public.workspace_role_for(files.workspace_id, auth.uid()) in ('owner', 'admin', 'member')
)
with check (
    public.workspace_role_for(files.workspace_id, auth.uid()) in ('owner', 'admin', 'member')
);

-- Fix #2: authoritatively unlink files when an expense is soft-deleted. Runs as
-- the definer so it bypasses the caller's files-UPDATE RLS and always fires,
-- regardless of who uploaded the file or who deletes the expense. This mirrors
-- the intent of the `on delete set null` FK, which cannot fire on a soft delete.
create or replace function public.unlink_files_on_expense_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.files
    set expense_id = null
    where expense_id = new.id
      and expense_id is not null;
    return new;
end;
$$;

drop trigger if exists expenses_unlink_files_on_soft_delete on public.expenses;
create trigger expenses_unlink_files_on_soft_delete
after update of status on public.expenses
for each row
when (new.status = 'deleted' and old.status is distinct from 'deleted')
execute function public.unlink_files_on_expense_soft_delete();
