# Quickstart & Validation: Receipt and Invoice Storage

Runnable validation for the Phase 6 feature. Proves upload, private access,
expense linking, deletion, and the (inert) auto-delete setting end to end.
References: [contracts/files-api.md](./contracts/files-api.md),
[contracts/workspace-settings-api.md](./contracts/workspace-settings-api.md),
[contracts/storage.md](./contracts/storage.md),
[data-model.md](./data-model.md).

## Prerequisites

- Supabase CLI stack running locally (Auth + Postgres + Storage emulator), as
  used in Phases 2–5.
- The new migration `supabase/migrations/20260702000000_receipt_invoice_storage.sql`
  applied (`supabase db reset` or `supabase migration up`) — creates the
  `files` table + RLS, the `workspaces.auto_delete_after_extraction` column,
  and the private `receipts` bucket + storage policies.
- `apps/api` env includes `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_DB_URL`, `SUPABASE_JWT_SECRET` (already required by prior phases).
- Local test users seeded with the four roles in one workspace (Owner, Admin,
  Member, Viewer), plus a second workspace for isolation checks — same seeding
  approach as Phase 3/5 integration tests.
- Backend: `cd apps/api && uvicorn app.main:app --reload`.
- Frontend: `cd apps/web && npm run dev`.

## Backend validation (pytest)

```bash
cd apps/api
pytest tests/test_files_upload.py \
       tests/test_files_access_privacy.py \
       tests/test_files_link_expense.py \
       tests/test_files_delete.py \
       tests/test_files_isolation.py \
       tests/test_workspace_auto_delete_setting.py
```

Expected outcomes:

| Scenario | Expectation | Traces |
|----------|-------------|--------|
| Member uploads a valid PNG and PDF | `201`, row created, object at `{ws}/{id}` | US1, FR-001/002/006/007 |
| Upload a `.exe` (or renamed `.pdf`) | `415 unsupported_file_type`, nothing stored | US1, FR-002/004 |
| Upload > 10 MB / 0-byte | `413 file_too_large` / `422 empty_file` | US1, FR-003/005 |
| Viewer attempts upload | `403 forbidden` | US1, FR-001 |
| Member lists + gets a download URL | `200`, URL with `expires_in≤300` | US2, FR-008/009/011 |
| Anonymous requests a file | `401`, no URL issued | US2, FR-010, SC-002 |
| Workspace-B member requests Workspace-A file | `404` | US2, FR-024, SC-002 |
| Link file to same-workspace expense; then detach | `200`; expense shows file, then unlinked | US3, FR-012/013 |
| Link file to other-workspace expense | `422 cross_workspace_link` | US3, FR-014 |
| Delete the linked expense | file remains, `expense_id` nulled | US3, FR-015 |
| Owner/Admin deletes a file | `200 status:deleted`; object gone; metadata retained | US4, FR-016/017 |
| `download-url` on a deleted file | `410 file_deleted` | US4, FR-018 |
| Member/Viewer attempts delete | `403 forbidden` | US4, FR-016 |
| Owner toggles auto-delete on/off | persists across reads; **zero files deleted** | US5, FR-020/021/022, SC-006 |
| Admin/Member/Viewer toggles auto-delete | `403 forbidden` | US5, FR-021 |

## Frontend validation (manual + automated)

Manual smoke (dev server), signed in per role:

1. As Member: open the workspace **Files** page, upload a receipt image →
   appears in the list with name/type/size/time.
2. Click a file → preview/download opens via a short-lived link.
3. On an expense, attach the uploaded file → expense shows it; detach → gone.
4. As Admin: delete a file → it leaves the active list; history still shows it
   as deleted. As Member/Viewer: no delete control is offered.
5. As Owner: Settings → toggle "auto-delete after extraction" on, reload →
   still on; no file disappears. As Admin/Member/Viewer: the toggle is
   read-only/hidden.

Automated:

```bash
cd apps/web
npm run test         # Vitest: upload form validation, role-gated controls, empty states
npm run test:e2e     # Playwright: upload → list → preview → delete happy path
```

## Success-criteria mapping

- **SC-001** upload visible < 30 s — manual smoke step 1 + e2e timing.
- **SC-002** 100% private — `test_files_access_privacy.py` + `test_files_isolation.py`
  (anon + cross-workspace denial).
- **SC-003** all bad uploads rejected pre-store — `test_files_upload.py`.
- **SC-004** attach/navigate expense↔receipt — `test_files_link_expense.py` +
  manual step 3.
- **SC-005** deleted binary unretrievable, history retained —
  `test_files_delete.py`.
- **SC-006** setting persists, zero deletions — `test_workspace_auto_delete_setting.py`.
- **SC-007** role permissions hold — role assertions across the upload/delete/
  link/setting tests.
