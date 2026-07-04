# Phase 0 Research: AI Extraction and Review

All decisions below resolve the Technical Context for
`specs/008-ai-extraction-review/plan.md`. There are no open
`NEEDS CLARIFICATION` items.

## Decision 1 — Reading the BYOK secret: a new, narrowly-scoped Vault read RPC

**Decision**: Add `public.get_workspace_ai_key_for_extraction(p_workspace_id uuid)
returns table(provider text, api_key text)`, a `SECURITY DEFINER` function that
joins `workspace_ai_settings` to `vault.decrypted_secrets` and returns the
decrypted key. `EXECUTE` is granted to `authenticated` only; the
`vault.decrypted_secrets` view itself is never granted to `authenticated` or
`anon` (unchanged from Phase 7).

**Rationale**: Phase 7 deliberately never read the key back — its `GET` status
endpoint only ever selects non-secret columns. Phase 8 is the first phase that
needs the raw key server-side (to call Gemini/OpenAI), so a new, minimal read
path is unavoidable. Scoping it to a dedicated function (rather than granting
broad `vault.decrypted_secrets` access) keeps the blast radius of "who can ever
see a decrypted key" to exactly one audited function, mirroring how Phase 7
scoped writes to two dedicated functions instead of granting raw `vault.*`
access.

**Alternatives considered**:
- *Grant `vault.decrypted_secrets` directly to a backend-only Postgres role and
  query it from the service layer* — rejected: a wider grant than necessary: it
  would expose every workspace's key through one view instead of one
  function whose only job is "return this workspace's key to a caller already
  authorized as a member." A dedicated function keeps the authorization check
  co-located with the read, exactly like Phase 7's `set`/`clear` functions.
- *Skip authorization inside the function and rely on the backend service to
  filter* — rejected: constitution IX requires defense in depth; a caller who
  reached the function directly (e.g., a future bug in the backend) must still
  be blocked at the database layer.

## Decision 2 — Who may read the decrypted key: Owner, Admin, or Member (not Viewer)

**Decision**: The RPC checks `workspace_role_for(p_workspace_id, auth.uid())
in ('owner','admin','member')`; a Viewer (or non-member) gets
`insufficient_privilege` (42501 → 403).

**Rationale**: Matches FR-005 (Viewers cannot trigger extraction, so they have
no legitimate reason to ever cause a key read) and the same role set that can
trigger extraction (FR-001) and upload files (Phase 6). This is stricter than
Phase 7's key-write RPCs (Owner-only) because reading the key here is not a
configuration action — it is a side effect of a Member-permitted action
(triggering extraction) — but it is still never available to a Viewer.

## Decision 3 — The key never leaves backend process memory

**Decision**: The backend service function that calls this RPC holds the
returned `api_key` only as a local Python variable for the duration of one
extraction attempt (fetch → build provider request → send → discard). It is
never assigned to a Pydantic response model, never included in a log call
(the extraction service reuses the same "never log a secret" discipline as
`services/ai_settings.py` / `services/storage.py`'s redaction), and the RPC's
SQL text itself never appears in application logs (`echo` stays off, matching
Phase 7 Decision 7 unchanged).

**Rationale**: The most likely real leak vector, per Phase 7's own finding, is
not the client response but logs, error messages, and diagnostics. This phase
introduces the first place the key is used *outside* the database (an outbound
HTTP call), so this discipline is restated explicitly and covered by a
**dedicated** test (`test_extraction_secrecy.py`), the same non-negotiable
treatment Phase 7 gave `test_ai_settings_secrecy.py`.

## Decision 4 — Provider calls: direct REST over `httpx`, no vendor SDK

**Decision**: Call Gemini's `generateContent` endpoint and OpenAI's chat/
responses endpoint directly via the already-present `httpx` client. No
`google-generativeai` or `openai` package is added.

**Rationale**: `apps/api/requirements.txt` has no vendor AI SDK today, and the
project's established pattern (Phase 6 `storage.py`, Phase 7 Vault RPCs) is to
call a provider's REST surface directly with `httpx` rather than add a
dependency for a single call shape. A structured-output request (ask the model
to return JSON matching a fixed schema: amount, currency, transaction date,
vendor/merchant, category suggestion) is supported natively by both providers'
REST APIs (Gemini's `responseSchema`/`responseMimeType: application/json`;
OpenAI's `response_format: {type: "json_schema", ...}`), so no SDK-specific
convenience is lost.

**Alternatives considered**: Adding `google-generativeai` and `openai` SDKs —
rejected: two new dependencies for what is, at the wire level, one POST request
per provider; inconsistent with the project's zero-new-dependency pattern from
Phase 7, and it would need per-SDK auth/retry/timeout configuration instead of
one shared `httpx` client already used elsewhere.

**Implementer note (finalized during implementation, not a spec/plan
decision)**: exact model names (e.g. a current Gemini flash-tier and OpenAI
mini-tier vision model), the literal prompt/schema JSON, and image-vs-PDF
input encoding (Gemini accepts `inline_data` with `mime_type:
application/pdf` directly; OpenAI's file-capable endpoint accepts a base64
PDF as an `input_file` part) are implementation details that can be tuned
without changing any FR — both providers support all four supported file
types (PNG/JPEG/WebP/PDF) at the wire level.

## Decision 5 — Response parsing: strict validation, no partial trust

**Decision**: Parse each provider's JSON response into a Pydantic model with
every field optional (`amount_minor: int | None`, `currency: str | None`,
`occurred_on: date | None`, `vendor_name: str | None`,
`suggested_category: str | None`). A response that is not valid JSON, or does
not parse into this model at all, is treated as `failed` /
`malformed_response` (FR-019) — never partially trusted. A response that
parses but leaves some fields absent still produces a `ready_for_review` draft
with those fields blank (FR-008, FR-009; spec Edge Cases "Partial provider
data").

**Rationale**: This is the line between "the AI didn't find a date" (a normal,
expected outcome that still produces a reviewable draft) and "the AI's answer
is not shaped like an answer at all" (a failure). Drawing the line at
JSON-parses-into-schema keeps the distinction mechanical and testable.

## Decision 6 — Error classification for FR-019 / SC-005

**Decision**: Map provider-call failures to a small, fixed set of safe,
user-facing `failure_reason` values, decided by HTTP-level signals, not by
inspecting provider error bodies (which could contain implementation details
or, in principle, echo back parts of the request):

| Condition | `failure_reason` |
|-----------|-------------------|
| Provider responds 401/403 | `invalid_key` |
| Provider responds 429 | `rate_limited` |
| `httpx` request exceeds the timeout (45s) or a connection error occurs | `timeout` |
| File bytes cannot be fetched from Storage, or the provider explicitly reports it cannot read the file | `unreadable_file` |
| Response is not valid JSON / does not match the expected schema (Decision 5) | `malformed_response` |
| Anything else | `provider_error` (generic) |

**Rationale**: Directly satisfies FR-019/FR-020 (safe, non-leaking messages)
and SC-005 (zero occurrences of raw provider error content in any
client-visible output). The backend logs the *category* (e.g.
`extraction_failed reason=rate_limited`) for operability, never the provider's
raw response body.

## Decision 7 — Three-phase trigger flow instead of one long-held DB session

**Decision**: Refactor `app/db.py`'s `get_rls_session` so its body (open a
session, `session.begin()`, set `lock_timeout`/`statement_timeout`, set the
two `request.jwt.claim*` GUCs) lives in a reusable
`open_rls_session(current_user)` async context manager. The existing FastAPI
dependency becomes a one-line wrapper (no behavior change for any existing
route). The new trigger endpoint uses this helper **twice**:

1. **Session 1** (short): validate BYOK configured (FR-002), validate the file
   is active/unlinked and not already blocked by an active extraction
   (FR-003, FR-003a — including the lazy staleness self-heal, Decision 8),
   call `get_workspace_ai_key_for_extraction`, insert the `processing` row.
   Commit and close.
2. **No session held**: fetch file bytes from Storage and call the AI provider
   over `httpx` (Decision 4), which can take several seconds.
3. **Session 2** (short): update the row to its terminal state
   (`ready_for_review` + draft fields, or `failed` + `failure_reason`),
   guarded by `WHERE status = 'processing'` for idempotency. Commit and close.

**Rationale**: `get_rls_session` currently opens one transaction for the whole
request lifetime via FastAPI dependency injection. Every prior phase's
per-request work was fast, local Postgres calls, so holding that transaction
open for the whole request was free. This phase's request includes an
external HTTP call that can take seconds — holding a pooled DB connection and
open transaction for that entire duration risks pool exhaustion under
concurrent triggers. Splitting into two short sessions around the slow,
DB-free middle phase keeps every held transaction sub-second, matching every
other route's profile, while keeping the endpoint itself synchronous
(no background job queue — Assumptions) so the caller gets one HTTP
request/response with the terminal result.

**Alternatives considered**:
- *Keep one long-held session* — rejected per the pool-exhaustion risk above;
  this is the one piece of added complexity in Complexity Tracking, and it is
  justified by that operational risk, not a constitutional exception.
- *Return `202 processing` immediately and finish the call in a FastAPI
  `BackgroundTask`, with the client polling `GET` for the result* — rejected
  for MVP: it requires the frontend to poll and adds an async-lifecycle
  surface (a background task that outlives the request) for a call that, in
  practice, completes in a few seconds; the synchronous design is simpler to
  implement, test, and reason about, and can be revisited later without a
  spec change (Assumptions: sync-vs-background is a planning detail, not a
  requirement).

## Decision 8 — A stuck "processing" row is self-healed lazily, not by a cron job

**Decision**: There is no scheduler/cron in this codebase. Instead, whenever
the backend checks "does this file already have a blocking extraction"
(FR-003, on every trigger attempt) or lists a workspace's extractions, it
first runs: `UPDATE ai_extractions SET status = 'failed', failure_reason =
'timeout' WHERE file_id = :id AND status = 'processing' AND triggered_at <
now() - interval '2 minutes'`. Two minutes comfortably exceeds the 45-second
provider-call timeout (Decision 6) plus both short DB phases, so a row only
ever reaches that age if the process crashed or restarted between Session 1
and Session 2 of Decision 7.

**Rationale**: Satisfies FR-006 ("must not remain processing indefinitely")
without introducing a scheduled job or worker process, which the constitution
and spec both treat as out of scope for this MVP phase. The self-heal is a
narrow, idempotent, side-effect-free `UPDATE` that only ever fires on an
already-abnormal row.

## Decision 9 — Confirm is one atomic `SECURITY DEFINER` RPC, not three separate writes

**Decision**: `public.confirm_ai_extraction(p_extraction_id uuid,
p_amount_minor bigint, p_occurred_on date, p_category_id uuid,
p_merchant_name text, p_description text) returns table(expense_id uuid,
should_delete_binary boolean, storage_path text)`:
1. Authorization: Owner/Admin → any extraction in the workspace; Member → only
   if `triggered_by = auth.uid()` (FR-011, FR-013; Clarifications). Anyone
   else (including Viewer) → `insufficient_privilege`.
2. Validates `p_amount_minor > 0` and `p_occurred_on is not null` (FR-012;
   same rule as manual expense creation) — else a validation error, no writes.
3. Inserts the `expenses` row (`currency` hardcoded to `'SAR'` regardless of
   the extraction's `extracted_currency` — Constraints) — the existing
   category-validation trigger on `expenses` runs unchanged.
4. Sets `files.expense_id` to the new expense id (linking, reusing Phase 6's
   existing `files.expense_id` column). This write succeeds because the
   function runs with the definer's elevated privilege and so **bypasses**
   `files` RLS entirely — it does not depend on, and is not "covered by,"
   Phase 6's existing role-scoped `files` UPDATE policy.
5. If `workspaces.auto_delete_after_extraction` is true, soft-deletes the file
   row (`status='deleted', deleted_at, deleted_by`) in the **same**
   transaction as steps 3–4 and returns the file's `storage_path` so the
   backend can remove the binary afterward; otherwise returns
   `should_delete_binary = false`. **This is the one place a Member gains a
   capability they don't otherwise have**: Phase 6 restricts file deletion to
   Owner/Admin, but a Member confirming an extraction *they personally
   triggered* can cause this soft-delete — deliberately, and only reachable
   through a valid own-triggered `ready_for_review` extraction (step 1's
   authorization already gated that). This makes function ownership an actual
   correctness precondition, not just a Vault-access one: **verify in the
   target stack that `confirm_ai_extraction` is owned by a role whose
   `SECURITY DEFINER` context actually bypasses `files` RLS** (i.e., `files`
   has no `FORCE ROW LEVEL SECURITY`, and the owning role isn't itself
   RLS-restricted) — the same class of precondition already called out for
   the Vault calls (Decision 1's implementer note).
6. Marks the extraction `confirmed` (`expense_id`, `confirmed_by`,
   `confirmed_at`), guarded by `WHERE status = 'ready_for_review'` so a
   duplicate/concurrent confirm is a no-op that raises `already_resolved`
   rather than creating a second expense (FR-012, FR-015).

The backend calls this RPC inside one short DB session, and — only if
`should_delete_binary` is true — calls `storage.remove_object(storage_path)`
**after** that transaction commits, mirroring the exact ordering
`services/files.py`'s manual delete path already uses (soft-delete metadata
first inside the transaction, remove the binary after, for rollback safety).

**Rationale**: Confirming touches three tables (`expenses`, `files`,
`ai_extractions`) and must be all-or-nothing — a partial confirm (expense
created but extraction left `ready_for_review`) would let it be confirmed
twice, or leave a linked file whose extraction never reflects it. A single
`SECURITY DEFINER` function gives one transaction and one place to enforce the
own-record authorization rule, mirroring exactly how Phase 7 used
`SECURITY DEFINER` functions to make a multi-step, authorization-sensitive
write atomic and centrally auditable. Discarding, by contrast, is a single-row
`UPDATE` with no cross-table effects, so it does **not** need an RPC — it goes
through the plain RLS `UPDATE` policy (Decision 10) like any other authorized
write in this codebase.

## Decision 10 — Trigger, the processing→terminal update, and discard use plain RLS, not RPCs

**Decision**: Only the Vault read (Decision 1) and the atomic confirm
(Decision 9) need `SECURITY DEFINER`. Everything else — inserting the
`processing` row, updating it to its terminal state, and discarding — is a
plain `INSERT`/`UPDATE` through the existing authenticated RLS session,
governed by ordinary RLS policies:
- `INSERT`: role in `(owner, admin, member)`, `triggered_by = auth.uid()`, the
  target file is active/unlinked/in-workspace, and the workspace has BYOK
  configured (defense-in-depth mirror of the Session-1 application check).
- `UPDATE`: `role in (owner, admin)` OR `(role = 'member' AND triggered_by =
  auth.uid())` — this single policy authorizes both the system's own
  processing→terminal write (the actor is always the same user who just
  triggered it) and a later discard by that same actor or an Owner/Admin.
- No `DELETE` policy — extraction rows are permanent history, matching the
  "no user-facing restore, no erasure" pattern already established for
  `expenses`/`files`.

**Rationale**: Least privilege — only the two operations that genuinely need
elevated rights (reading a secret out of Vault; atomically writing across
three tables with a cross-role authorization rule) get a `SECURITY DEFINER`
function. Everything an ordinary authenticated, RLS-scoped write can already
express safely is left as a plain write, keeping the new privileged surface as
small as Phase 7's was.

## Decision 11 — Category and merchant on confirm reuse existing validation, unchanged

**Decision**: The confirm RPC passes `p_category_id` straight into the
`expenses` insert; the existing `validate_expense_category` trigger (rejects a
category outside the workspace or archived) fires exactly as it does for a
manual expense. No AI-suggested category is ever inserted directly — the
suggestion is display-only text on the draft (FR-009; spec Edge Cases
"Suggested category not in workspace").

**Rationale**: Reuses a tested invariant instead of duplicating category
validation logic in the new RPC — one source of truth for "is this a valid
category for this expense."
