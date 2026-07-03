# Supabase artifacts

This directory owns the local Supabase CLI project: `config.toml`, database
migrations under `migrations/`, and CLI-managed state under `.branches`/
`.temp` (ignored by Git). As of Phase 2 (Authentication and Workspace
Foundation), a live local stack is provisioned via `npx supabase start`; only
email/password Auth is enabled (`[auth.email] enable_signup = true`, every
`[auth.external.*]` provider `enabled = false` — see `config.toml`).

Phase 3 (Income, Expense, and Category Core) adds the first business-data
tables on top of that workspace foundation.

## Schema

Defined in `migrations/20260624000000_auth_workspace_foundation.sql` and
`migrations/20260625000000_income_expense_category_core.sql`, on top of the
Supabase-managed `auth.users` table.

### `public.user_profiles`

One row per `auth.users` row (`id` is both the primary key and a
`references auth.users(id) on delete cascade` foreign key). Holds `email`
(denormalized for the add-member-by-email lookup) and an optional
`display_name`. Created by the signup trigger, never directly by
application code.

### `public.workspaces`

`type` is `'personal'` or `'team'` (`CHECK`, immutable after insert via the
`prevent_workspace_type_change()` trigger). `created_by` is an audit field
only — current ownership always comes from `workspace_memberships` rows
with `role = 'owner'`, never from this column (a workspace can have a
co-Owner). A partial unique index (`workspaces_one_personal_per_creator`)
caps each user at one personal workspace. No `DELETE` policy exists —
workspace deletion/archival is out of scope this phase.

### `public.workspace_memberships`

Joins `workspaces` and `user_profiles` with a fixed `role`
(`owner`/`admin`/`member`/`viewer`, `CHECK`) and a
`UNIQUE (workspace_id, user_id)` constraint — one role per user per
workspace, which is also what makes duplicate-add rejection (FR-032)
enforceable at the constraint level.

### `public.categories`

Workspace-scoped expense labels. Every workspace receives the Saudi-first
default set when it is created: Restaurants, Groceries, Fuel,
Transportation, Rent, Utilities, Internet & Mobile, Health, Education,
Family, Shopping, Entertainment, Travel, Subscriptions, Other. Custom
categories share the same table and are ordered by `sort_order`.

Category names must be non-empty and are unique case-insensitively among
active categories in the same workspace via the
`categories_unique_active_name` partial index. Categories are archived with
`is_archived = true` instead of hard-deleted, which preserves old expense
references while allowing the archived name to be reused by a new active
category.

### `public.incomes`

Workspace-scoped confirmed income records. Amounts are stored as
`amount_minor bigint` (halalas) with `currency = 'SAR'`; zero or negative
amounts are rejected. Each row records the creating user, the date it
occurred, an optional description, and a `status` of `confirmed` or
`deleted`. Deletion is a soft-delete update that sets `status = 'deleted'`
and `deleted_at`; no SQL `DELETE` policy is exposed.

### `public.expenses`

Workspace-scoped confirmed expense records. Amounts use the same
`amount_minor bigint` plus fixed `SAR` currency as incomes. Expenses may
reference a category, but `category_id` is optional so uncategorized
expenses remain valid. `description` and `merchant_name` are separate
optional fields. Like incomes, expenses use `confirmed`/`deleted` status
with soft-delete retention instead of hard deletion.

## Functions

All helper functions are `SECURITY DEFINER` with `search_path = public`,
so they evaluate against the full tables regardless of the caller's RLS
visibility, and are granted `EXECUTE` only to `authenticated` (revoked from
`PUBLIC`):

- `find_user_profile_by_email(lookup_email)` — case-insensitive profile
  lookup for the add-member flow, without exposing a broad
  `user_profiles` `SELECT` policy.
- `workspace_role_for(workspace_id, user_id)` / `is_workspace_member(...)`
  — the role/membership check every workspace and membership RLS policy is
  built on.
- `shares_workspace_with(target_user_id, viewer_id)` — true if the viewer
  and the target share at least one workspace. Backs the
  `user_profiles` policy that lets workspace members see each other's
  email in member lists, without allowing global profile enumeration.
- `ensure_personal_workspace(user_id, email)` — idempotent bootstrap:
  upserts the profile, creates the personal workspace if missing, and
  repairs the Owner membership if it's missing. Called by the
  `handle_new_user()` signup trigger and re-run defensively on every
  authenticated request (`apps/api/app/core/auth.py`) to self-heal an
  interrupted signup.

- `seed_default_categories()` — inserts the 15 default categories for each
  new workspace, in `sort_order` 0 through 14.
- `validate_expense_category()` — rejects an expense category assignment
  unless the category belongs to the same workspace and is active. Updates
  that do not change `category_id` are allowed, so historical references
  survive later category archival.
- `set_updated_at()` — shared timestamp helper used by Phase 3 tables.

## Row Level Security

RLS is enabled on all application tables; every policy runs `to authenticated`.
Base table grants (`grant select/insert/update/delete ... to authenticated`)
are also required — RLS policies only filter rows you already have a grant
to touch, they don't substitute for one.

- **`user_profiles`**: `SELECT` own profile, or any profile that shares a
  workspace with the caller (`shares_workspace_with`). `UPDATE` own profile
  only. No `DELETE` policy — profile lifecycle follows the auth user.
- **`workspaces`**: `SELECT`/`UPDATE` only where the caller has a
  membership row (`UPDATE` additionally requires `owner`/`admin`).
  `INSERT` allowed for any authenticated user — the `assign_workspace_owner()`
  trigger immediately inserts the creator's Owner membership in the same
  transaction, so a workspace is never briefly member-less. No `DELETE`
  policy.
- **`workspace_memberships`**: `SELECT` for any current member. `INSERT`
  restricted to `owner`/`admin` callers adding a non-owner role (the
  Owner row itself is only ever created by the `assign_workspace_owner()`
  trigger). `UPDATE` of `role` follows the Owner/Admin matrix in
  `specs/002-auth-workspace-foundation/research.md` Decision 7. `DELETE`
  allowed for `owner`/`admin` removing a non-owner, or a member deleting
  their own row (voluntary leave).

- **`categories`**: `SELECT` for any workspace member, including Viewer.
  `INSERT` and `UPDATE` are restricted to `owner`/`admin` callers for
  create, rename, archive, and reorder operations. No `DELETE`
  policy exists; archive is the removal path for this phase.
- **`incomes`**: `SELECT` for any workspace member. `INSERT` and `UPDATE`
  are restricted to `owner`/`admin` callers, covering create, edit, and
  soft-delete. Members and Viewers cannot create or modify income records.
  No `DELETE` policy exists.
- **`expenses`**: `SELECT` for any workspace member. `INSERT` is allowed
  for `owner`, `admin`, and `member`, but not `viewer`. `UPDATE` is
  allowed for `owner`/`admin` on any expense, or for a `member` only when
  `created_by = auth.uid()`, covering edit and soft-delete. Viewers cannot
  create or modify expense records. No `DELETE` policy exists.
- **`files`**: receipt/invoice metadata is workspace-scoped and readable by
  any workspace member, including Viewer. `INSERT` is allowed for
  `owner`/`admin`/`member`; `UPDATE` supports link/detach and soft-delete
  metadata, with finer action rules enforced in FastAPI before any Storage
  call. No SQL `DELETE` grant or policy exists; deleting a file soft-deletes
  metadata and keeps the row for history.

## Triggers

- `workspaces_prevent_type_change` (`BEFORE UPDATE OF type`) — rejects
  changing a workspace's `type` after creation.
- `workspaces_assign_owner` (`AFTER INSERT` on `workspaces`) — inserts the
  creator's Owner membership row.
- `on_auth_user_created` (`AFTER INSERT` on `auth.users`) — calls
  `ensure_personal_workspace()` to bootstrap the profile and personal
  workspace for a new signup.
- `workspace_memberships_enforce_limits` (`BEFORE INSERT` on
  `workspace_memberships`) — rejects a second membership row on a
  `personal` workspace, and rejects an 11th row on a `team` workspace
  (10-member cap, FR-030).
- `workspace_memberships_protect_last_owner_delete` /
  `_update` (`BEFORE DELETE` / `BEFORE UPDATE OF role`) — rejects removing
  or demoting the sole remaining Owner of a workspace (FR-017).

- `workspaces_seed_default_categories` (`AFTER INSERT` on `workspaces`) —
  inserts the 15 default categories for every personal or team workspace.
- `categories_set_updated_at`, `incomes_set_updated_at`,
  `expenses_set_updated_at` (`BEFORE UPDATE`) — refresh `updated_at` on
  each edit, archive/reorder, or soft-delete.
- `expenses_validate_category` (`BEFORE INSERT OR UPDATE OF category_id`) —
  rejects a category from another workspace (`category_not_in_workspace`)
  or an archived category (`category_archived`) when a category is newly
  assigned or changed.

## Receipt and invoice Storage

Phase 6 adds one private Supabase Storage bucket:

- Bucket id/name: `receipts`.
- Public access: disabled. The app must never use public URLs for receipts or
  invoices.
- Object key convention: `{workspace_id}/{file_id}`. Both segments are UUIDs
  generated or read from trusted database rows; no user-controlled filename or
  path segment is stored in the object key.
- Metadata: `public.files.storage_path` stores the same key, while display
  name, content type, size, uploader, linked expense, and soft-delete history
  remain in Postgres.
- Access path: browsers upload bytes to FastAPI, not directly to Storage.
  FastAPI validates membership, role, magic-byte content type, and size before
  calling Storage with the service-role key.
- Preview/download: FastAPI verifies the caller can read the workspace file and
  then mints a short-lived signed URL, capped at 300 seconds.
- Delete: FastAPI verifies Owner/Admin, soft-deletes the metadata row, and
  removes the object from the bucket. The metadata row is retained for history.

The Storage RLS policies on `storage.objects` are a defense-in-depth backstop:
they scope direct object operations to authenticated members of the workspace
encoded in the first key segment. They are not the primary authorization layer,
because the backend uses the service-role key for object operations and must
perform its own role checks first.

Required backend environment variables for this path are the same local values
printed by `npx supabase status` and copied into `apps/api/.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_JWT_SECRET`

Only `apps/api` may use `SUPABASE_SERVICE_ROLE_KEY`. Frontend env files use
the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) for Auth only and must never
contain the service-role key.

## Local development

```bash
npx supabase start     # applies every migration to a fresh local Postgres
npx supabase db reset  # re-applies migrations from scratch, wiping local data
```

Copy the printed URLs/keys from `npx supabase status` into `apps/api/.env` —
see `docs/setup.md`.
