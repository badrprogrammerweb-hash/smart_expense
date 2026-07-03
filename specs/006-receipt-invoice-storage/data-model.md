# Phase 1 Data Model: Receipt and Invoice Storage

Extends the Phase 2–3 schema (`workspaces`, `user_profiles`, `expenses`, RLS
helpers `is_workspace_member`, `workspace_role_for`). One new table, one
additive column, one new private Storage bucket. Money/financial tables are
untouched.

## New table: `public.files`

Represents an uploaded receipt or invoice. Workspace-scoped, RLS-enabled,
soft-deleted.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, `default gen_random_uuid()` | Also the Storage object key suffix (`{workspace_id}/{id}`). |
| `workspace_id` | `uuid` | `not null`, FK → `workspaces(id) on delete cascade` | Tenant boundary (FR-006, FR-024). |
| `uploaded_by` | `uuid` | `not null`, FK → `user_profiles(id) on delete restrict` | Uploader identity (FR-006). |
| `expense_id` | `uuid` | `null`, FK → `expenses(id) on delete set null` | Optional link; ≤1 expense per file (FR-013). Expense delete unlinks (FR-015). |
| `original_filename` | `text` | `not null`, length ≤ 255 | Display name (FR-006). |
| `content_type` | `text` | `not null`, `check (content_type in ('image/png','image/jpeg','image/webp','application/pdf'))` | Server-validated real type (FR-002, FR-004). |
| `size_bytes` | `bigint` | `not null`, `check (size_bytes > 0 and size_bytes <= 10485760)` | >0 and ≤10 MB (FR-003, FR-005). |
| `storage_path` | `text` | `not null` | `{workspace_id}/{id}` object key in the `receipts` bucket. |
| `status` | `text` | `not null default 'active'`, `check (status in ('active','deleted'))` | Soft-delete state (FR-017), mirrors `expenses.status`. |
| `deleted_at` | `timestamptz` | `null` | Set on soft delete (FR-017). |
| `deleted_by` | `uuid` | `null`, FK → `user_profiles(id) on delete set null` | Who deleted (history). |
| `created_at` | `timestamptz` | `not null default now()` | Upload timestamp (FR-006). |
| `updated_at` | `timestamptz` | `not null default now()`, maintained by `set_updated_at` trigger | Reuse existing trigger pattern. |

**Indexes**:
- `idx_files_workspace_active` on `(workspace_id)` where `status = 'active'` —
  workspace file list (FR-008).
- `idx_files_expense` on `(expense_id)` where `expense_id is not null` —
  expense→files lookup (FR-012).

**Cross-workspace link integrity**: a trigger (`files_validate_expense`,
mirroring the existing `expenses_validate_category` trigger) rejects setting
`expense_id` to an expense whose `workspace_id` differs from the file's
`workspace_id` (FR-014). Enforced in the backend service layer as well.

### State transitions

```text
(no row) --upload--> active
active   --link/detach--> active   (expense_id set / nulled)
active   --delete (Owner/Admin)--> deleted   (binary removed, row retained)
deleted  --(terminal this phase; no restore, no re-link)-->
```

- A `deleted` file cannot be newly linked to an expense (spec edge case).
- No hard delete and no restore path this phase (mirrors Phase 3 soft-delete).

## Additive column: `public.workspaces.auto_delete_after_extraction`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `auto_delete_after_extraction` | `boolean` | `not null default false` | Workspace preference (FR-020). Owner-only to change (FR-021). **Inert this phase** — no code consumes it (FR-022); readied for Phase 8. |

## Existing table touchpoints

- **`expenses`**: no column change. Gains a reverse relationship via
  `files.expense_id`. Financial columns/behavior unchanged (constitution X).
- **`workspaces`**: gains the boolean above; all other columns unchanged.
- **`user_profiles`**: referenced by `files.uploaded_by` / `files.deleted_by`.

## RLS policies on `public.files`

Reuse `public.is_workspace_member(ws, uid)` and
`public.workspace_role_for(ws, uid)`; roles are `owner|admin|member|viewer`.

| Policy | Command | Predicate |
|--------|---------|-----------|
| Members can read files | `SELECT` | `is_workspace_member(files.workspace_id, auth.uid())` — all roles incl. Viewer (FR-008). |
| Non-viewers can create files | `INSERT` | `uploaded_by = auth.uid() and workspace_role_for(files.workspace_id, auth.uid()) in ('owner','admin','member')` (FR-001). |
| Owners/admins/uploaders can update files | `UPDATE` | `workspace_role_for(ws, uid) in ('owner','admin')` **or** `(workspace_role_for(ws, uid)='member' and files.uploaded_by = auth.uid())` — covers link/detach + soft-delete write. |

**Backend-enforced refinements (constitution IX, not fully expressible in RLS)**:
- Soft **delete** (`status → deleted`) is restricted to Owner/Admin in the
  service layer even though the coarse `UPDATE` policy would let a Member update
  their own row; Members may only link/detach.
- Service-role Storage operations (object write, signed URL, object remove)
  bypass RLS entirely and are gated solely by the backend role check before the
  call. Anonymous requests are rejected at auth (FR-010).
- Changing `auto_delete_after_extraction` is Owner-only, enforced in the
  workspace-settings service/route (FR-021).

`grant select, insert, update on public.files to authenticated;` — no `delete`
grant (soft delete only).

## New private Storage bucket: `receipts`

- Created **private** (`public = false`) via the migration.
- Object key convention: `{workspace_id}/{file_id}` (no extension needed; type
  is in metadata).
- Storage policies scope object access to authenticated workspace members as
  defense in depth; the authoritative access path is backend-mediated
  service-role signing after a backend authorization check (research
  Decision 1 & 5). No public read policy; no public URL is ever generated
  (constitution VIII; FR-007, FR-010).

## Validation rules summary (enforced in backend before Storage write)

- Content type ∈ {png, jpeg, webp, pdf} by magic-byte sniff (FR-002/004).
- `0 < size_bytes ≤ 10 MB` (FR-003/005).
- Caller role permits the action per the role matrix (FR-001/012/016/021/023).
- Link target expense exists and shares `workspace_id` (FR-014).
- File `status = 'active'` for download/link operations (edge cases).
