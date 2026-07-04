# Phase 0 Research: BYOK AI Settings

All decisions below resolve the Technical Context for
`specs/007-byok-ai-settings/plan.md`. There are no open `NEEDS CLARIFICATION`
items.

## Decision 1 — Secret storage: Supabase Vault (not application tables)

**Decision**: Store the raw provider API key in **Supabase Vault**. Application
tables store only non-secret metadata plus a `vault_secret_id` reference.

**Rationale**: Constitution Principle VI mandates "secure BYOK storage using
Supabase Vault." Vault encrypts secrets at rest (authenticated encryption via
pgsodium/`vault._crypto_aead_det_encrypt`) and exposes plaintext only through the
`vault.decrypted_secrets` view, which is restricted to privileged roles. This
satisfies FR-006 (encrypted at rest) and, combined with never granting the
decrypted view to `authenticated`, FR-007/FR-010 (never returned to the client).

**Alternatives considered**: None entertained. Application-level encryption
(pgcrypto, app-managed keys) or storing the key in a normal column would
contradict the mandated approach and is treated as a constitution violation, not
a tradeoff.

## Decision 2 — Vault access from the app: SECURITY DEFINER RPCs over the RLS session

**Decision**: Perform every Vault write from two `SECURITY DEFINER` SQL functions
in the `public` schema, invoked from the existing authenticated RLS session
(`get_rls_session`):
- `public.set_workspace_ai_key(p_workspace_id uuid, p_provider text, p_api_key text)`
- `public.clear_workspace_ai_key(p_workspace_id uuid)`

Each function first asserts the caller is the workspace **Owner** using the
existing `public.workspace_role_for(workspace_id, auth.uid())` helper (raising
`insufficient_privilege` / mapped to 403 otherwise), then performs the Vault
operation with the definer's elevated rights. `EXECUTE` on both functions is
granted to `authenticated`; direct write access to `workspace_ai_settings` and to
the `vault` schema is **not**.

**Rationale**: Vault is SQL-only (no REST surface), so the Phase 6 service-role
REST pattern (`services/storage.py`) does not apply. The codebase already uses a
`SECURITY DEFINER` function to perform a privileged, app-authorized DB mutation
(`public.unlink_files_on_expense_soft_delete`), so this matches an established
pattern. Putting the Owner check *inside* the definer function guarantees the
privilege escalation can never be used by a non-Owner even if called directly.
The FastAPI service **also** checks Owner before calling (constitution IX:
defense in depth; RLS/DB checks alone are insufficient).

**Alternatives considered**:
- *Dedicated service-role DB connection for Vault writes* — rejected: adds a
  second privileged DB session and duplicates authorization outside the DB, more
  surface for mistakes than one audited definer function.
- *PostgREST RPC with the service key from the backend* — rejected: same
  double-session cost; the in-DB definer function is simpler and colocated with
  RLS.

## Decision 3 — Vault function signatures verified against the live local stack

**Decision**: Use `vault.create_secret` and `vault.update_secret`; delete a
secret by removing its row from `vault.secrets`.

**Verification (performed 2026-07-04 against `supabase_db_smart-expense-ai`)**:
```
vault.create_secret(new_secret text, new_name text DEFAULT NULL,
                     new_description text DEFAULT '', new_key_id uuid DEFAULT NULL) -> uuid
vault.update_secret(secret_id uuid, new_secret text DEFAULT NULL,
                     new_name text DEFAULT NULL, new_description text DEFAULT NULL,
                     new_key_id uuid DEFAULT NULL) -> void
vault.secrets            -> table (delete by id/name removes the secret)
vault.decrypted_secrets  -> view (never granted to anon/authenticated)
```
A `begin; create_secret → update_secret → delete from vault.secrets → rollback;`
cycle succeeded as role `postgres`.

**Implementer precondition (still verify in the target stack)**: the migration
must be applied by a role that can execute `vault.create_secret` (locally
`postgres` can). Confirm the two wrapper functions end up **owned by** that
privileged role so their `SECURITY DEFINER` context has Vault access, and that
`EXECUTE` is granted to `authenticated` while the `vault` schema is not otherwise
exposed. This is a task precondition, not an assumed detail.

## Decision 4 — Rotation strategy: update in place, create only when absent

**Decision**: When a workspace already has a configured key, `set_workspace_ai_key`
calls `vault.update_secret(existing_vault_secret_id, p_api_key, ...)` — keeping the
same `vault_secret_id` and overwriting the plaintext. Only the first-time
configuration calls `vault.create_secret(...)`. Provider switch is the same path
(the row's `provider` and `key_last4` update alongside the in-place secret
update).

**Rationale**: `update_secret` overwrites the stored plaintext, satisfying FR-013
("destroy the previously stored secret") with no window in which the metadata row
references a deleted/missing secret. It is simpler and safer than
delete-then-create. `create_secret` is used only when no row exists.

## Decision 5 — Lightweight, shape-only key validation (no live call)

**Decision**: Validate submitted keys by shape only, in the backend service,
before any RPC call. No network call is made to the provider (FR-005). Starting
rules (tunable planning defaults, deliberately permissive):
- **OpenAI**: begins with `sk-` (includes variants such as `sk-proj-`), total
  length ≥ 20, characters in `[A-Za-z0-9_-]`.
- **Gemini (Google AI)**: begins with `AIza`, total length in ~[35, 45],
  characters in `[A-Za-z0-9_-]`.
- **Both**: trimmed, non-empty, no surrounding whitespace, reasonable max length
  (e.g. ≤ 400) to bound input.

**Rationale**: FR-004 requires lightweight, provider-appropriate shape checks with
a clear rejection message and nothing stored on failure; FR-005 forbids live
verification this phase. Provider formats can change, so rules are intentionally
loose (prefix + length band + charset) and centralized so they can be tuned
without touching the contract. A valid-shape but wrong/revoked key is accepted and
first exercised in Phase 8 (Assumptions; Edge Cases).

## Decision 6 — Masked hint: provider + last 4 characters, stored as non-secret

**Decision**: Persist `key_last4` (the last 4 characters of the key) as a plain,
non-secret column on `workspace_ai_settings`, computed once at write time
(`right(p_api_key, 4)` inside the RPC). Clients render "provider • ••••{last4}".

**Rationale**: Clarifications fixed the masked hint at provider name + last 4
characters and nothing more. Four trailing characters cannot reconstruct a 20–45
character key. Storing the hint as a derived non-secret column means the `GET`
status path never touches Vault and never needs the decrypted view — keeping the
read path completely free of the secret.

## Decision 7 — No secret in logs, errors, or diagnostics (leak vectors)

**Decision**: Treat "the key must never be logged" as a first-class requirement
(FR-009, FR-024; constitution XIV "AI key security"):
- The inbound key is typed as Pydantic `SecretStr` in the request schema so it is
  not accidentally serialized in repr/validation errors.
- The `ai_settings` service never logs the key or the full request body; it
  reuses the redaction discipline from `services/storage.py` (`_redact_secret`)
  for any diagnostic string.
- SQLAlchemy engine `echo` stays **off** (it already is), so the RPC's key
  parameter is not echoed. Because the raw key travels as a bound RPC parameter,
  confirm the target Postgres does **not** have `log_statement = 'all'` / `mod`
  or `pgaudit` capturing statement parameters (local Supabase default does not).
- Validation failures return a generic "invalid key format for {provider}"
  message that never includes the submitted value.

**Rationale**: The most likely real-world leak of a BYOK secret is not the API
response (covered by never returning it) but statement/parameter logging and
error serialization. Naming these vectors keeps the security guarantee testable
(SC-002/SC-008) and gives Phase 8 a clean, secret-safe foundation.

## Decision 8 — HTTP surface: GET status / PUT configure-replace / DELETE remove

**Decision**: Three endpoints under `/workspaces/{workspace_id}/ai-settings`:
- `GET` → status (configured, provider, masked hint, updated_at, updated_by);
  authorized to all workspace members incl. Viewer.
- `PUT` → single idempotent path for both first-time configure and replace/switch
  (body: provider + key); Owner only.
- `DELETE` → remove/clear; Owner only; no-op-safe when nothing is configured.

**Rationale**: "Configure over an existing key = replace" is one path (Edge Cases;
FR of one active config), so a single `PUT` upsert avoids a spurious
configured-vs-not branch in the API. `GET`/`PUT`/`DELETE` map cleanly to
view/set/clear and mirror the existing workspace-settings `PATCH` authorization
style in `routes/workspaces.py`.
