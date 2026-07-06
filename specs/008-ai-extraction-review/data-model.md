# Phase 1 Data Model: AI Extraction and Review

Derived from spec Key Entities + Functional Requirements and the Phase 0
decisions. One new table, no changes to any existing table's schema (`files`
and `workspaces` are read/written only through columns they already have from
Phase 6).

## New table: `public.ai_extractions`

One row per extraction **attempt**. A file may accumulate many rows over time
(retries after failure/discard); at most one may be active
(`processing`/`ready_for_review`) at a time (FR-003).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | **PK**, `default gen_random_uuid()` | |
| `workspace_id` | `uuid` | `not null`, `references public.workspaces(id) on delete cascade` | Isolation boundary; denormalized alongside `file_id` so RLS policies don't need a join. |
| `file_id` | `uuid` | `not null`, `references public.files(id) on delete cascade` | The source file. Files are practically never hard-deleted (Phase 6 is soft-delete-only), so cascade is a safety net, not the normal path. |
| `provider` | `text` | `not null`, `check (provider in ('gemini','openai'))` | Copied from `workspace_ai_settings.provider` at trigger time (FR-004), so a later provider switch doesn't retroactively relabel history. |
| `status` | `text` | `not null`, `check (status in ('processing','ready_for_review','failed','confirmed','discarded'))`, `default 'processing'` | State machine below. |
| `amount_minor` | `bigint` | `check (amount_minor is null or amount_minor > 0)` | Draft amount (FR-008); null if the provider could not determine it. |
| `extracted_currency` | `text` | none | Raw detected currency, **informational only** (Constraints) — never copied into `expenses.currency`, which is hard-pinned to `'SAR'`. |
| `occurred_on` | `date` | none | Draft transaction date; null if undetermined. |
| `vendor_name` | `text` | none | Draft merchant/vendor. |
| `suggested_category` | `text` | none | Free-text AI suggestion, **not** a `category_id` FK (FR-009; spec Edge Cases) — the review screen maps it to a real category or leaves it uncategorized. |
| `failure_reason` | `text` | `check (failure_reason is null or failure_reason in ('invalid_key','rate_limited','timeout','unreadable_file','malformed_response','provider_error'))` | Set only when `status = 'failed'` (research Decision 6). Never the raw provider error. |
| `triggered_by` | `uuid` | `not null`, `references public.user_profiles(id)` | Who started this attempt. Drives the Member own-record rule. |
| `triggered_at` | `timestamptz` | `not null default now()` | |
| `confirmed_by` | `uuid` | `references public.user_profiles(id)` | Null unless `status = 'confirmed'`. |
| `confirmed_at` | `timestamptz` | none | |
| `discarded_by` | `uuid` | `references public.user_profiles(id)` | Null unless `status = 'discarded'`. |
| `discarded_at` | `timestamptz` | none | |
| `expense_id` | `uuid` | `references public.expenses(id) on delete set null` | Set only on confirm (FR-014). Mirrors `files.expense_id`'s `on delete set null` convention — deleting the expense later does not erase extraction history. |
| `created_at` | `timestamptz` | `not null default now()` | |
| `updated_at` | `timestamptz` | `not null default now()` | Bumped on every status transition. |

**Partial unique index** (enforces FR-003 at the database level, not just in
application logic):

```sql
create unique index ai_extractions_one_active_per_file
  on public.ai_extractions (file_id)
  where status in ('processing', 'ready_for_review');
```

FR-003a ("a file already linked to an expense cannot be re-extracted") is
enforced by checking the existing `files.expense_id is null` condition — no
new column or index needed for it.

### State model

```
                 trigger (Session 1, Decision 7)
                          │
                          ▼
                    PROCESSING  ──────────────────────────┐
                          │   provider call (Session 2,    │ crash / restart
                          │   no DB session held)          │ before Session 3
             success      │      failure                   ▼
        ┌─────────────────┴───────────────┐        (stale > 2 min: lazily
        ▼                                  ▼         self-healed to FAILED,
 READY_FOR_REVIEW                       FAILED         reason='timeout' —
        │         │                        │            research Decision 8)
        │         │ discard                │ discard / retry (new row)
        │         ▼                        ▼
        │      DISCARDED                DISCARDED
        │ confirm (confirm_ai_extraction RPC, Decision 9)
        ▼
    CONFIRMED  (expense_id set; terminal)
```

`DISCARDED`, `CONFIRMED`, and a self-healed `FAILED` are terminal — no further
transition is allowed on that row; a new extraction on the same (now unblocked)
file is always a **new row** (FR-003, FR-022).

### Row-Level Security (`ai_extractions`)

RLS **enabled**.

| Operation | Policy | Rationale |
|-----------|--------|-----------|
| `SELECT` | `to authenticated using (public.workspace_role_for(workspace_id, auth.uid()) is not null)` | Any member, **including Viewer**, may view any extraction read-only (FR-010; Clarifications). |
| `INSERT` | `to authenticated with check (public.workspace_role_for(workspace_id, auth.uid()) in ('owner','admin','member') and triggered_by = auth.uid() and exists (select 1 from public.files f where f.id = file_id and f.workspace_id = ai_extractions.workspace_id and f.status = 'active' and f.expense_id is null) and exists (select 1 from public.workspace_ai_settings s where s.workspace_id = ai_extractions.workspace_id))` | Viewer excluded (FR-005); file must belong to the same workspace, be active, and unlinked (FR-003a); BYOK must be configured (FR-002) — defense-in-depth alongside the Session-1 application check. The partial unique index (above) rejects a second concurrent active row for the same file. |
| `UPDATE` | `to authenticated using (public.workspace_role_for(workspace_id, auth.uid()) in ('owner','admin') or (public.workspace_role_for(workspace_id, auth.uid()) = 'member' and triggered_by = auth.uid()))` (same expression in `with check`) | Covers **both** the system's own processing→terminal write (always performed by the same session/actor that just inserted the row, so `triggered_by = auth.uid()` holds even for a Member) **and** discard (FR-013, FR-017; Clarifications — Owner/Admin any row, Member own row only). |
| `DELETE` | **No policy** (deny by default) | Extraction rows are permanent history, matching the `expenses`/`files` no-hard-delete pattern. |

```sql
revoke all on public.ai_extractions from anon;
grant select, insert, update on public.ai_extractions to authenticated;
-- no delete grant
```

The confirm path additionally writes to `expenses` and `files`, but does so
through the `SECURITY DEFINER` `confirm_ai_extraction` function (own elevated
rights), not through the `ai_extractions` UPDATE policy above — see RPCs
below.

## `SECURITY DEFINER` RPCs

Full SQL contract in
[contracts/extraction-rpc.md](./contracts/extraction-rpc.md). Behavior
summary:

- **`public.get_workspace_ai_key_for_extraction(p_workspace_id uuid) returns
  table(provider text, api_key text)`** (research Decisions 1–3)
  1. `assert workspace_role_for(p_workspace_id, auth.uid()) in ('owner','admin','member')` (NULL-checked explicitly — a non-member's NULL role must not silently skip this check) else raise (→ 403).
  2. `select s.provider, d.decrypted_secret from public.workspace_ai_settings s join vault.decrypted_secrets d on d.id = s.vault_secret_id where s.workspace_id = p_workspace_id`.
  3. Returns zero rows if BYOK is not configured (backend treats this as
     `ai_not_configured`, matching FR-002 — the RPC itself does not raise for
     "not configured," only for unauthorized access).
  4. Never logs `p_workspace_id`'s key; the backend caller discards it after
     one use (Decision 3).

- **`public.confirm_ai_extraction(p_extraction_id uuid, p_amount_minor bigint,
  p_occurred_on date, p_category_id uuid, p_merchant_name text,
  p_description text) returns table(expense_id uuid, should_delete_binary
  boolean, storage_path text)`** (research Decision 9)
  1. Load the extraction; not found or caller not a workspace member → 404
     (existence not leaked, mirrors Phase 7's `not_found` convention).
  2. `status <> 'ready_for_review'` → `already_resolved` (409/422).
  3. Owner/Admin → any row; Member → only if `triggered_by = auth.uid()`;
     else → `insufficient_privilege` (403).
  4. `p_amount_minor <= 0` or `p_occurred_on is null` → validation error (422),
     no writes (FR-012).
  5. Insert `expenses` (`currency` hardcoded `'SAR'`); category-validation
     trigger runs unchanged.
  6. `update files set expense_id = <new expense id> where id = <file_id>`.
  7. If `workspaces.auto_delete_after_extraction`, additionally soft-delete
     the file row and capture `storage_path` to return.
  8. `update ai_extractions set status='confirmed', expense_id=..., confirmed_by=auth.uid(), confirmed_at=now() where id = p_extraction_id and status = 'ready_for_review'`.
  9. Return `(expense_id, should_delete_binary, storage_path)`. The backend
     removes the storage binary (if `should_delete_binary`) **after** this
     transaction commits (research Decision 9).

Both functions are owned by a Vault/definer-privileged role (same role that
owns the Phase 7 functions), `EXECUTE` granted to `authenticated` only, and
never log or return anything beyond what's documented above.

## Relationship to existing entities

- **File (existing, Phase 6)** 1—0..N **AI Extraction**: a file may have many
  historical extraction attempts but at most one active one (partial unique
  index). Gains no new column; its existing `expense_id` and `status` columns
  are read (trigger precondition) and written (confirm's link/auto-delete
  step) by the new RPC only.
- **Expense (existing, Phase 3)** 0..1—1 **AI Extraction**: an expense is
  created by at most one confirmed extraction (`ai_extractions.expense_id`
  points to it); an expense created manually has no extraction pointing to it.
  No new column on `expenses`; `currency` is always `'SAR'` per its existing
  check constraint.
- **Workspace AI Settings (existing, Phase 7)** — read-only this phase, via
  the new Vault-read RPC and the plain `INSERT` policy's existence check;
  never written, edited, or removed by this phase.
- **Workspace (existing)** 1—0..N **AI Extraction**; also the source of
  `auto_delete_after_extraction`, read (not written) by `confirm_ai_extraction`.
- **Workspace Membership / Role (existing)** governs access as detailed in the
  RLS table above and research Decisions 1–2, 9–10.
