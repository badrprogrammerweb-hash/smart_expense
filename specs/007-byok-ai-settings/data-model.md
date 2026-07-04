# Phase 1 Data Model: BYOK AI Settings

Derived from spec Key Entities + Functional Requirements and the Phase 0
decisions. One new metadata table plus Supabase Vault for the secret. No changes
to any existing financial table.

## New table: `public.workspace_ai_settings`

One row per workspace that has a configured key. **Absence of a row = "not
configured."** `workspace_id` is the primary key, so a workspace can hold at most
one active provider + key (FR-002).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `workspace_id` | `uuid` | **PK**, `references public.workspaces(id) on delete cascade` | One config per workspace; removed with the workspace. |
| `provider` | `text` | `not null`, `check (provider in ('gemini','openai'))` | Selected AI provider (FR-001). |
| `vault_secret_id` | `uuid` | `not null` | Reference to `vault.secrets.id`. Not a DB-level FK (cross-schema to `vault`); integrity maintained by the RPCs. Never the secret itself. |
| `key_last4` | `text` | `not null`, `check (char_length(key_last4) <= 4)` | Masked hint = last 4 chars of the key (FR-008; Decision 6). Non-secret. |
| `updated_by` | `uuid` | `not null`, `references public.user_profiles(id)` | Who last configured/replaced (FR-024). Mirrors `files.uploaded_by` convention. |
| `created_at` | `timestamptz` | `not null default now()` | First configured at. |
| `updated_at` | `timestamptz` | `not null default now()` | Last configure/replace time (FR-024). Set by the RPC on every write. |

**Notes**
- The raw key is **never** a column here — it lives only in Vault (Decision 1).
- No soft-delete/`deleted_at`: removal is a hard delete of this row plus the Vault
  secret; no prior-key history is retained (FR-013; Clarifications).
- No status column: "configured" is derived from row existence, so there is no
  provider-without-key or key-without-provider limbo (FR-003).

### State model

```
NOT CONFIGURED (no row)
      │  PUT (Owner, valid-shape key)  →  vault.create_secret + INSERT row
      ▼
   CONFIGURED (row present: provider + vault_secret_id + key_last4)
      │  PUT (Owner, valid-shape key)  →  vault.update_secret(same id) + UPDATE row
      │        (same provider = rotate; other provider = switch)
      └──────────────────────────────────────────────┐
      │  DELETE (Owner)  →  delete vault secret + DELETE row
      ▼
NOT CONFIGURED (no row)
```

Invalid-shape `PUT` and non-Owner `PUT`/`DELETE` cause **no** state change
(FR-014, FR-020). `DELETE` on NOT CONFIGURED is a safe no-op (FR-016).

## Supabase Vault secret (external to `public`)

| Aspect | Value |
|--------|-------|
| Store | `vault.secrets` (encrypted at rest); plaintext only via `vault.decrypted_secrets`. |
| Name | Deterministic per workspace, e.g. `workspace_ai_key:{workspace_id}` (unique). |
| Value | The raw provider API key. Written via `vault.create_secret` / `vault.update_secret`; removed via `delete from vault.secrets`. |
| Access | Only the `SECURITY DEFINER` RPCs (definer role has Vault rights). `authenticated`/`anon` are **never** granted the decrypted view. Not read at all this phase. |

## Row-Level Security (`workspace_ai_settings`)

RLS **enabled**. The metadata table carries no secret, but access is still scoped
to enforce tenant isolation and the read/write split.

| Operation | Policy | Rationale |
|-----------|--------|-----------|
| `SELECT` | `to authenticated using (public.workspace_role_for(workspace_id, auth.uid()) is not null)` | All members incl. Viewer may read status (FR-021); non-members/other workspaces see nothing (FR-023). |
| `INSERT` / `UPDATE` / `DELETE` | **No policy** (deny by default for `authenticated`) | All writes go **only** through the `SECURITY DEFINER` RPCs, which do their own Owner check (FR-020; Decision 2). Direct table writes are impossible for app roles. |

The `GET` status query selects only `provider, key_last4, updated_at, updated_by`
(+ derived `configured = true`); it never selects anything secret and never
touches Vault.

## SECURITY DEFINER RPCs (authorization + Vault lifecycle)

Full SQL contract in [contracts/vault-rpc.md](./contracts/vault-rpc.md). Behavior
summary:

- **`public.set_workspace_ai_key(p_workspace_id uuid, p_provider text, p_api_key text)`**
  1. `assert workspace_role_for(p_workspace_id, auth.uid()) = 'owner'` else raise
     (→ 403).
  2. Guard: `p_provider in ('gemini','openai')`; `p_api_key` non-empty
     (backend already did full shape validation).
  3. If a row exists → `vault.update_secret(vault_secret_id, p_api_key)`, then
     `UPDATE` row (`provider`, `key_last4 = right(p_api_key,4)`,
     `updated_by = auth.uid()`, `updated_at = now()`).
     Else → `vault.create_secret(p_api_key, 'workspace_ai_key:'||p_workspace_id)`
     returning id, then `INSERT` row.
  4. Return the non-secret row (provider, key_last4, updated_at, updated_by).
- **`public.clear_workspace_ai_key(p_workspace_id uuid)`**
  1. Owner assert (as above).
  2. If a row exists → `delete from vault.secrets where id = vault_secret_id`,
     then `DELETE` the row. Else → no-op.
  3. Return whether anything was removed.

Both are owned by a Vault-privileged role, `EXECUTE` granted to `authenticated`
only, and never log or return `p_api_key`.

## Relationship to existing entities

- **Workspace (existing)** 1—0..1 **workspace_ai_settings**. Deleting a workspace
  cascades the row; the RPCs are responsible for also clearing the Vault secret on
  explicit removal.
- **User Profile (existing)** ←`updated_by`— **workspace_ai_settings**.
- **Workspace Membership / Role (existing)** governs access: Owner → set/clear;
  any member → read status.
- **Income / Expense / Category / File (existing)** — **unchanged**. No FK, no
  behavioral coupling; BYOK state never affects financial totals (FR-019).
