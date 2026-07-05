---
description: "Task list for AI Extraction and Review (008-ai-extraction-review)"
---

# Tasks: AI Extraction and Review

**Input**: Design documents from `/specs/008-ai-extraction-review/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principle XIV lists AI key security and AI extraction review as NON-NEGOTIABLE/required test areas, and spec.md's SC-002/SC-005–SC-008 require "100%"-verified outcomes. This is also the first phase that reads the BYOK secret back out of Vault (research Decisions 1–3), so it gets its own **dedicated key-secrecy test**, the same non-negotiable treatment Phase 7 gave `test_ai_settings_secrecy.py`, plus a **dedicated financial-totals-exclusion test** for constitution X's non-negotiable ("draft/pending/failed/unconfirmed AI extraction records MUST NOT affect financial totals").

**Organization**: Tasks are grouped by user story (US1–US5 from `spec.md`) so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in each description

## Path Conventions

Monolith web application per `plan.md`: this phase spans `apps/api` (backend),
`apps/web` (frontend), and `supabase/` (database + Vault). Backend follows the
existing `routes → services → schemas` split, plus a new `ai_providers.py`
module isolated from the route/service layer (the one place the decrypted BYOK
key touches an outbound HTTP call, mirroring how `storage.py` isolates the
one place the service-role key touches object bytes). The decrypted key is
handled only server-side, for the duration of one extraction call, and is
**never** logged or returned.

---

## Phase 1: Setup

**Purpose**: Create empty module/component/i18n scaffolding so later tasks only add behavior. No new dependencies are required (research: `httpx` and the Phase 5 frontend stack are reused; no vendor AI SDK is added).

- [X] T001 [P] Create backend module stubs: empty `apps/api/app/schemas/extractions.py`, `apps/api/app/services/extractions.py`, `apps/api/app/services/ai_providers.py`, and `apps/api/app/routes/extractions.py` (module docstrings + imports only)
- [X] T002 [P] Create frontend scaffolding: placeholder `apps/web/components/extraction/{TriggerExtractionButton,ExtractionStatusBadge,ExtractionReviewForm,DiscardExtractionDialog}.tsx` and an empty `apps/web/lib/api/extractions.ts`
- [X] T003 [P] Add `extraction.*` i18n message keys (status labels processing/ready for review/failed/confirmed/discarded, failure reasons, trigger/confirm/discard actions, and error messages) to `apps/web/messages/en.json` and `apps/web/messages/ar.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database table + RPCs, the split-session helper the trigger flow needs, the file-bytes read path, request/response schemas, the provider-call module, and the API client + permission helpers that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create migration `supabase/migrations/20260705000000_ai_extraction_review.sql`: `public.ai_extractions` table (columns, CHECK constraints, FKs, partial unique index `ai_extractions_one_active_per_file`) per `data-model.md`; enable RLS with the member-SELECT, trigger-INSERT, and own-record-UPDATE policies; the `get_workspace_ai_key_for_extraction` and `confirm_ai_extraction` **SECURITY DEFINER** functions per `contracts/extraction-rpc.md`; `grant execute` to `authenticated`; function ownership set to the same Vault-privileged role Phase 7's functions use. **Precondition**: verify `vault.decrypted_secrets` join shape and RPC ownership in the target stack (mirrors Phase 7 research Decision 3's precondition) — verified against the local Supabase stack: `vault.decrypted_secrets` exposes `id`+`decrypted_secret`, both new functions owned by `postgres`, `public.files` has no `FORCE ROW LEVEL SECURITY`, migration applies cleanly
- [X] T005 [P] Refactor `apps/api/app/db.py`: extract `get_rls_session`'s body into a reusable `open_rls_session(current_user)` async context manager (research Decision 7); `get_rls_session` becomes a thin wrapper with **no behavior change** for any existing route — verified: full existing pytest suite (63 tests) passes unchanged
- [X] T006 [P] Add `get_object(key: str) -> bytes` to `apps/api/app/services/storage.py` (download bytes from the private `receipts` bucket via the service-role `httpx` client, mirroring the existing `put_object`/`sign_url`/`remove_object`)
- [X] T007 [P] Define Pydantic models in `apps/api/app/schemas/extractions.py`: `ExtractionStatus` / `FailureReason` enums, `ExtractionRead` (including computed `can_edit`/`can_discard`), and `ConfirmExtractionRequest` per `contracts/extraction-api.md`
- [X] T008 [P] Implement `apps/api/app/services/ai_providers.py`: `extract_receipt(provider, api_key, file_bytes, content_type) -> ExtractedFields | ExtractionFailure`, dispatching to `_extract_gemini` / `_extract_openai` over `httpx` with a 45s timeout, structured-JSON-output requests, strict response parsing into an all-optional-fields model, and the fixed `failure_reason` classification from `research.md` Decision 6 (never surfacing raw provider error bodies)
- [X] T009 [P] Register the (still route-less) `extractions` router in `apps/api/app/main.py`
- [X] T010 [P] Add frontend API client `apps/web/lib/api/extractions.ts` (`triggerExtraction` / `listExtractions` / `getExtraction` / `confirmExtraction` / `discardExtraction`) and `canTriggerExtraction(role)` / `canActOnExtraction(extraction, role, currentUserId)` in `apps/web/lib/permissions.ts` (mirroring `canEditOrDeleteExpense`'s owner/admin-any-vs-member-own shape)

**Checkpoint**: Table, RPCs, session helper, storage read path, provider-call module, schemas, and API client ready — user stories can proceed.

---

## Phase 3: User Story 1 - Trigger AI extraction on an uploaded receipt or invoice (Priority: P1) 🎯 MVP

**Goal**: An Owner/Admin/Member with BYOK configured triggers extraction on a file; the system calls the provider and returns a terminal `ready_for_review` (with draft fields) or `failed` (with a safe reason) result in one synchronous request. Blocked when BYOK isn't configured, the file is already linked, or an active extraction already exists on it. Viewers cannot trigger.

**Independent Test**: With BYOK configured, upload a receipt, trigger extraction, and confirm the response is a terminal `ready_for_review`/`failed` extraction with no expense or total affected; confirm a second trigger on the same file is rejected while the first is unresolved; confirm no BYOK configured, an already-linked file, and a Viewer are all rejected.

### Tests for User Story 1

- [X] T011 [P] [US1] Backend test `apps/api/tests/test_extraction_trigger.py`: happy path (stubbed provider) → `200` `ready_for_review` with draft fields; no BYOK configured → `409 ai_not_configured`, no row created; file already has an active extraction or `expense_id` set → `409 extraction_in_progress`; Viewer → `403` (FR-001–FR-005, FR-003a)

### Implementation for User Story 1

- [X] T012 [US1] Implement precondition checks in `apps/api/app/services/extractions.py`: role resolution, the lazy stale-`processing` self-heal (research Decision 8), the active-extraction and linked-file blocking checks (FR-002, FR-003, FR-003a)
- [X] T013 [US1] Implement the three-phase trigger orchestration in `apps/api/app/services/extractions.py` (research Decision 7): Session 1 calls `get_workspace_ai_key_for_extraction` and inserts the `processing` row; no session held while `storage.get_object` + `ai_providers.extract_receipt` run; Session 2 persists the terminal state
- [X] T014 [US1] Implement `POST /workspaces/{workspace_id}/files/{file_id}/extractions` in `apps/api/app/routes/extractions.py`, returning the terminal `ExtractionRead` per `contracts/extraction-api.md`
- [X] T015 [P] [US1] Frontend `apps/web/components/extraction/TriggerExtractionButton.tsx`: gated by `canTriggerExtraction`, shows a loading state for the duration of the call, calls `lib/api/extractions.ts`, surfaces `409`/`403` as clear messages; mounted into the existing files list (`apps/web/app/[locale]/w/[workspaceId]/files/page.tsx`)
- [X] T016 [P] [US1] Frontend test `apps/web/components/extraction/__tests__/trigger-extraction-button.test.tsx`: hidden/disabled for Viewer, shows a loading state during the call, renders the terminal ready/failed result

**Checkpoint**: Triggering extraction works end to end and is independently testable.

---

## Phase 4: User Story 2 - Review, correct, and confirm an extraction into an expense (Priority: P1)

**Goal**: An authorized member reviews a `ready_for_review` extraction's draft fields next to the source file, corrects any field, and confirms — creating exactly one expense (always `currency = "SAR"`), linking the file, and marking the extraction confirmed. Invalid amount/date is rejected with no expense created. Owner/Admin may act on any extraction; a Member only on one they personally triggered; Viewers may view but not confirm. Unconfirmed extractions of every kind must never appear in totals — this is the constitution X non-negotiable, so it gets its own dedicated test.

**Independent Test**: Produce a `ready_for_review` extraction, edit a field, confirm as the triggering Member → new expense with the edited values, included in totals, extraction confirmed; a different Member gets `403`; Owner/Admin succeed regardless of who triggered it; an invalid amount/date is rejected with no expense created; confirming twice creates exactly one expense; dashboard/report totals reflect only the confirmed expense, never the draft.

### Tests for User Story 2

- [X] T017 [P] [US2] Backend test `apps/api/tests/test_extraction_confirm.py`: confirm by the triggering Member creates exactly one expense with `currency = "SAR"` (regardless of `extracted_currency`), links the file, marks the extraction `confirmed`; confirm by a non-triggering Member → `403`; confirm by Owner/Admin (any triggerer) → `200`; invalid `amount_minor`/`occurred_on` → `422`, no expense created; confirming an already-resolved extraction → `409 already_resolved` with exactly one expense total (FR-010–FR-015)
- [X] T018 [P] [US2] Backend **dedicated financial-totals-exclusion** test `apps/api/tests/test_extraction_totals.py`: with one extraction in each of `processing`, `ready_for_review`, `failed`, and `discarded` state present in a workspace, dashboard totals/remaining-balance and report figures are byte-for-byte identical to the same workspace with no extractions at all; after confirming one of them, totals change by exactly that expense's amount and no more (constitution X NON-NEGOTIABLE; FR-007, FR-008; SC-002, SC-003)

### Implementation for User Story 2

- [X] T019 [US2] Implement confirm orchestration in `apps/api/app/services/extractions.py`: resolve role/own-record eligibility, call `confirm_ai_extraction(...)`, and — only if it returns `should_delete_binary`, call `storage.remove_object(storage_path)` **after** the RPC's transaction commits (research Decision 9's ordering)
- [X] T020 [US2] Implement `GET /workspaces/{workspace_id}/extractions`, `GET /workspaces/{workspace_id}/extractions/{extraction_id}`, and `POST /workspaces/{workspace_id}/extractions/{extraction_id}/confirm` in `apps/api/app/routes/extractions.py`, computing `can_edit`/`can_discard` per `contracts/extraction-api.md`
- [X] T021 [P] [US2] Frontend review screen `apps/web/app/[locale]/w/[workspaceId]/extractions/[extractionId]/page.tsx` + `apps/web/components/extraction/ExtractionReviewForm.tsx`: draft fields editable side-by-side with a file preview, submits the reviewed values to confirm; read-only (no edit controls) when `can_edit` is false
- [X] T022 [P] [US2] Frontend pending-review queue `apps/web/app/[locale]/w/[workspaceId]/extractions/page.tsx`: lists extractions via `GET .../extractions`, using `apps/web/components/extraction/ExtractionStatusBadge.tsx` for status display
- [X] T023 [P] [US2] Frontend test `apps/web/components/extraction/__tests__/extraction-review-form.test.tsx`: editing fields and submitting confirm calls the API with corrected values; a validation error from the API is displayed; form is read-only when `can_edit` is false

**Checkpoint**: Review-and-confirm works end to end, including the own-record rule and the totals-exclusion guarantee, and is independently testable.

---

## Phase 5: User Story 3 - Discard an extraction without creating an expense (Priority: P2)

**Goal**: An authorized member discards a `ready_for_review` or `failed` extraction; no expense is created and the source file is left unaffected and available for a fresh trigger. Same own-record rule as confirm; Viewers cannot discard.

**Independent Test**: Produce a `ready_for_review` extraction, discard it as the triggerer → no expense, file still exists unlinked, a new extraction can be triggered on it; a different Member gets `403`; Owner/Admin succeed regardless of triggerer; Viewer gets `403`.

### Tests for User Story 3

- [X] T024 [P] [US3] Backend test `apps/api/tests/test_extraction_discard.py`: discard from `ready_for_review` and from `failed`, by the triggering Member and by Owner/Admin (any triggerer) → `200`, no expense, file unaffected and re-triggerable; discard by a non-triggering Member or by a Viewer → `403`; discard of an already-resolved extraction → `409 already_resolved` (FR-017, FR-018)

### Implementation for User Story 3

- [X] T025 [US3] Implement discard orchestration (plain RLS-governed `UPDATE ... WHERE status IN ('ready_for_review','failed')`, research Decision 10) in `apps/api/app/services/extractions.py` and `POST /workspaces/{workspace_id}/extractions/{extraction_id}/discard` in `apps/api/app/routes/extractions.py`
- [X] T026 [P] [US3] Frontend `apps/web/components/extraction/DiscardExtractionDialog.tsx`: gated by `can_discard`, wired into both the review screen (T021) and the pending-review queue (T022)

**Checkpoint**: Discard works end to end and is independently testable.

---

## Phase 6: User Story 4 - Safe handling of provider and extraction errors (Priority: P2)

**Goal**: Every provider/file failure mode (invalid/revoked key, rate limit, timeout, unparseable file, malformed response) produces a `failed` extraction with a safe, classified reason; the source file is never touched on failure; retrying (re-triggering) is always available afterward.

**Independent Test**: Force each error condition via the stubbed provider transport and confirm each produces the matching `failure_reason`, the file is byte-for-byte unchanged, and a subsequent trigger on the same file succeeds.

### Tests for User Story 4

- [X] T027 [P] [US4] Backend test `apps/api/tests/test_extraction_error_handling.py`: stubbed 401/403 → `invalid_key`; stubbed 429 → `rate_limited`; simulated timeout → `timeout`; corrupt/unreadable file bytes → `unreadable_file`; non-JSON/schema-mismatched provider response → `malformed_response`; each case leaves the file unchanged and a following trigger succeeds; zero occurrences of raw provider error content or the API key in the response or logs (FR-019–FR-022; SC-005)

### Implementation for User Story 4

- [X] T028 [US4] Harden `apps/api/app/services/ai_providers.py`'s error classification and the 45s timeout handling per `research.md` Decision 6, and confirm `apps/api/app/services/extractions.py` never persists or logs anything beyond the fixed `failure_reason` values
- [X] T029 [P] [US4] Frontend: surface `failure_reason` as a clear, translated message (not raw provider text) with a retry action (reusing `TriggerExtractionButton`) in `ExtractionStatusBadge.tsx` and the files list

**Checkpoint**: All error paths are safe, classified, and non-destructive, and is independently testable.

---

## Phase 7: User Story 5 - Auto-delete the source file after a confirmed extraction (Priority: P3)

**Goal**: When a workspace's Phase 6 `auto_delete_after_extraction` setting is on, confirming an extraction deletes the source file's binary right after the expense is created; the setting being off (default) or the extraction failing/being discarded never deletes the file.

**Independent Test**: Enable auto-delete, confirm an extraction, and verify the file binary is gone while its metadata (marked deleted) and the resulting expense remain; verify a failed and a discarded extraction under the same setting leave their files untouched; verify auto-delete off retains the file after confirmation.

### Tests for User Story 5

- [ ] T030 [P] [US5] Backend test `apps/api/tests/test_extraction_auto_delete.py`: **as a Member confirming an extraction they personally triggered** (the discriminating case — Phase 6 normally restricts file deletion to Owner/Admin, so this only works because `confirm_ai_extraction`'s `SECURITY DEFINER` bypasses `files` RLS; research Decision 9), with auto-delete on → file binary removed, file row soft-deleted, expense created; confirm with auto-delete off → file binary retained; failed and discarded extractions under auto-delete on → file untouched in both cases (FR-017, FR-021, FR-023, FR-024; SC-006)

### Implementation for User Story 5

- [ ] T031 [US5] Frontend: in `ExtractionReviewForm.tsx` (T021), show a short notice ("this file will be removed after you confirm, because auto-delete is on for this workspace") when the workspace's `auto_delete_after_extraction` setting is enabled, reusing the existing Phase 6 setting value; the backend behavior itself is already implemented by T019 against the RPC's `should_delete_binary`/`storage_path` result — this task verifies (via the T030 test) and surfaces it in the UI

**Checkpoint**: Auto-delete integration is correct and independently testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T032 [P] Backend **dedicated key-secrecy** test `apps/api/tests/test_extraction_secrecy.py`: the decrypted BYOK key never appears in any trigger/confirm/discard response, error, or captured log line; `get_workspace_ai_key_for_extraction` is the only function that ever calls `vault.decrypted_secrets` (constitution VI/XIV NON-NEGOTIABLE; research Decisions 1–3)
- [ ] T033 [P] Backend test `apps/api/tests/test_extraction_authorization.py`: full role matrix across trigger/list/get/confirm/discard — Viewer view-only everywhere; Member own-record only for confirm/discard/edit; Owner/Admin act on any extraction (SC-007)
- [ ] T034 [P] Backend test `apps/api/tests/test_extraction_isolation.py`: every endpoint returns `404` for a workspace/file/extraction the caller is not a member of; anonymous requests → `401` (SC-008)
- [ ] T035 [P] Complete and proofread en/ar i18n strings for all extraction surfaces and verify RTL layout of the review screen, pending-review queue, status badge, and discard dialog
- [ ] T036 [P] Playwright e2e `apps/web/e2e/extraction.spec.ts`: trigger → review → confirm happy path; trigger → discard path; assert the decrypted key never appears in any network response body
- [ ] T037 Run `quickstart.md` validation end to end (all `test_extraction_*` pytest suites + frontend tests/e2e + the manual role smoke matrix + the key-secrecy log grep) and record results
- [ ] T038 [P] Review `apps/api/app/services/extractions.py` + `ai_providers.py` + route error handling for consistent error codes and **no key/provider-body leakage** in logs/errors; confirm SQLAlchemy `echo` is off (reuses Phase 7 research Decision 7's discipline)
- [ ] T039 [P] Document the `ai_extractions` table, the two new RPCs, the provider REST call shapes, and the (unchanged, no new env vars) configuration in `supabase/README.md`

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** must complete before any user story.
- **US1 (P1)** is the entry point every other story depends on (an extraction must exist before it can be reviewed, discarded, retried, or auto-deleted) — it is the true MVP slice on its own.
- **US2 (P1)** depends on US1 (needs a `ready_for_review` extraction to review/confirm) and completes the P1 MVP pair, matching the phase exit criteria ("Results require user confirmation," "Confirmed results affect totals").
- **US3 (P2)** and **US4 (P2)** each depend only on US1 (a `ready_for_review`/`failed` extraction) and are independent of each other and of US2.
- **US5 (P3)** depends on US2 (confirm must exist for auto-delete to have anything to trigger on).
- **Polish (Phase 8)** runs after the stories it validates (needs trigger + confirm + discard to exist for the authorization/isolation/secrecy matrix tests).

### Parallel opportunities

- Phase 1: T001, T002, T003 all `[P]`.
- Phase 2: T005, T006, T007, T008, T009, T010 are all `[P]` once T004 (the migration) exists (T004 itself has no `[P]` — everything else in Foundational reads its table/RPC shapes).
- Within each story, backend implementation tasks that edit the shared `services/extractions.py` / `routes/extractions.py` are sequential; `[P]` frontend and test tasks run alongside.
- Across stories: once Foundational and US1 are done, US2/US3/US4 can proceed in parallel; US5 waits on US2.

## Implementation Strategy

- **MVP = Phase 1 + Phase 2 + US1 + US2**: an authorized member can trigger extraction on a file and confirm the (possibly corrected) result into a real expense, with drafts never affecting totals until confirmed — the core of the phase exit criteria.
- **Increment 2 = US3 + US4**: a safe "no" path (discard) and provably safe error handling for every provider/file failure mode.
- **Increment 3 = US5**: close the loop with the Phase 6 auto-delete setting.
- Ship and test each story at its checkpoint before starting the next.

## Task Summary

- **Total tasks**: 39
- **Per phase**: Setup 3, Foundational 7, US1 6, US2 7, US3 3, US4 3, US5 2, Polish 8
- **Test tasks**: 9 backend (T011, T017, T018, T024, T027, T030, T032, T033, T034) + 2 frontend (T016, T023) + 1 e2e (T036); T018 is the dedicated financial-totals-exclusion test (constitution X NON-NEGOTIABLE) and T032 is the dedicated key-secrecy test (constitution VI/XIV NON-NEGOTIABLE)
- **Suggested MVP scope**: US1 + US2 (Phases 1–4)
