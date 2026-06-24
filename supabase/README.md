# Supabase artifacts

This directory owns the local Supabase CLI project: `config.toml`, database
migrations under `migrations/`, and CLI-managed state under `.branches`/
`.temp` (ignored by Git). As of Phase 2 (Authentication and Workspace
Foundation), a live local stack is provisioned via `supabase start`; only
email/password Auth is enabled (`[auth.email] enable_signup = true`, every
`[auth.external.*]` provider `enabled = false` — see `config.toml`).

## Schema

Defined in `migrations/20260624000000_auth_workspace_foundation.sql`, on top
of the Supabase-managed `auth.users` table.

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

## Row Level Security

RLS is enabled on all three tables; every policy runs `to authenticated`.
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

## Local development

```bash
supabase start   # applies every migration to a fresh local Postgres
supabase db reset  # re-applies migrations from scratch, wiping local data
```

Copy the printed URLs/keys from `supabase status` into `apps/api/.env` —
see `docs/setup.md`.
