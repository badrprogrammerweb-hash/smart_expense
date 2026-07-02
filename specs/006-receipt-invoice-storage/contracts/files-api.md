# Contract: Files API

Resolves FR-001–FR-018, FR-023, FR-024. Every endpoint requires the session
validation described in
`../../002-auth-workspace-foundation/contracts/session-validation.md`
(missing/invalid token → `401`; caller not a member of `{workspace_id}` →
`404`) and operates on `{workspace_id}` paths. All file bytes flow through the
backend; **no endpoint ever returns a public URL** (constitution VIII).

Role gate summary (research Decision 5): upload = Owner/Admin/Member;
list/get/download = all members incl. Viewer; link/detach = Owner/Admin/Member;
delete = Owner/Admin only.

## `POST /workspaces/{workspace_id}/files`

Uploads a receipt/invoice (FR-001–FR-007). Caller must be Owner, Admin, or
Member — not Viewer (FR-001). Request is `multipart/form-data`.

**Request** (`multipart/form-data`):
- `file`: the binary (required). Optional `expense_id` form field to link on
  upload (must belong to the same workspace — FR-014).

**Server validation before storing** (FR-002/003/004/005):
- Real content type ∈ {`image/png`, `image/jpeg`, `image/webp`,
  `application/pdf`} by magic-byte sniff — else `415 Unsupported Media Type`
  `{"code":"unsupported_file_type"}`.
- `0 < size ≤ 10 MB` — empty → `422 {"code":"empty_file"}`; too large →
  `413 {"code":"file_too_large","limit_bytes":10485760}`.

**Response** `201 Created`:

```json
{
  "id": "uuid",
  "original_filename": "receipt.pdf",
  "content_type": "application/pdf",
  "size_bytes": 84213,
  "expense_id": null,
  "uploaded_by": "uuid",
  "status": "active",
  "created_at": "2026-07-02T09:00:00Z"
}
```

On success the object is stored at `{workspace_id}/{id}` in the private
`receipts` bucket and the metadata row is created (never before the object
write succeeds — no orphan rows). Viewer caller → `403
{"code":"forbidden"}`.

## `GET /workspaces/{workspace_id}/files`

Lists active files in the workspace (FR-008). Any role incl. Viewer.

**Response** `200 OK`:

```json
{
  "files": [
    {
      "id": "uuid",
      "original_filename": "receipt.pdf",
      "content_type": "application/pdf",
      "size_bytes": 84213,
      "expense_id": "uuid",
      "uploaded_by": "uuid",
      "status": "active",
      "created_at": "2026-07-02T09:00:00Z"
    }
  ]
}
```

Deleted files are excluded from this list (FR-008); their history remains
retrievable via `GET .../files/{id}` (below).

## `GET /workspaces/{workspace_id}/files/{file_id}`

Returns a single file's metadata (FR-008). Any member incl. Viewer. Returns
`deleted` files too (metadata retained — FR-017) with `status:"deleted"` and
`deleted_at`. Cross-workspace / non-member → `404`.

## `GET /workspaces/{workspace_id}/files/{file_id}/download-url`

Issues a short-lived signed URL for preview/download (FR-009, FR-011). Any
member incl. Viewer. File must be `active` — a `deleted` file → `410 Gone`
`{"code":"file_deleted"}` (FR-018).

**Response** `200 OK`:

```json
{ "url": "https://<project>.storage.supabase.co/object/sign/receipts/...",
  "expires_in": 300 }
```

The URL expires after `expires_in` seconds (default 300) and is not reusable
after expiry (FR-011). Minted with the service-role key only after the caller
is authorized (research Decision 1). Anonymous request → `401`; non-member →
`404`.

## `POST /workspaces/{workspace_id}/files/{file_id}/link`

Links a file to an expense (FR-012, FR-013). Caller Owner/Admin/Member (not
Viewer). Body `{ "expense_id": "uuid" }`.

- Expense must exist and share the workspace → else `422
  {"code":"cross_workspace_link"}` (FR-014).
- File must be `active` → deleted file → `410` (edge case).
- Replaces any existing link (≤1 expense per file). Response `200 OK` with
  updated metadata. Viewer → `403`.

## `DELETE /workspaces/{workspace_id}/files/{file_id}/link`

Detaches the file from its expense (FR-012). Owner/Admin/Member. Sets
`expense_id = null`; neither record is deleted. Response `200 OK`.

## `DELETE /workspaces/{workspace_id}/files/{file_id}`

Soft-deletes the file (FR-016, FR-017). Caller must be **Owner or Admin** —
Member/Viewer → `403 {"code":"forbidden"}`.

**Behavior**:
- Removes the object from the `receipts` bucket (service role).
- Sets `status='deleted'`, `deleted_at=now()`, `deleted_by=caller`; the row is
  retained (FR-017).
- After this, `download-url` for the file → `410` and any previously issued
  signed URL no longer returns content once the object is gone (FR-018).

**Response** `200 OK`:

```json
{ "id": "uuid", "status": "deleted", "deleted_at": "2026-07-02T10:00:00Z" }
```

## Expense linkage exposure

`GET /workspaces/{workspace_id}/expenses/{expense_id}` (existing) is extended
to include an additive `files` array of the active files linked to that expense
(FR-012), each entry the same shape as the list item above. Deleting an
expense nulls its files' `expense_id`; the files remain in the workspace file
list (FR-015). This is the only change to existing expense endpoints; no
financial field changes.

## Error codes

| Status | Code | When |
|--------|------|------|
| 401 | `unauthenticated` | Missing/invalid token (any endpoint). |
| 403 | `forbidden` | Role not permitted (Viewer upload/link; Member/Viewer delete). |
| 404 | `not_found` | File/workspace not visible to caller (incl. cross-workspace). |
| 410 | `file_deleted` | download-url/link on a soft-deleted file. |
| 413 | `file_too_large` | Upload > 10 MB. |
| 415 | `unsupported_file_type` | Content type not png/jpeg/webp/pdf. |
| 422 | `empty_file` / `cross_workspace_link` | 0-byte upload / link across workspaces. |
