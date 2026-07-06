# Contract: Extraction API (FastAPI)

New `extractions` router, mounted alongside the existing `files`/`expenses`
routers. All endpoints require a valid Supabase JWT
(`Authorization: Bearer <token>`) and run over the authenticated RLS session
(`get_rls_session` / `open_rls_session` — see research Decision 7 for the
trigger endpoint's two-session split).

**The decrypted BYOK key never appears in any request or response body,
header, or error on any of these endpoints** (constitution VI, XIV;
research Decisions 1–3; dedicated secrecy test).

## Error envelope (shared)

Same app-wide envelope as every other route (`app/main.py` global exception
handlers): `HTTP <status>` with body
`{ "error": { "code": "<code>", "message": "<human message>" } }`.

| Status | `code` | When |
|--------|--------|------|
| 401 | `unauthenticated` | Missing/invalid token. |
| 404 | `not_found` | Workspace, file, or extraction does not exist **or** caller is not a member (existence not leaked). |
| 403 | `forbidden` | Caller is a member but lacks the required role/own-record relationship for this action. |
| 409 | `ai_not_configured` | Trigger attempted with no BYOK configured for the workspace (FR-002). |
| 409 | `extraction_in_progress` | Trigger attempted while the file already has an active extraction (FR-003) or is already linked to an expense (FR-003a). |
| 409 | `already_resolved` | Confirm/discard attempted on an extraction that is no longer `ready_for_review`/`failed` (duplicate submit — FR-012, FR-015). |
| 422 | `invalid_request` | Confirm body missing/invalid `amount_minor` or `occurred_on`, or `category_id` fails the existing category-validation trigger. |
| 503 | `database_unavailable` | DB/RPC unreachable. |

## Model: `ExtractionRead` (response shape, all endpoints)

```jsonc
{
  "id": "b2f1…",
  "workspace_id": "0a3c…",
  "file_id": "9de2…",
  "provider": "gemini",
  "status": "ready_for_review",           // processing | ready_for_review | failed | confirmed | discarded
  "draft": {                              // null when status is "processing" or "failed"
    "amount_minor": 4250,
    "extracted_currency": "SAR",
    "occurred_on": "2026-07-01",
    "vendor_name": "Panda Hypermarket",
    "suggested_category": "Groceries"
  },
  "failure_reason": null,                 // set only when status = "failed"
  "triggered_by": "u1…", "triggered_at": "2026-07-04T10:00:00Z",
  "confirmed_by": null, "confirmed_at": null,
  "discarded_by": null, "discarded_at": null,
  "expense_id": null,                     // set only when status = "confirmed"
  "can_edit": true,                       // computed: caller may edit/confirm this row (own-record rule applied)
  "can_discard": true                     // computed: caller may discard this row
}
```

`can_edit`/`can_discard` are computed server-side from the caller's role and
`triggered_by` (mirroring the same rule the UPDATE RLS policy and
`confirm_ai_extraction` enforce) so the frontend never has to re-derive the
own-record rule itself — it only gates buttons on these two booleans. A
Viewer always gets `can_edit: false, can_discard: false` but still receives
the full `draft` (FR-010).

## POST `/workspaces/{workspace_id}/files/{file_id}/extractions`

Trigger AI extraction on a file (also used to retry after a failure — FR-022).
**Owner, Admin, or Member** — FR-001, FR-005.

- **Behavior** (research Decision 7, three phases):
  1. Resolve caller role. Not a member → 404. Viewer → 403.
  2. Lazily self-heal any stale `processing` row for this file older than 2
     minutes (research Decision 8), then check for an active extraction
     (`processing`/`ready_for_review`) → 409 `extraction_in_progress`; check
     `files.expense_id is not null` → 409 `extraction_in_progress` (FR-003a).
  3. Check the workspace has BYOK configured → 409 `ai_not_configured` if not
     (FR-002); no provider call is made.
  4. Call `get_workspace_ai_key_for_extraction`; insert the `processing` row.
     Commit/close Session 1.
  5. Fetch file bytes (`storage.get_object`) and call the configured
     provider (`ai_providers.extract_receipt`), bounded by a 45s timeout, with
     **no DB session held**.
  6. Open Session 2; update the row to its terminal state (draft fields or
     `failure_reason`); commit/close.
  7. **200** → the terminal `ExtractionRead` (never an intermediate
     "processing" response — the endpoint itself is synchronous end-to-end;
     the frontend shows a client-side spinner for the duration of this one
     call).
- A provider failure (any reason in research Decision 6) still returns
  **200** with `status: "failed"` — a *classified* extraction failure is not
  an HTTP error; it is a successful trigger whose outcome was "failed."

## GET `/workspaces/{workspace_id}/extractions`

List a workspace's extractions. **All members, including Viewer** — FR-010.
Optional query param `?status=ready_for_review` (or any single status) to
power the pending-review queue; omitted returns all, newest `triggered_at`
first.

- **200** → `ExtractionRead[]`.
- **404** if the caller is not a member of / the workspace does not exist.

## GET `/workspaces/{workspace_id}/extractions/{extraction_id}`

Read one extraction. **All members, including Viewer** — FR-010.

- **200** → `ExtractionRead`.
- **404** if not found or the caller is not a member of the owning workspace.

## POST `/workspaces/{workspace_id}/extractions/{extraction_id}/confirm`

Review, correct, and confirm into an expense. **Owner/Admin: any extraction in
the workspace. Member: only one they personally triggered** — FR-011, FR-013;
Clarifications. Not available to Viewer.

**Request body** (the reviewed — possibly corrected — values; this single
submission *is* the "edit" of FR-011, there is no separate persisted edit
step):
```jsonc
{
  "amount_minor": 4250,          // required, > 0
  "occurred_on": "2026-07-01",   // required
  "category_id": "c7…",          // optional; must be an active category in this workspace
  "merchant_name": "Panda Hypermarket",  // optional
  "description": null            // optional
}
```

**Behavior**
1. Resolve caller role and the extraction's `triggered_by`. Not a member /
   extraction not found → **404**. Not `ready_for_review` → **409**
   `already_resolved`. Role/own-record check fails → **403**.
2. Call `confirm_ai_extraction(...)` (validates amount/date, creates the
   expense, links the file, marks the extraction confirmed, and — if the
   workspace's auto-delete setting is on — soft-deletes the file's metadata
   and returns its `storage_path`).
3. If the RPC returned `should_delete_binary = true`, call
   `storage.remove_object(storage_path)` **after** the RPC's transaction has
   committed (research Decision 9's ordering).
4. **200** → the now-`confirmed` `ExtractionRead` (includes `expense_id`).
5. Invalid `amount_minor`/`occurred_on`/`category_id` → **422**
   `invalid_request`, no expense created (FR-012).

## POST `/workspaces/{workspace_id}/extractions/{extraction_id}/discard`

Discard a `ready_for_review` or `failed` extraction. **Owner/Admin: any
extraction. Member: only one they personally triggered** — FR-017;
Clarifications. Not available to Viewer.

- Not a member / not found → **404**. Not `ready_for_review`/`failed` →
  **409** `already_resolved`. Role/own-record check fails → **403**.
- Plain `UPDATE ai_extractions SET status='discarded', discarded_by=...,
  discarded_at=now() WHERE id=... AND status IN ('ready_for_review','failed')`
  (RLS-governed, no RPC — research Decision 10). Zero rows affected (state
  changed concurrently) → **409** `already_resolved`.
- **200** → the now-`discarded` `ExtractionRead`. No expense is created; the
  file is left exactly as it was (FR-017).

## Contract test checklist (backend)

- [ ] Trigger with no BYOK configured → 409 `ai_not_configured`, no provider
      call made, no row created.
- [ ] Trigger on a file with an active extraction, or on a file with
      `expense_id` set → 409 `extraction_in_progress`.
- [ ] Trigger as Viewer → 403. Trigger as Owner/Admin/Member with BYOK
      configured → 200, terminal `ready_for_review` or `failed`.
- [ ] Simulated provider failures (401/403, 429, timeout, unparseable file,
      malformed JSON) each → 200 `status: "failed"` with the matching
      `failure_reason` and zero occurrences of raw provider error content or
      the API key anywhere in the response or logs (SC-005).
- [ ] GET list/get is available to Owner/Admin/Member/Viewer; 404 for a
      non-member.
- [ ] Confirm by the triggering Member → 200, expense created, `currency =
      "SAR"` regardless of `extracted_currency`, file linked, extraction
      `confirmed`.
- [ ] Confirm by a different Member (not the triggerer) → 403; by Owner/Admin
      (regardless of who triggered) → 200.
- [ ] Confirm with invalid amount/date → 422, no expense created.
- [ ] Confirm twice (duplicate submit) → exactly one expense; second call →
      409 `already_resolved`.
- [ ] Confirm in a workspace with auto-delete on → file binary removed after
      the response; auto-delete off → file binary retained.
- [ ] Discard by the triggering Member or by Owner/Admin → 200, no expense,
      file untouched; by a different Member → 403; by Viewer → 403.
- [ ] Cross-workspace: every endpoint returns 404 for a workspace/file/
      extraction the caller is not a member of (SC-008).
