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

## BYOK AI Settings

Phase 7 adds `public.workspace_ai_settings`, a one-row-per-workspace metadata
table for optional AI provider keys. The table stores only non-secret fields:
`provider` (`gemini` or `openai`), `vault_secret_id`, `key_last4`, `updated_by`,
`created_at`, and `updated_at`. The raw key is never stored in `public` tables.

The raw provider key is stored in Supabase Vault as a secret named
`workspace_ai_key:{workspace_id}`. Clients and normal authenticated database
roles are never granted access to `vault.decrypted_secrets`; this phase only
writes, replaces, and deletes the secret.

All writes go through two `SECURITY DEFINER` functions:

- `public.set_workspace_ai_key(workspace_id, provider, api_key)` checks that
  `auth.uid()` is the workspace Owner, then creates a Vault secret on first
  configuration or updates the existing `vault_secret_id` in place on replace or
  provider switch. It returns only provider, last-4 hint, updater, and timestamp.
- `public.clear_workspace_ai_key(workspace_id)` checks Owner role, deletes the
  Vault secret if present, deletes the metadata row, and is safe to call when no
  configuration exists.

`authenticated` receives `SELECT` on `workspace_ai_settings` and `EXECUTE` on
those two RPCs only. Direct `INSERT`, `UPDATE`, and `DELETE` grants are revoked
so the app cannot bypass the RPC Owner checks. The migration must run as, or set
function ownership to, a role with Vault privileges (locally `postgres`) so the
definer context can call `vault.create_secret`, `vault.update_secret`, and delete
from `vault.secrets`.

FastAPI accesses this feature through the regular authenticated RLS session. The
backend performs a second Owner check before calling the write RPCs, uses
Pydantic `SecretStr` for inbound keys, validates key shape without any provider
network call, and never logs or returns the raw key.

## AI Extraction and Review

Phase 8 adds `public.ai_extractions`, one row per extraction **attempt** on a
receipt/invoice file (a file may accumulate many rows over time; at most one
`processing`/`ready_for_review` row per file, enforced by the partial unique
index `ai_extractions_one_active_per_file`). Columns: `workspace_id`,
`file_id`, `provider` (`gemini`/`openai`, copied from
`workspace_ai_settings.provider` at trigger time so a later provider switch
doesn't relabel history), `status` (`processing` → `ready_for_review` |
`failed`, then terminal `confirmed` or `discarded`), the draft fields
(`amount_minor`, `extracted_currency`, `occurred_on`, `vendor_name`,
`suggested_category`), `failure_reason` (set only when `status = 'failed'`,
one of a fixed enum — never the raw provider error), `triggered_by`/
`triggered_at`, `confirmed_by`/`confirmed_at`, `discarded_by`/`discarded_at`,
and `expense_id` (set only on confirm). No new columns on `files` or
`workspaces`; both are only read/updated through columns they already had
(`files.expense_id`/`status`, `workspaces.auto_delete_after_extraction`).

RLS: any workspace member (including Viewer) may `SELECT`. `INSERT` is
restricted to `owner`/`admin`/`member` with `triggered_by = auth.uid()`,
requires the target file to be active/unlinked/in-workspace, and requires
BYOK to be configured (defense-in-depth alongside the backend's own checks).
`UPDATE` covers both the system's own processing→terminal write and discard:
`owner`/`admin` on any row, `member` only on a row they triggered. No
`DELETE` policy — extraction rows are permanent history, matching
`expenses`/`files`.

Two `SECURITY DEFINER` functions, owned by the same Vault-privileged role as
the Phase 7 BYOK functions (locally `postgres`), `EXECUTE` granted to
`authenticated` only:

- `public.get_workspace_ai_key_for_extraction(workspace_id)` — the **first**
  function in this project to read `vault.decrypted_secrets`. Checks the
  caller is `owner`/`admin`/`member` (raises `42501` otherwise, explicitly
  null-checking the role so a non-member's `NULL` can't silently bypass the
  check), then joins `workspace_ai_settings` to `vault.decrypted_secrets` and
  returns `(provider, api_key)`. Zero rows means BYOK isn't configured — the
  function does not raise for that case, only for unauthorized access. The
  decrypted key is returned to the backend only; it lives in Python process
  memory for the duration of one extraction call and is never logged,
  returned to a client, or persisted outside Vault.
- `public.confirm_ai_extraction(extraction_id, amount_minor, occurred_on,
  category_id, merchant_name, description)` — atomically validates
  ownership (`owner`/`admin` any row, `member` only their own), validates
  `amount_minor > 0` and `occurred_on is not null`, inserts the `expenses`
  row (`currency` hardcoded `'SAR'` regardless of the extraction's detected
  currency), links `files.expense_id`, soft-deletes the file when the
  workspace's `auto_delete_after_extraction` is on, and marks the extraction
  `confirmed` — all in one transaction, guarded by `where status =
  'ready_for_review'` so a duplicate/concurrent confirm is a no-op rather
  than a second expense. Returns `(expense_id, should_delete_binary,
  storage_path)`; the backend removes the Storage object (if
  `should_delete_binary`) only **after** this transaction commits. This
  function's write to `files` is the one place a Member gains a capability
  they don't otherwise have (Phase 6 restricts file deletion to Owner/Admin)
  — reachable only through a valid, own-triggered `ready_for_review`
  extraction, and only because `SECURITY DEFINER` bypasses `files` RLS
  (`files` has no `FORCE ROW LEVEL SECURITY`).

Discard, and the trigger flow's own processing→terminal write, are plain
RLS-governed `UPDATE`s (no RPC) — the least-privilege surface is kept to
just the two operations above that genuinely need elevated rights (a Vault
read; an atomic cross-table write with a cross-role authorization rule).

### Provider REST calls (`apps/api/app/services/ai_providers.py`)

No vendor SDK (`google-generativeai`, `openai`) is added — Gemini's
`generateContent` and OpenAI's `chat/completions` endpoints are called
directly over the already-present `httpx` client, mirroring how
`services/storage.py` calls Supabase Storage's REST surface. Both requests
ask for structured JSON output matching a fixed schema (`amount_minor`,
`currency`, `occurred_on`, `vendor_name`, `suggested_category`, all
optional) via Gemini's `responseSchema`/`responseMimeType` and OpenAI's
`response_format: {type: "json_schema", ...}`. The decrypted key is sent as
a request **header** (Gemini: `x-goog-api-key`; OpenAI: `Authorization:
Bearer`), never as a URL query parameter, since a URL is far more likely to
end up in a log line than a header. A response that isn't valid JSON, or
doesn't parse into the expected all-optional-fields shape, is a
`malformed_response` failure — never partially trusted. HTTP-level signals
(never provider response body content) decide the failure classification:
401/403 → `invalid_key`, 429 → `rate_limited`, a timeout or connection error
→ `timeout`, anything else → `provider_error`. Storage-fetch failure ahead
of the provider call is classified `unreadable_file`. The 45-second
`httpx` client timeout is the same bound described in the API contract.

### Configuration

No new environment variables. The BYOK key is read entirely through
`get_workspace_ai_key_for_extraction`; no provider API key is ever set as
backend configuration.

## Local development

```bash
npx supabase start     # applies every migration to a fresh local Postgres
npx supabase db reset  # re-applies migrations from scratch, wiping local data
```

Copy the printed URLs/keys from `npx supabase status` into `apps/api/.env` —
see `docs/setup.md`.
