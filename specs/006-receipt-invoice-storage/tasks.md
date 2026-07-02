---
description: "Task list for Receipt and Invoice Storage (006-receipt-invoice-storage)"
---

# Tasks: Receipt and Invoice Storage

**Input**: Design documents from `/specs/006-receipt-invoice-storage/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principle XIV requires file privacy, tenant isolation, and role-permission testing, and spec.md's SC-002/SC-005/SC-007 require "100%" verified outcomes — `research.md` Decision 8 reuses the Phase 2–4 real-local-Supabase-stack testing approach for exactly these guarantees.

**Organization**: Tasks are grouped by user story (US1–US5 from `spec.md`) so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in each description

## Path Conventions

Monolith web application per `plan.md`: this phase spans `apps/api` (backend),
`apps/web` (frontend), and `supabase/` (database + Storage). Backend follows the
existing `routes → services → schemas` split; frontend reuses the Phase 5
component/permission/i18n patterns under `[locale]/w/[workspaceId]`.

---

## Phase 1: Setup

**Purpose**: Create empty module/route/i18n scaffolding so later tasks only add behavior. No new dependencies are required (research Decision 1 & plan: `httpx` and the Phase 5 frontend stack are reused).

- [X] T001 [P] Create backend module stubs: empty `apps/api/app/schemas/files.py`, `apps/api/app/services/files.py`, `apps/api/app/services/storage.py`, and `apps/api/app/routes/files.py` (module docstrings + imports only)
- [X] T002 [P] Create frontend scaffolding: `apps/web/app/[locale]/w/[workspaceId]/files/page.tsx` placeholder, `apps/web/components/files/` directory, and a "Files" nav entry in the workspace shell layout
- [X] T003 [P] Add `files.*` i18n message keys (upload, list columns, preview/download, delete, auto-delete toggle, errors) to `apps/web/messages/en.json` and `apps/web/messages/ar.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, private bucket, Storage client, schemas, and API client that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create migration `supabase/migrations/20260702000000_receipt_invoice_storage.sql`: `public.files` table with all columns, CHECK constraints, and indexes per `data-model.md`; `set_updated_at` trigger; `files_validate_expense` trigger (rejects cross-workspace `expense_id`); RLS policies (member SELECT, non-viewer INSERT, owner/admin/uploader UPDATE) and `grant select, insert, update on public.files to authenticated`; additive `workspaces.auto_delete_after_extraction boolean not null default false`; create **private** `receipts` bucket and `storage.objects` policies scoping access to workspace members via the key's first path segment
- [X] T005 [P] Implement `apps/api/app/services/storage.py`: service-role Supabase Storage REST client with `put_object(key, bytes, content_type)`, `sign_url(key, ttl=300)`, `remove_object(key)`; keys are `{workspace_id}/{file_id}`; never generates a public URL; sanitizes/logs errors without leaking the service-role key (per `contracts/storage.md`)
- [X] T006 [P] Define Pydantic models in `apps/api/app/schemas/files.py`: `FileMetadata`, `FileListResponse`, `LinkRequest`, `SignedUrlResponse`, and the error-code payloads from `contracts/files-api.md`
- [X] T007 Implement content-type sniffing + limits helper in `apps/api/app/services/files.py` (magic bytes for png/jpeg/webp/pdf; reject non-matching, 0-byte, and >10 MB) and register the files router in `apps/api/app/main.py`
- [X] T008 [P] Add frontend files API client `apps/web/lib/api/files.ts` (upload via `FormData`, list, get, download-url, link, detach, delete) and role helpers `canUploadFile` / `canDeleteFile` / `canEditAutoDelete` in `apps/web/lib/permissions.ts`

**Checkpoint**: Schema, bucket, Storage client, and API client ready — user stories can proceed.

---

## Phase 3: User Story 1 - Upload a receipt or invoice (Priority: P1) 🎯 MVP

**Goal**: Owner/Admin/Member can upload a supported image or PDF; it is stored privately and appears in the workspace file list. Unsupported/oversize/empty files and Viewer uploads are rejected.

**Independent Test**: Sign in as a Member, upload a valid JPEG and a valid PDF → both stored with correct metadata; upload a renamed `.exe`, a >10 MB file, and a 0-byte file → all rejected; Viewer upload → 403.

### Tests for User Story 1

- [ ] T009 [P] [US1] Backend test `apps/api/tests/test_files_upload.py`: valid PNG/JPEG/WebP/PDF → `201` with metadata + stored object; renamed-executable/`.docx` → `415`; >10 MB → `413`; 0-byte → `422`; Viewer → `403` (FR-001–005; SC-003)

### Implementation for User Story 1

- [ ] T010 [US1] Implement upload orchestration in `apps/api/app/services/files.py`: authorize (Owner/Admin/Member), sniff + size-check, `put_object` to Storage, then insert the `files` row (row created only after object write succeeds — no orphan on failure)
- [ ] T011 [US1] Implement `POST /workspaces/{workspace_id}/files` (multipart, optional `expense_id`) in `apps/api/app/routes/files.py` returning `201` per contract
- [ ] T012 [P] [US1] Frontend `apps/web/components/files/FileUpload.tsx`: file picker with client-side type/size hints, calls `lib/api/files.ts`, shows success/error; render on the files page gated by `canUploadFile`
- [ ] T013 [P] [US1] Frontend test `apps/web/components/files/__tests__/file-upload.test.tsx`: control hidden for Viewer, client-side validation messages, success path invalidates the file-list query

**Checkpoint**: Upload works end to end and is independently testable.

---

## Phase 4: User Story 2 - View and privately access files (Priority: P1)

**Goal**: Members (incl. Viewer) list workspace files and preview/download individual files via short-lived signed URLs. Anonymous and cross-workspace access is denied.

**Independent Test**: As a Workspace-A member, list files and open a download URL (expires ≤300 s); as a Workspace-B member request an A file → 404; anonymous request → 401; expired URL no longer serves content.

### Tests for User Story 2

- [ ] T014 [P] [US2] Backend test `apps/api/tests/test_files_access_privacy.py`: list `200`; `download-url` `200` with `expires_in≤300`; non-member → `404`; anonymous → `401` (FR-008–011; SC-002). (Deleted-file `410` is covered in US4/T023.)
- [ ] T015 [P] [US2] Backend test `apps/api/tests/test_files_isolation.py`: list/get/download-url/link/delete against a file in another workspace all → `404` for every role (FR-024; SC-002)

### Implementation for User Story 2

- [ ] T016 [US2] Implement list (active-only), get-metadata (incl. deleted rows), and `download-url` (active-only, else `410`) in `apps/api/app/services/files.py` + `apps/api/app/routes/files.py`, minting signed URLs via `services/storage.py` after authorization
- [ ] T017 [P] [US2] Frontend `apps/web/components/files/FileList.tsx` + `FileRow.tsx`: columns name/type/size/upload time/uploader/linked-expense badge; preview/download uses `download-url`; wire into the files page with an empty state
- [ ] T018 [P] [US2] Frontend test `apps/web/components/files/__tests__/file-list.test.tsx`: rows render metadata, empty state shows, preview/download triggers the client call

**Checkpoint**: Private listing and access work and are independently testable.

---

## Phase 5: User Story 3 - Link a file to an expense (Priority: P2)

**Goal**: Owner/Admin/Member attach a file to a same-workspace expense and detach it; the expense shows its files and the file shows its expense. Cross-workspace links are rejected; deleting an expense unlinks (does not delete) files.

**Independent Test**: Link a file to an expense → both sides reflect it; detach → both cleared; link across workspaces → 422; delete the expense → file survives with `expense_id` null.

### Tests for User Story 3

- [ ] T019 [P] [US3] Backend test `apps/api/tests/test_files_link_expense.py`: link then detach; cross-workspace link → `422`; link to a deleted file → `410`; deleting the expense nulls the link and keeps the file; Viewer link → `403` (FR-012–015)

### Implementation for User Story 3

- [ ] T020 [US3] Implement `POST /files/{id}/link` and `DELETE /files/{id}/link` in `apps/api/app/routes/files.py` + service (validate same-workspace + existing expense, active file, replace any existing link; Owner/Admin/Member only)
- [ ] T021 [US3] Extend `GET /workspaces/{workspace_id}/expenses/{expense_id}` in `apps/api/app/routes/expenses.py` + `apps/api/app/schemas/expenses.py` to include an additive `files` array; verify the `expenses` delete path leaves files (relies on `on delete set null` from T004) with no financial-field change
- [ ] T022 [P] [US3] Frontend `apps/web/components/expense/ExpenseFileAttach.tsx`: attach/detach control wired into the expense form/detail, gated by non-Viewer; shows currently linked file(s)

**Checkpoint**: Expense linking works and is independently testable.

---

## Phase 6: User Story 4 - Delete a file (Priority: P2)

**Goal**: Owner/Admin soft-delete a file — binary removed, metadata retained and marked deleted; deleted files leave the active list but remain in history; download-url on a deleted file → 410. Member/Viewer cannot delete.

**Independent Test**: As Admin, delete a file → object unretrievable, metadata retained as deleted; as Member/Viewer, no delete control and direct delete → 403.

### Tests for User Story 4

- [ ] T023 [P] [US4] Backend test `apps/api/tests/test_files_delete.py`: Owner and Admin delete → `200 status:deleted`, object removed, row retained with `deleted_at`/`deleted_by`; subsequent `download-url` → `410`; Member and Viewer → `403` (FR-016–018; SC-005)

### Implementation for User Story 4

- [ ] T024 [US4] Implement `DELETE /workspaces/{workspace_id}/files/{file_id}` in `apps/api/app/routes/files.py` + service: authorize Owner/Admin only, `remove_object` via `services/storage.py`, set `status='deleted'`, `deleted_at`, `deleted_by`; keep the row
- [ ] T025 [P] [US4] Frontend `apps/web/components/files/DeleteFileDialog.tsx`: confirm dialog gated by `canDeleteFile`; on success remove the row from the active list; no delete control rendered for Member/Viewer
- [ ] T026 [P] [US4] Frontend test `apps/web/components/files/__tests__/delete-file.test.tsx`: delete control hidden for Member/Viewer, confirm flow present for Owner/Admin

**Checkpoint**: Deletion + retention works and is independently testable.

---

## Phase 7: User Story 5 - Configure the auto-delete setting (Priority: P3)

**Goal**: Owner toggles the workspace "auto-delete after extraction" preference (default off); it persists and displays. It is inert — toggling deletes zero files. Non-Owners cannot change it.

**Independent Test**: As Owner, toggle on → persists on reload; toggle off → persists; no file is deleted. As Admin/Member/Viewer, the toggle is not editable and a direct change → 403.

### Tests for User Story 5

- [ ] T027 [P] [US5] Backend test `apps/api/tests/test_workspace_auto_delete_setting.py`: Owner sets true/false and it persists across reads; Admin/Member/Viewer → `403`; toggling deletes zero files (FR-020–022; SC-006)

### Implementation for User Story 5

- [ ] T028 [US5] Expose `auto_delete_after_extraction` in `apps/api/app/schemas/workspaces.py` + workspace GET responses, and implement `PATCH /workspaces/{workspace_id}` accepting **only** that field, Owner-only, in `apps/api/app/routes/workspaces.py` (per `contracts/workspace-settings-api.md`)
- [ ] T029 [P] [US5] Frontend auto-delete toggle in `apps/web/components/settings/` (editable only when `canEditAutoDelete`, read-only/hidden otherwise) calling the workspaces PATCH client
- [ ] T030 [P] [US5] Frontend test for the settings toggle: editable for Owner, read-only for others, persists displayed value

**Checkpoint**: Auto-delete preference available (and provably inert).

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T031 [P] Complete and proofread en/ar i18n strings for all file surfaces and verify RTL layout of the files page, upload, and settings toggle
- [ ] T032 [P] Playwright e2e `apps/web/e2e/files.spec.ts`: sign in → upload → see in list → preview → delete happy path, plus Viewer sees no upload/delete controls
- [ ] T033 Run `quickstart.md` validation end to end (all six pytest suites + the frontend test/e2e commands + the manual role smoke matrix) and record results
- [ ] T034 [P] Document the `receipts` private bucket, key convention, and env expectations in `supabase/README.md`
- [ ] T035 Review storage error handling and logging in `apps/api/app/services/storage.py` for consistent error codes and no service-role-key/secret leakage (reuse the `_sanitized_*` pattern)

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** must complete before any user story.
- **US1 (P1)** and **US2 (P1)** are the MVP. US2's list/download depend only on the `files` table (Foundational); US2 can be tested independently by seeding a file row + object, but in practice US1 supplies real uploads.
- **US3 (P2)**, **US4 (P2)**, **US5 (P3)** each depend only on Foundational (US3 also touches the existing expenses endpoint). They are independent of one another and can be built in any order after the MVP.
- **Polish (Phase 8)** runs after the stories it validates.

### Parallel opportunities

- Phase 1: T001, T002, T003 all `[P]`.
- Phase 2: T005, T006, T008 `[P]` (T004 first as it defines the schema; T007 after T005/T006).
- Within each story, backend impl (single files) is sequential where it edits the same `files.py`/`routes`, while the `[P]` frontend and test tasks run alongside.
- Across stories: once Foundational is done, US3/US4/US5 teams can work in parallel.

## Implementation Strategy

- **MVP = Phase 1 + Phase 2 + US1 + US2**: users can privately upload and access receipts/invoices — the core of the phase exit criteria.
- **Increment 2 = US3 + US4**: expense linkage and deletion/retention.
- **Increment 3 = US5**: the inert auto-delete preference (readies Phase 8).
- Ship and test each story at its checkpoint before starting the next.

## Task Summary

- **Total tasks**: 35
- **Per story**: Setup 3, Foundational 5, US1 5, US2 5, US3 4, US4 4, US5 4, Polish 5
- **Test tasks**: 6 backend (T009, T014, T015, T019, T023, T027) + 4 frontend (T013, T018, T026, T030) + 1 e2e (T032)
- **Suggested MVP scope**: US1 + US2 (Phases 1–4)
