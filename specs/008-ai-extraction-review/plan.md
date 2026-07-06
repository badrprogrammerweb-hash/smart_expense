# Implementation Plan: AI Extraction and Review

**Branch**: `008-ai-extraction-review` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-ai-extraction-review/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a workspace-scoped AI extraction workflow on top of the Phase 6 files
foundation and the Phase 7 BYOK configuration. A new `public.ai_extractions`
table (one row per extraction attempt, many per file over time) records each
attempt's status (`processing` → `ready_for_review` | `failed`, then a
terminal `confirmed` or `discarded`), the AI's draft fields, and who
triggered/confirmed/discarded it. Draft rows never affect financial totals
(constitution V/X) — only `confirmed` rows carry a link to a real `expenses`
row, created atomically at confirm time.

This is the **first phase that reads the BYOK secret back out of Supabase
Vault** — Phase 7 only ever wrote to Vault. A new `SECURITY DEFINER` RPC,
`get_workspace_ai_key_for_extraction`, joins `workspace_ai_settings` to
`vault.decrypted_secrets` and returns the decrypted key to the backend only;
the decrypted view is never granted to `authenticated`/`anon`, and the key is
used in-process (fetch → call provider → discard) and never logged, returned
to a client, or persisted outside Vault. A second new RPC,
`confirm_ai_extraction`, atomically creates the expense, links (and, if the
workspace's Phase 6 auto-delete setting is on, soft-deletes) the file, and
marks the extraction confirmed — enforcing the Phase 3-style rule that a
Member may only confirm/discard/edit an extraction they personally triggered,
while an Owner/Admin may act on any extraction in the workspace.

The extraction call itself (fetch file bytes, call Gemini/OpenAI, parse the
result) is a slow external operation, so the trigger endpoint splits into
three short-lived database sessions instead of one long-held one: (1) a quick
session validates preconditions, fetches the decrypted key, and inserts a
`processing` row; (2) **no database session is held** while the file bytes are
fetched from Storage and the AI provider is called over plain `httpx` (no new
SDK dependency, mirroring `services/storage.py`'s direct-REST pattern); (3) a
second quick session persists the terminal result. The whole flow stays
synchronous from the caller's point of view — one HTTP request in, one
terminal `ready_for_review`/`failed` extraction out — so no background job
queue is introduced. A rare crash between phases 1 and 3 can leave a stale
`processing` row; this is self-healed lazily (no cron) the next time that file
is checked for a blocking extraction (a bounded 2-minute staleness window
converts it to `failed`/`timeout`), which is also how FR-006's "must not stay
processing indefinitely" requirement is satisfied without new infrastructure.

## Technical Context

**Language/Version**: Python 3.12 for `apps/api` (extended this phase); SQL
(Postgres 15, Supabase-managed) for one new migration under
`supabase/migrations/`; TypeScript 5.7 on Next.js 16.x (App Router) / React
18.3 for `apps/web` (extended this phase). This phase touches `apps/api`,
`apps/web`, and `supabase/`.

**Primary Dependencies**:
- Backend: FastAPI, SQLAlchemy async engine + `asyncpg`, `PyJWT[crypto]`,
  Pydantic v2 — all already in `apps/api/requirements.txt`. The AI provider
  calls (Gemini `generateContent`, OpenAI `chat/completions` or `responses`)
  and the file-bytes fetch from Supabase Storage are made with the
  **already-present `httpx`** client, following the same direct-REST pattern
  `services/storage.py` uses for Storage — **no vendor SDK
  (`google-generativeai`, `openai`) and no new dependency is added**. Vault
  decryption is reached through **normal SQL** over the existing authenticated
  RLS session, via one new `SECURITY DEFINER` RPC (read path) alongside the
  Phase 7 write RPCs.
- Frontend: already-present `next`, `react`, `@supabase/supabase-js` +
  `@supabase/ssr`, `@tanstack/react-query`, `react-hook-form` + `zod`,
  `next-intl`, `shadcn/ui` + Tailwind (Phase 5 stack) — reused unchanged. No
  new frontend dependency.

**Storage**:
- Supabase Postgres — one new table `public.ai_extractions` (workspace- and
  file-scoped, RLS-enabled). No changes to the `files` or `workspaces` schema
  (both are only read/updated by the new RPC using columns that already
  exist: `files.expense_id`, `files.status`, `workspaces.auto_delete_after_extraction`).
- Supabase Vault — **read**, for the first time, via
  `get_workspace_ai_key_for_extraction`; the raw key is decrypted server-side
  only, used once per extraction call, and never written anywhere.
- Supabase Storage — the existing private `receipts` bucket (Phase 6) is read
  (not written) by this phase; `services/storage.py` gains a `get_object`
  function (download bytes) alongside its existing `put_object` / `sign_url` /
  `remove_object`.

**Testing**: `pytest` + `pytest-asyncio` + `httpx` (ASGI transport) for
route-level backend tests, same pattern as Phases 2–7; integration tests sign
in as real local-Auth test users via the Supabase CLI stack to exercise RLS,
both new RPCs, and role/own-record permissions directly. **New this phase**:
outbound calls to the Gemini/OpenAI REST endpoints are intercepted with a
stubbed `httpx` transport (`httpx.MockTransport` or a monkeypatched client) so
tests never make live external calls — no prior phase needed this because
Phase 6/7 only ever called the local Supabase stack. Frontend: Vitest + React
Testing Library for component/permission/empty-state tests and Playwright for
the trigger → review → confirm/discard e2e flow (Phase 5 test stack, reused).

**Target Platform**: Local development via Supabase CLI (Docker stack already
running locally); hosted Supabase for staging/production; `apps/web` in the
browser (desktop + mobile web). Unchanged deployment posture (Bunny Magic
Containers hosting is Phase 10).

**Performance Goals**: No raw throughput/latency SLA. SC-004 (review-and-confirm
in under 2 minutes) is an end-to-end, human-paced budget, not an API latency
target. The AI provider call itself is bounded by a 45-second `httpx` client
timeout (Constraints below), consistent with FR-006.

**Constraints**:
- The decrypted API key MUST only ever exist in backend process memory for the
  duration of one extraction call; it MUST NEVER be returned to any client,
  logged, or written to any table other than Vault (constitution VI, XIV;
  FR-004, FR-020; the phase's NON-NEGOTIABLE dedicated secrecy test).
- Extraction is workspace-scoped and requires a configured BYOK key (FR-002);
  Owner/Admin/Member may trigger, Viewer may not (FR-005).
- At most one active (`processing`/`ready_for_review`) extraction per file,
  enforced by a partial unique index, not just application logic (FR-003).
- A file already linked to an expense (prior confirmed extraction or a manual
  Phase 6 link) cannot be re-extracted until detached (FR-003a) — this is
  checked against the existing `files.expense_id` column.
- Draft data (`processing`/`ready_for_review`/`failed`/`discarded`) MUST be
  excluded from every financial total, dashboard figure, and report; only a
  `confirmed` extraction's resulting `expenses` row counts (constitution
  V/X/XI; FR-007, FR-008).
- Confirm creates exactly one `expenses` row, always with `currency = 'SAR'`
  (the existing hard DB constraint on `expenses.currency`) regardless of any
  non-SAR currency the AI detected — the detected currency is informational
  only (spec Edge Cases; Assumptions).
- Confirm/discard/edit: Owner/Admin may act on any extraction in their
  workspace; a Member may act only on an extraction they personally triggered
  (FR-011, FR-013, FR-017; Clarifications) — the same shape as the existing
  Phase 3 `expenses` RLS rule (`created_by = auth.uid()` for Members).
- A Viewer may always view (read-only) any extraction's status and draft
  fields, including on the review screen (FR-010; Clarifications).
- Failed or discarded extractions MUST NOT touch the source file (FR-017,
  FR-021); auto-delete (Phase 6 `workspaces.auto_delete_after_extraction`)
  fires **only** after a successful confirmation, never after extraction
  alone (FR-023, FR-024; Clarifications).
- Tenant isolation: an extraction, its draft data, and its source file are
  never readable or actionable from outside the owning workspace;
  unauthenticated requests are denied (constitution VII; FR-025, FR-026).
- No background job queue/worker is introduced; the trigger endpoint is
  synchronous end-to-end from the caller's perspective (Assumptions).

**Scale/Scope**: 1 new table + 2 new `SECURITY DEFINER` functions (Vault read,
atomic confirm) + RLS/grants in 1 new migration; ~5 new backend endpoints
(trigger, list, get, confirm, discard) in a new `extractions` router/service/
schema; one new backend module for provider calls (`ai_providers.py`) and one
new `storage.get_object`; new frontend extraction components + review screen +
api client + one permission helper + en/ar strings. No changes to income/
category financial code paths; `expenses` and `files` are read/written only
through existing columns and existing validation (the category trigger, the
`currency = 'SAR'` check).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Core Product Principle | PASS | AI extraction is explicitly in the MVP surface; no accounting/banking behavior added. |
| III. MVP Scope Discipline | PASS | Only trigger/review/confirm/discard + Phase 6 auto-delete integration. No batch extraction, no OCR fallback, no AI summaries (Phase 9). |
| V. Manual-First, AI-Optional | PASS | Extraction requires an explicit trigger and BYOK; nothing runs automatically; draft results never affect totals until confirmed (FR-007, FR-008). |
| VI. Privacy and Security | PASS | Decrypted key exists only in backend memory for one call, never logged/returned/persisted outside Vault (FR-004, FR-020, dedicated secrecy test); RLS + per-request role/own-record checks on every extraction operation. |
| VII. Multi-Tenant Isolation | PASS | `workspace_id` scoping + `workspace_role_for` on every RLS policy and RPC; cross-workspace access denied (FR-025, FR-026). |
| VIII. Storage and File Retention | PASS | Auto-delete fires only after successful confirmation, never on failure/discard/extraction-alone, matching the constitution's stated default; the file metadata (not the binary) is retained for traceability (FR-017, FR-021, FR-023). |
| IX. Architecture Authority | PASS | FastAPI + Postgres own extraction orchestration and validation; frontend only displays and submits corrections, never computes totals or authorizes actions. |
| X. Financial Accuracy | PASS | Unconfirmed extractions never enter totals (FR-007, FR-008 — covered by a **dedicated** `test_extraction_totals.py`, this constitution's own NON-NEGOTIABLE example case); confirm reuses the existing expense validation (positive amount, valid date) and the hard `currency='SAR'` constraint — no new money-math path. |
| XI. Reports Integrity | PASS | This is the first phase that exercises the constitution's own named example ("Draft AI extraction results MUST NOT appear as final spending until confirmed") — reports/dashboard read only `expenses`, which a draft extraction never touches (FR-008; `test_extraction_totals.py`). |
| XII. History Tracking | PASS (scoped) | Every extraction attempt is retained (never deleted) with triggered/confirmed/discarded who+when; a general activity-feed surfacing of these events is still Phase 9 scope, same deferral as Phases 6–7. |
| XIV. Testing Requirements | PASS | Plan mandates **dedicated** key-secrecy and financial-totals-exclusion tests (mirroring Phase 7's key-secrecy precedent), plus authorization (role + own-record), isolation, auto-delete, and error-handling tests (SC-002–SC-008). |
| XV / XVI. Scope Control / Spec-Kit | PASS | Focused spec+plan for this feature only; out-of-scope items enumerated; sequenced after Phase 6 and Phase 7, before Phase 9. |

No violations. Complexity Tracking table is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-ai-extraction-review/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── extraction-api.md      # FastAPI endpoints (trigger/list/get/confirm/discard)
│   └── extraction-rpc.md      # SECURITY DEFINER SQL contract (vault read + atomic confirm) + table + RLS + grants
├── checklists/
│   └── requirements.md  # Spec quality checklist (/speckit-specify output)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── db.py                         # EDIT: extract `open_rls_session()` context manager out of
│   │                                  #   `get_rls_session` so the trigger route can acquire two
│   │                                  #   short-lived sessions around the external provider call;
│   │                                  #   `get_rls_session` becomes a thin wrapper (no behavior
│   │                                  #   change for existing routes)
│   ├── routes/
│   │   └── extractions.py            # NEW: POST trigger (files/{file_id}/extractions), GET list,
│   │                                  #   GET one, POST confirm, POST discard
│   ├── services/
│   │   ├── extractions.py            # NEW: role/own-record checks, staleness self-heal, the
│   │   │                             #   3-phase trigger orchestration, confirm/discard orchestration
│   │   └── ai_providers.py           # NEW: extract_receipt(provider, api_key, file_bytes,
│   │                                  #   content_type) -> ExtractedFields | ExtractionFailure;
│   │                                  #   dispatches to Gemini/OpenAI REST calls over httpx
│   │   └── storage.py                # EDIT: add get_object(key) -> bytes (download; mirrors
│   │                                  #   existing put_object/sign_url/remove_object)
│   └── schemas/
│       └── extractions.py            # NEW: ExtractionStatus enum, ExtractionRead, ConfirmExtractionRequest
└── tests/
    ├── test_extraction_trigger.py         # NEW: happy path processing→ready_for_review, BYOK-not-configured (FR-002),
    │                                       #   duplicate-active-extraction (FR-003), already-linked-file (FR-003a)
    ├── test_extraction_confirm.py          # NEW: confirm creates exactly one expense, links file, marks confirmed,
    │                                       #   validation failures create no expense (SC-003, FR-010–FR-015)
    ├── test_extraction_totals.py           # NEW (DEDICATED, constitution X NON-NEGOTIABLE): processing/ready_for_review/
    │                                       #   failed/discarded extractions never affect totals; confirming changes
    │                                       #   totals by exactly that expense (FR-007, FR-008; SC-002/SC-003)
    ├── test_extraction_discard.py          # NEW: discard from ready_for_review/failed, no expense, file unaffected
    ├── test_extraction_error_handling.py   # NEW: invalid key / rate-limit / timeout / unparseable file / malformed
    │                                       #   response all → failed with safe message (SC-005)
    ├── test_extraction_secrecy.py          # NEW (DEDICATED, constitution XIV NON-NEGOTIABLE): decrypted key never
    │                                       #   in any response, error, or log across trigger/confirm/discard
    ├── test_extraction_authorization.py    # NEW: Viewer blocked from all actions but can view; Member can act only
    │                                       #   on own-triggered extraction; Owner/Admin act on any (SC-007)
    ├── test_extraction_isolation.py        # NEW: cross-workspace trigger/view/confirm/discard denied (SC-008)
    └── test_extraction_auto_delete.py      # NEW: confirm + auto-delete on removes file binary; confirm + auto-delete
                                            #   off retains it; failed/discarded never deletes (SC-006, FR-020/021)

supabase/migrations/
└── 20260705000000_ai_extraction_review.sql   # NEW: ai_extractions table + RLS/grants + partial unique index,
                                               #   get_workspace_ai_key_for_extraction RPC, confirm_ai_extraction RPC

apps/web/
├── app/[locale]/w/[workspaceId]/files/
│   └── page.tsx                        # EDIT: mount TriggerExtractionButton / ExtractionStatusBadge per file row
├── app/[locale]/w/[workspaceId]/extractions/
│   ├── page.tsx                        # NEW: pending-review queue (lists ready_for_review + failed extractions)
│   └── [extractionId]/page.tsx         # NEW: review screen (draft fields + file preview + confirm/discard)
├── components/extraction/
│   ├── TriggerExtractionButton.tsx     # NEW: gated by canTriggerExtraction; shows a client-side "processing" spinner
│   ├── ExtractionStatusBadge.tsx       # NEW: processing/ready for review/failed/confirmed/discarded, all members
│   ├── ExtractionReviewForm.tsx        # NEW: editable draft fields + confirm; gated by canActOnExtraction
│   └── DiscardExtractionDialog.tsx     # NEW: gated by canActOnExtraction
├── lib/api/
│   └── extractions.ts                  # NEW: triggerExtraction / listExtractions / getExtraction /
│                                        #   confirmExtraction / discardExtraction client
├── lib/permissions.ts                  # EDIT: add canTriggerExtraction(role) and
│                                        #   canActOnExtraction(extraction, role, currentUserId) mirroring
│                                        #   canEditOrDeleteExpense's owner/admin-any-vs-member-own shape
└── messages/                           # EDIT: en + ar strings for the extraction/review surface
```

**Structure Decision**: Web-application monolith, same layout as Phases 6–7.
Backend extraction logic follows the existing route→service→schema split in a
dedicated `extractions` module trio, plus one new provider-call module kept
separate from the route/service layer (`ai_providers.py`, analogous to how
`services/storage.py` isolates the one place the service-role key touches
object bytes — here it's the one place the decrypted BYOK key touches an
outbound HTTP call). The single new migration adds the `ai_extractions` table,
its RLS policies and partial unique index, and the two new `SECURITY DEFINER`
functions. `db.py`'s session-acquisition logic is refactored (not
behaviorally changed for existing callers) so the trigger route can hold two
short sessions instead of one long one across the external provider call.
Frontend extraction surfaces add one new top-level route
(`[locale]/w/[workspaceId]/extractions`) for the cross-file pending-review
queue, plus a per-file trigger control on the existing Phase 6 files page,
reusing the Phase 5/6/7 component/permission/i18n patterns.

## Complexity Tracking

> No constitution violations — this table is intentionally empty. The one
> deliberate piece of added complexity — splitting the trigger flow into three
> database sessions instead of one — is justified in research.md (Decision 7)
> as avoiding holding a pooled DB connection open for the duration of an
> external HTTP call, not as a constitutional exception.
