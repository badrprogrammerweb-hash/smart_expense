# Contract: Workspace Base Currency API

Extends the existing `apps/api/app/routes/workspaces.py` endpoints (same
pattern as `specs/006-receipt-invoice-storage/contracts/workspace-settings-api.md`
used for `auto_delete_after_extraction`). Resolves FR-006–FR-011.

## Currency exposure on the workspace resource

`GET /workspaces`, `GET /workspaces/{workspace_id}` (existing) gain an
additive field:

```json
{ "id": "uuid", "name": "Home", "currency": "SAR", "auto_delete_after_extraction": false }
```

Default is `"SAR"` for every workspace, including every workspace that existed
before this phase. Any member (including Viewer) may read it.

## `PATCH /workspaces/{workspace_id}`

Extended to accept an optional `currency` field alongside the existing
`auto_delete_after_extraction`. Both remain independently settable in the same
request or separate requests.

**Authorization**: caller MUST be the workspace **Owner** — Admin/Member/
Viewer → `403 {"code":"forbidden"}` (unchanged existing role check, FR-008).

**Request**:

```json
{ "currency": "USD" }
```

**Validation**:

- `currency` MUST be one of the values in `public.supported_currencies`
  (`SAR`, `USD`, `EUR`, `GBP`, `AED`, `EGP`, `KWD`, `QAR`, `BHD`, `OMR`); any
  other value → `422 {"code": "invalid_request", ...}` (FR-007).
- If the workspace already has at least one row (confirmed or soft-deleted)
  in `incomes` or `expenses`, the update is rejected → `409` with
  `{"code": "currency_locked", "message": "..."}` (FR-009). The database
  trigger (`contracts/schema-migration.md`) is the authoritative enforcement;
  the route additionally pre-checks so it can return the more specific
  `currency_locked` code instead of a generic database error.

**Response** `200 OK`:

```json
{ "id": "uuid", "currency": "USD", "auto_delete_after_extraction": false }
```

## Effect on new records (FR-010, FR-011)

`POST` endpoints for incomes/expenses (existing, unchanged route surface)
continue to accept no client-supplied `currency` field — the service layer
sets it from the workspace's current `currency` column at insert time (mirrors
how it already defaults to `SAR` today). This is what makes "new records use
the workspace's current currency" true without adding a new field to the
income/expense creation contracts. Attempting to create or edit a record with
an explicit currency different from the workspace's is rejected by the new
database trigger regardless of any application-layer bug (defense in depth,
constitution Principle IX).

## Non-regression

Existing workspaces with no explicit currency set continue to read/behave
exactly as `SAR`-only did before this phase (SC-002).
