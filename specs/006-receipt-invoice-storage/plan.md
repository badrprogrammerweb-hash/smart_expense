# Implementation Plan: Receipt and Invoice Storage

**Branch**: `006-receipt-invoice-storage` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-receipt-invoice-storage/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add private receipt/invoice file storage on top of the Phase 2–5
workspace/membership/expense foundation. A new `files` table (workspace-scoped,
RLS-enabled, soft-delete) holds file metadata; the actual bytes live in a
**private** Supabase Storage bucket (`receipts`) at path
`{workspace_id}/{file_id}`. All file bytes flow **through the FastAPI backend**
(never a public URL): the backend validates real content type and size,
uploads to Storage using the service-role key, and issues short-lived signed
URLs for preview/download. Uploads are allowed for Owner/Admin/Member; delete
is Owner/Admin-only and is a **soft delete** (binary removed from Storage,
metadata row retained and marked `deleted`). A file may link to at most one
expense via a nullable `files.expense_id`; an expense may have many files.
Deleting an expense sets linked files' `expense_id` to null (files survive).
A new `workspaces.auto_delete_after_extraction` boolean (default `false`,
Owner-only to change) is **stored and displayed only** — nothing consumes it
this phase because AI extraction is Phase 8. The frontend adds an upload
control, a workspace file list with preview/download and (role-gated) delete,
an expense↔file attach/detach control, and the auto-delete toggle in workspace
settings. Authorization is enforced at both layers: RLS on the `files` table
(defense in depth) **and** explicit backend checks before any service-role
Storage operation (constitution IX: RLS alone is not sufficient).

## Technical Context

**Language/Version**: Python 3.11+ for `apps/api` (extended this phase); SQL
(Postgres 15, Supabase-managed) for one new file under `supabase/migrations/`;
TypeScript 5.7 on Next.js 16.x (App Router) / React 18.3 for `apps/web`
(extended this phase). This is the first phase that touches both `apps/api`
and `apps/web` together plus `supabase/`.

**Primary Dependencies**:
- Backend: FastAPI, SQLAlchemy async engine + `asyncpg`, `PyJWT[crypto]` — all
  already in `apps/api/requirements.txt`. New: an HTTP call path to the
  Supabase Storage REST API for upload / signed-URL / remove operations, made
  with the existing `httpx` dependency and the service-role key from
  `app.core.config` (no new Python package required).
- Frontend: already-present `next`, `react`, `@supabase/supabase-js` +
  `@supabase/ssr`, `@tanstack/react-query`, `react-hook-form` + `zod`,
  `next-intl`, `shadcn/ui` + Tailwind v4 (Phase 5 stack) — reused unchanged.
  No new frontend dependency is required; upload uses the browser `FormData`
  API against the FastAPI endpoint.

**Storage**:
- Supabase Postgres — one new table `files` (workspace-scoped, RLS-enabled,
  FK to `workspaces`, `user_profiles`, and nullable FK to `expenses`), plus one
  additive column `auto_delete_after_extraction` on `workspaces`.
- Supabase Storage — one new **private** bucket `receipts`; objects keyed
  `{workspace_id}/{file_id}`. No public bucket, no public URL is ever created
  (constitution VIII).

**Testing**: `pytest` + `pytest-asyncio` + `httpx` (ASGI transport) for
route-level backend tests, same pattern as Phases 2–4; integration tests sign
in as real local-Auth test users via the Supabase CLI stack to exercise RLS
and role permissions directly. Storage interactions are exercised against the
local Supabase Storage emulator where available and otherwise stubbed at the
service boundary so authorization/validation logic is tested without a live
bucket. Frontend: Vitest + React Testing Library for component/permission/
empty-state tests and Playwright for the upload→list→preview→delete e2e flow
(Phase 5 test stack, reused).

**Target Platform**: Local development via Supabase CLI; hosted Supabase for
staging/production; `apps/web` in the browser (desktop + mobile web).
Unchanged deployment posture from prior phases (Bunny Magic Containers hosting
is Phase 10).

**Project Type**: Web application (frontend + backend) monolith. This phase's
changes span `apps/api`, `apps/web`, and `supabase/`.

**Performance Goals**: No raw throughput/latency SLA is specified. SC-001
(upload visible in the list in under 30 seconds for a typical file) is an
end-to-end, human-paced budget, not an API latency target, consistent with
prior phases. Signed-URL expiry is bounded to minutes (research Decision 4).

**Constraints**:
- Files are **private by default**; public Storage access MUST NOT be used
  (constitution VIII; FR-007, FR-010).
- Supported types: PNG, JPEG, WebP, PDF only; validated by **real content
  sniffing**, not extension (FR-002, FR-004). Per-file cap 10 MB; empty files
  rejected (FR-003, FR-005). No per-workspace quota this phase (Clarifications).
- Upload: Owner/Admin/Member. Delete: Owner/Admin only (soft delete). Link/
  detach: Owner/Admin/Member. List + preview/download: all members incl.
  Viewer. Auto-delete setting change: Owner only (FR-001, FR-008, FR-012,
  FR-016, FR-021; Clarifications).
- Every protected action is validated in the backend before any service-role
  Storage call, in addition to RLS (constitution IX; FR-023).
- Tenant isolation: no file, its bytes, or its metadata is reachable across
  workspaces (constitution VII; FR-024).
- Auto-delete setting is **inert** this phase — no automatic deletion runs
  (FR-019, FR-022). No AI extraction, BYOK, reports, malware scanning, or
  thumbnailing (spec Out of scope).
- Money/financial behavior is untouched; linking a file to an expense does not
  change any total (constitution X unaffected).

**Scale/Scope**: 1 new table + 1 additive column; 1 new private Storage bucket;
~7 new backend endpoints (upload, list, get-metadata, download/signed-URL,
link, detach, delete) plus a workspace-settings update for the auto-delete
flag; 1 new migration file with `files` RLS policies and storage policies; new
frontend file-list + upload + attach + settings-toggle surfaces. No changes to
income/expense financial calculation code paths.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Core Product Principle | PASS | Receipt/invoice upload is explicitly in the core MVP surface. No accounting/banking/payment behavior added. |
| III. MVP Scope Discipline | PASS | Only file storage + linkage + a stored preference. AI extraction, BYOK, reports deferred to their phases. |
| V. Manual-First, AI-Optional | PASS | Feature works with zero AI configured; the auto-delete preference is inert until Phase 8. No AI creates records. |
| VI. Privacy and Security | PASS | Private storage by default; RLS on `files`; role-based permissions; every action validated on backend, not RLS-only. |
| VII. Multi-Tenant Isolation | PASS | `files.workspace_id` is mandatory; RLS + backend checks scope every op; Storage objects keyed by workspace; cross-workspace link rejected. |
| VIII. Storage and File Retention | PASS | Permanent by default; delete removes binary but retains metadata; failed/pending has no auto-delete; auto-delete only after explicit opt-in (and only from Phase 8). Private bucket, no public URLs. |
| IX. Architecture Authority | PASS | Backend + Postgres are source of truth; frontend is display-only; signed URLs are short-lived; validation is server-side. |
| X. Financial Accuracy | PASS (untouched) | No money math changes; linking does not affect any total. |
| XIV. Testing Requirements | PASS | Plan covers auth, workspace access, role permissions, file privacy, and tenant isolation tests (SC-002/003/005/007). |
| XV / XVI. Scope Control / Spec-Kit | PASS | Focused spec+plan for this feature only; out-of-scope items enumerated. |

No violations. Complexity Tracking table is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-receipt-invoice-storage/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── files-api.md         # FastAPI file endpoints (upload/list/get/download/link/detach/delete)
│   ├── workspace-settings-api.md  # Auto-delete preference read/update
│   └── storage.md           # Private bucket + Storage access contract (backend-mediated)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── routes/
│   │   └── files.py            # NEW: upload, list, get, download-url, link, detach, delete
│   ├── services/
│   │   ├── files.py            # NEW: authorization + validation + DB metadata orchestration
│   │   └── storage.py          # NEW: Supabase Storage REST client (upload/sign/remove via service role)
│   ├── schemas/
│   │   └── files.py            # NEW: FileMetadata, FileList, LinkRequest, SignedUrl response models
│   └── routes/workspaces.py    # EDIT: expose + update auto_delete_after_extraction
└── tests/
    ├── test_files_upload.py            # NEW: type/size/content validation, role gate
    ├── test_files_access_privacy.py    # NEW: signed URL, cross-workspace denial, anon denial (SC-002)
    ├── test_files_link_expense.py      # NEW: link/detach, cross-workspace reject, expense-delete unlinks
    ├── test_files_delete.py            # NEW: soft delete, binary removed, metadata retained, role gate
    ├── test_files_isolation.py         # NEW: tenant isolation across all ops
    └── test_workspace_auto_delete_setting.py  # NEW: Owner-only, persists, inert

supabase/migrations/
└── 20260702000000_receipt_invoice_storage.sql  # NEW: files table + RLS, workspaces column, storage bucket + policies

apps/web/
├── app/[locale]/w/[workspaceId]/
│   └── files/                  # NEW: file list route (upload, preview/download, delete)
├── components/
│   └── files/                  # NEW: FileUpload, FileList, FileRow, ExpenseFileAttach, DeleteFileDialog
├── components/settings/        # EDIT: add auto-delete toggle
├── components/expense/         # EDIT: attach/detach file control on expense form/detail
├── lib/api/                    # EDIT: files client (upload FormData, list, download-url, link, detach, delete)
├── lib/permissions.ts          # EDIT: canUploadFile / canDeleteFile / canEditAutoDelete helpers
└── messages/                   # EDIT: en + ar strings for file surfaces
```

**Structure Decision**: Web-application monolith. Backend file logic lives in
`apps/api/app/{routes,services,schemas}/files.py` following the existing
route→service→schema split; a dedicated `services/storage.py` isolates all
Supabase Storage REST calls (the only place the service-role key touches
object bytes). The single new migration adds the `files` table, its RLS
policies, the `workspaces.auto_delete_after_extraction` column, and the private
`receipts` bucket with restrictive storage policies. Frontend file surfaces
live under the existing `[locale]/w/[workspaceId]` workspace shell and reuse
the Phase 5 component/permission/i18n patterns.

## Complexity Tracking

> No constitution violations — this table is intentionally empty.
