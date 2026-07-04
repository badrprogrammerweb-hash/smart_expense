---
description: "Task list for BYOK AI Settings (007-byok-ai-settings)"
---

# Tasks: BYOK AI Settings

**Input**: Design documents from `/specs/007-byok-ai-settings/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principle XIV lists **AI key security** as a NON-NEGOTIABLE test area, and spec.md's SC-002/SC-005/SC-006/SC-007/SC-008 require "100%"-verified outcomes. `research.md` Decision 3/7 reuse the Phase 2–6 real-local-Supabase-stack testing approach (including a **dedicated key-secrecy test**) for exactly these guarantees.

**Organization**: Tasks are grouped by user story (US1–US5 from `spec.md`) so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in each description

## Path Conventions

Monolith web application per `plan.md`: this phase spans `apps/api` (backend),
`apps/web` (frontend), and `supabase/` (database + Vault). Backend follows the
existing `routes → services → schemas` split; frontend reuses the Phase 5
component/permission/i18n patterns under `[locale]/w/[workspaceId]/settings`. The
raw API key is handled only server-side and is **never** logged or returned.

---

## Phase 1: Setup

**Purpose**: Create empty module/component/i18n scaffolding so later tasks only add behavior. No new dependencies are required (research: Pydantic `SecretStr` and the Phase 5 frontend stack are reused; Vault needs no Python package).

- [X] T001 [P] Create backend module stubs: empty `apps/api/app/schemas/ai_settings.py`, `apps/api/app/services/ai_settings.py`, and `apps/api/app/routes/ai_settings.py` (module docstrings + imports only)
- [X] T002 [P] Create frontend scaffolding: placeholder `apps/web/components/settings/AiSettingsCard.tsx` and mount it (rendering nothing yet) in `apps/web/app/[locale]/w/[workspaceId]/settings/page.tsx`, next to the existing `AutoDeleteToggle`/`AiOptionalNotice`
- [X] T003 [P] Add `aiSettings.*` i18n message keys (provider labels Gemini/OpenAI, key input, masked hint, configured/not-configured, save, remove, and error messages) to `apps/web/messages/en.json` and `apps/web/messages/ar.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database table + Vault RPCs, request/response schemas, key-shape validation, and the API client + permission helper that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create migration `supabase/migrations/20260704000000_byok_ai_settings.sql`: `public.workspace_ai_settings` table (columns, CHECK constraints, `workspace_id` PK/FK `on delete cascade`, `updated_by` FK) per `data-model.md`; enable RLS with the member-SELECT policy; `revoke insert/update/delete ... from authenticated, anon` and `grant select ... to authenticated`; the `set_workspace_ai_key` and `clear_workspace_ai_key` **SECURITY DEFINER** functions per `contracts/vault-rpc.md` (Owner check via `workspace_role_for`, `vault.create_secret`/`vault.update_secret`/`delete from vault.secrets`), `grant execute` to `authenticated`, and function ownership set to a Vault-privileged role. **Precondition (research Decision 3)**: confirm the Vault call signatures and that the migration runner can execute `vault.create_secret` in the target stack
- [X] T005 [P] Define Pydantic models in `apps/api/app/schemas/ai_settings.py`: `AiProvider` enum (`gemini`/`openai`), `AiSettingsStatus` response, and `AiSettingsUpdateRequest` with `provider` + `api_key: SecretStr`, plus the error-code payloads from `contracts/ai-settings-api.md`
- [X] T006 [P] Implement the shape-only key-validation helper and secret-redaction discipline in `apps/api/app/services/ai_settings.py` (provider-appropriate prefix/length/charset per `research.md` Decision 5; **no** network call; reuse the `storage.py` `_redact_secret` pattern) and register the `ai_settings` router in `apps/api/app/main.py`
- [X] T007 [P] Add frontend API client `apps/web/lib/api/ai-settings.ts` (`getAiSettings` / `putAiSettings` / `deleteAiSettings`) and `canManageAiSettings(role) = role === "owner"` in `apps/web/lib/permissions.ts`

**Checkpoint**: Table, Vault RPCs, schemas, validation, and API client ready — user stories can proceed.

---

## Phase 3: User Story 1 - Configure a BYOK provider and key (Priority: P1) 🎯 MVP

**Goal**: An Owner selects a provider and submits a validly-shaped key; it is stored in Vault and the workspace shows "configured" with provider + masked hint. Bad keys and provider-without-key are rejected with nothing stored.

**Independent Test**: As Owner, configure OpenAI then Gemini with valid-shape keys → 200 configured with correct provider + last-4 hint; submit empty/whitespace/malformed keys and a provider with no key → 422, nothing stored.

### Tests for User Story 1

- [X] T008 [P] [US1] Backend test `apps/api/tests/test_ai_settings_configure.py`: Owner configures `gemini` and `openai` with valid-shape keys → `200` configured with provider + `masked_hint`; empty/whitespace/malformed key → `422 invalid_key_format` and nothing stored; missing/unsupported provider → `422`; provider without a key → `422` (FR-001–005; FR-003)

### Implementation for User Story 1

- [X] T009 [US1] Implement configure orchestration in `apps/api/app/services/ai_settings.py`: explicit Owner check (defense in depth), shape-validate the `SecretStr` key, call `set_workspace_ai_key(...)`, map RPC errors (`42501`→403, `22023`→422); never log the key
- [X] T010 [US1] Implement `PUT /workspaces/{workspace_id}/ai-settings` in `apps/api/app/routes/ai_settings.py` returning `200 AiSettingsStatus` (Owner-only; 403/404 mapping per `contracts/ai-settings-api.md`)
- [X] T011 [P] [US1] Frontend `apps/web/components/settings/AiProviderKeyForm.tsx`: provider select + key input + save, calls `lib/api/ai-settings.ts`, clears the key input on success and invalidates the status query; rendered only when `canManageAiSettings`
- [X] T012 [P] [US1] Frontend test `apps/web/components/settings/__tests__/ai-provider-key-form.test.tsx`: form hidden for non-Owner, client-side required/format hints, success clears the input and refreshes status

**Checkpoint**: Configuration works end to end and is independently testable.

---

## Phase 4: User Story 2 - View status without ever exposing the key (Priority: P1)

**Goal**: Any member reads a status showing provider, masked hint, and last-updated — never the key. The key never appears in any response, error, or log. Non-members/anon are denied; only the Owner may change it.

**Independent Test**: With a key configured, request status as each role and inspect every response field + server logs → the raw key never appears (only the last-4 hint); a Workspace-B member and anon are denied Workspace-A settings.

### Tests for User Story 2

- [X] T013 [P] [US2] Backend **dedicated key-secrecy** test `apps/api/tests/test_ai_settings_secrecy.py`: after configure, the `PUT` response, a `GET`, and a forced error response contain no portion of the raw key beyond the last-4 hint; the raw key appears in **zero** captured log lines; `public.workspace_ai_settings` stores only `key_last4` while the secret lives in `vault.secrets` (FR-006–010, FR-024; SC-002/SC-008)
- [X] T014 [P] [US2] Backend authorization + isolation test `apps/api/tests/test_ai_settings_authorization.py`: `GET` allowed for Owner/Admin/Member/Viewer; `PUT`/`DELETE` by Admin/Member/Viewer → `403`; non-member → `404`; anonymous → `401`; cross-workspace `GET`/`PUT`/`DELETE` against another workspace → `404` (FR-020–023; SC-003/SC-007)

### Implementation for User Story 2

- [X] T015 [US2] Implement `GET /workspaces/{workspace_id}/ai-settings` (status; all members) in `apps/api/app/services/ai_settings.py` + `apps/api/app/routes/ai_settings.py`, selecting only the non-secret columns (`provider`, `key_last4`, `updated_at`, `updated_by`) and deriving `configured` — never querying Vault
- [X] T016 [P] [US2] Frontend `apps/web/components/settings/AiKeyStatus.tsx`: renders configured/not-configured badge, provider, masked hint (`••••{last4}`), and last-updated; visible to all members; wired into `AiSettingsCard.tsx`
- [X] T017 [P] [US2] Frontend test `apps/web/components/settings/__tests__/ai-key-status.test.tsx`: not-configured empty state; configured shows provider + masked hint; the component never receives or renders a full key

**Checkpoint**: Private status viewing works, the key is provably never exposed, and access is correctly scoped.

---

## Phase 5: User Story 3 - Replace / rotate / switch provider (Priority: P2)

**Goal**: An Owner replaces the stored key (rotate same provider) or switches provider with a new key; exactly one active config remains and the prior secret is destroyed. Invalid-shape replacements are rejected without changing the existing config.

**Independent Test**: Configure a key, then rotate with a different same-provider key (hint + updated time change), then switch to the other provider — confirm exactly one active config and the prior secret is unrecoverable; an invalid replacement leaves the config unchanged.

### Tests for User Story 3

- [X] T018 [P] [US3] Backend test `apps/api/tests/test_ai_settings_replace.py`: rotate same provider → new `key_last4`, still exactly one row; switch provider → provider changes, one row; the prior `vault_secret_id` content is overwritten/unrecoverable; invalid-shape replacement → `422` with the existing config unchanged (FR-011–014; SC-006)

### Implementation for User Story 3

- [X] T019 [US3] Extend the configure path in `apps/api/app/services/ai_settings.py` so `PUT` on an already-configured workspace routes through `set_workspace_ai_key`'s in-place `vault.update_secret` branch (same `vault_secret_id`), updating `provider`, `key_last4`, `updated_by`, `updated_at`; assert exactly one active config remains
- [X] T020 [P] [US3] Frontend: extend `apps/web/components/settings/AiProviderKeyForm.tsx` for the already-configured state (provider preselected, a "Replace key" affordance) and reflect the updated status after save

**Checkpoint**: Replace / rotate / switch works and is independently testable.

---

## Phase 6: User Story 4 - Remove / clear the key (Priority: P2)

**Goal**: An Owner removes the key — the Vault secret and metadata row are destroyed and the workspace returns to not-configured. Removal when nothing is configured is a safe no-op. Non-Owners cannot remove.

**Independent Test**: With a key configured, remove it as Owner → status not-configured, secret + row gone; remove again → no-op 200; as Admin/Member/Viewer, no remove control and a direct `DELETE` → 403.

### Tests for User Story 4

- [X] T021 [P] [US4] Backend test `apps/api/tests/test_ai_settings_remove.py`: Owner remove → `200` not-configured, `workspace_ai_settings` row and the `vault.secrets` entry gone; remove when nothing configured → `200` no-op; Admin/Member/Viewer remove → `403` (FR-015/016; SC-005)

### Implementation for User Story 4

- [X] T022 [US4] Implement `DELETE /workspaces/{workspace_id}/ai-settings` in `apps/api/app/services/ai_settings.py` + `apps/api/app/routes/ai_settings.py`: Owner-only, call `clear_workspace_ai_key(...)`, return the not-configured `AiSettingsStatus`
- [X] T023 [P] [US4] Frontend `apps/web/components/settings/RemoveAiKeyDialog.tsx`: Owner-only confirm dialog; on success set status to not-configured; no control rendered for non-Owners; wired into `AiSettingsCard.tsx`
- [X] T024 [P] [US4] Frontend test `apps/web/components/settings/__tests__/remove-ai-key.test.tsx`: remove control hidden for non-Owner; confirm flow present for Owner; success updates the status view

**Checkpoint**: Removal + not-configured state works and is independently testable.

---

## Phase 7: User Story 5 - Use the app fully without any BYOK (Priority: P2)

**Goal**: Manual income/expense/category/file/report workflows behave identically whether or not a key is configured, and BYOK state never affects totals or the remaining balance. No AI behavior is triggered by configuring a key.

**Independent Test**: Run a full manual flow with no key configured and again with a key configured — both succeed identically; dashboard totals and remaining balance are unchanged by BYOK state.

### Tests for User Story 5

- [X] T025 [P] [US5] Backend test `apps/api/tests/test_ai_settings_manual_first.py`: creating income/expense/category/file and reading dashboard + reports succeed identically with and without a `workspace_ai_settings` row; totals and remaining balance are byte-for-byte unchanged by BYOK state; no manual endpoint requires BYOK (FR-017–019; SC-004)

### Implementation for User Story 5

- [X] T026 [US5] Reuse `apps/web/components/settings/AiOptionalNotice.tsx` inside `AiSettingsCard.tsx` to communicate that AI is optional, and verify (grep + review) that no manual route/service in `apps/api/app` imports or depends on `ai_settings`; add a short "manual-first, no AI triggered this phase" note in `AiSettingsCard.tsx`

**Checkpoint**: Manual-first guarantee is explicit and provably intact.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T027 [P] Complete and proofread en/ar i18n strings for all AI settings surfaces and verify RTL layout of the AI settings card, provider/key form, status, and remove dialog
- [X] T028 [P] Playwright e2e `apps/web/e2e/ai-settings.spec.ts`: Owner configure → status shows masked hint → replace → remove happy path; non-Owner sees a read-only status (no form/remove); assert the full key never appears in any network response body
- [X] T029 Run `quickstart.md` validation end to end (all `test_ai_settings_*` pytest suites + the frontend tests/e2e + the manual role smoke matrix + the key-secrecy log grep) and record results
- [X] T030 [P] Review `apps/api/app/services/ai_settings.py` + route error handling for consistent error codes and **no key leakage** in logs/errors (reuse the `storage.py` `_redact_secret`/`_sanitized_*` pattern); confirm SQLAlchemy `echo` is off and the target DB will not capture the RPC key parameter via statement logging (research Decision 7)
- [X] T031 [P] Document the `workspace_ai_settings` table, the two Vault RPCs, the `workspace_ai_key:{workspace_id}` secret naming, and env expectations in `supabase/README.md`

## Validation Results (2026-07-04)

- `apps/api/.venv/Scripts/python.exe -m pytest` → 63 passed.
- `npm --workspace apps/web run test` → 12 test files / 37 tests passed.
- `npm --workspace apps/web run test:e2e -- e2e/ai-settings.spec.ts` → 1 passed.
- Local Vault signatures verified for `vault.create_secret` and `vault.update_secret`; Phase 7 migration applied locally through `psql` because the local Supabase migration ledger is missing `20260702000000_receipt_invoice_storage.sql` before an already-recorded later migration.
- RPC ownership verified as `postgres`; SQLAlchemy echo is off; local Postgres `log_statement=ddl`.
- API log grep for submitted BYOK test keys → zero matches.

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** must complete before any user story.
- **US1 (P1)** and **US2 (P1)** are the MVP: configure a key, and view its status while proving the key is never exposed. US2's status/authorization tests depend only on the table + RPCs (Foundational); in practice US1 supplies real configurations to view.
- **US3 (P2)**, **US4 (P2)**, **US5 (P2)** each depend only on Foundational (US3/US4 also exercise the `PUT`/`DELETE` routes from US1/US2). They are independent of one another and can be built in any order after the MVP.
- **Polish (Phase 8)** runs after the stories it validates.

### Parallel opportunities

- Phase 1: T001, T002, T003 all `[P]`.
- Phase 2: T005, T006, T007 `[P]` (T004 first as it defines the table + RPCs every path calls).
- Within each story, backend impl that edits the shared `services/ai_settings.py` / `routes/ai_settings.py` is sequential, while the `[P]` frontend and test tasks run alongside.
- Across stories: once Foundational is done, US3/US4/US5 can proceed in parallel.

## Implementation Strategy

- **MVP = Phase 1 + Phase 2 + US1 + US2**: an Owner can configure a BYOK key and everyone can see its status, with the key provably never exposed — the core of the phase exit criteria ("Authorized users can configure BYOK"; "Stored keys are secure").
- **Increment 2 = US3 + US4**: key rotation/switch and removal (full lifecycle).
- **Increment 3 = US5**: prove the app works without BYOK ("App works without BYOK").
- Ship and test each story at its checkpoint before starting the next.

## Task Summary

- **Total tasks**: 31
- **Per phase**: Setup 3, Foundational 4, US1 5, US2 5, US3 3, US4 4, US5 2, Polish 5
- **Test tasks**: 6 backend (T008, T013, T014, T018, T021, T025) + 3 frontend (T012, T017, T024) + 1 e2e (T028); T013 is the dedicated key-secrecy test (SC-002/SC-008)
- **Suggested MVP scope**: US1 + US2 (Phases 1–4)
