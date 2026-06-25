# Contract: Incomes API

Resolves FR-001, FR-004–FR-009, FR-011, FR-012, FR-014, FR-023–FR-026,
FR-029, FR-030. Every endpoint here requires the session validation
described in
`../../002-auth-workspace-foundation/contracts/session-validation.md`
(missing/invalid token → `401`; caller not a member of `{workspace_id}` →
`404`), and operates on `{workspace_id}` paths.

Amounts in every request/response body are integers in minor currency
units (halalas) — `amount_minor: 5000` means 50.00 SAR (research.md
Decision 1). `currency` is always `"SAR"` this phase.

## `GET /workspaces/{workspace_id}/incomes`

Lists income records in the workspace (FR-011). Any role, including
Viewer, may call this.

**Response** `200 OK`:

```json
{
  "incomes": [
    {
      "id": "uuid",
      "amount_minor": 500000,
      "currency": "SAR",
      "occurred_on": "2026-06-01",
      "description": "Monthly salary",
      "status": "confirmed",
      "created_by": "uuid",
      "created_at": "2026-06-01T08:00:00Z",
      "updated_at": "2026-06-01T08:00:00Z"
    }
  ]
}
```

Deleted records are excluded by default (FR-009); they are not exposed
through this endpoint at all this phase (no restore/undelete UI exists —
Clarification 3).

## `POST /workspaces/{workspace_id}/incomes`

Creates a confirmed income record (FR-001, FR-004). Caller must be Owner
or Admin (FR-014).

**Request**:

```json
{
  "amount_minor": 500000,
  "occurred_on": "2026-06-01",
  "description": "Monthly salary"
}
```

`description` is optional. `currency` is not accepted in the request
body — it is always `"SAR"` this phase (FR-024).

**Response** `201 Created`: same shape as a list item above, with
`status: "confirmed"`.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` (FR-014) |
| `amount_minor` is zero, negative, or missing | `422` | `invalid_amount` (FR-025) |
| `occurred_on` is missing or not a valid date | `422` | `invalid_date` (FR-026) |

## `GET /workspaces/{workspace_id}/incomes/{income_id}`

Returns one income record (FR-011).

**Response** `200 OK`: same shape as a list item.

**Errors**: `404` `not_found` if `income_id` doesn't exist in this
workspace (including if it belongs to a different workspace — never
distinguished from "doesn't exist").

## `PATCH /workspaces/{workspace_id}/incomes/{income_id}`

Edits an existing income record (FR-005). Caller must be Owner or Admin
(FR-012) — Members have no income permissions this phase, so there is no
"edit your own" case here, unlike expenses.

**Request** (all fields optional, at least one required):

```json
{ "amount_minor": 520000, "occurred_on": "2026-06-02", "description": "Salary + bonus" }
```

**Response** `200 OK`: the updated record. `updated_at` reflects the
edit (research.md Decision 5 — no conflict detection; a concurrent edit
from another Owner/Admin simply applies in commit order, last write
wins).

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` |
| Record is already `deleted` | `404` | `not_found` — a soft-deleted record cannot be edited (no restore path, Clarification 3) |
| `amount_minor` provided but zero/negative | `422` | `invalid_amount` |
| `occurred_on` provided but invalid | `422` | `invalid_date` |

## `DELETE /workspaces/{workspace_id}/incomes/{income_id}`

Soft-deletes an income record (FR-006, FR-007). Caller must be Owner or
Admin (FR-012). Sets `status = "deleted"`; the record is excluded from
confirmed totals immediately (FR-008/FR-009) and from the list/get
endpoints above, but the row is retained for backend traceability — there
is no restore endpoint (Clarification 3).

**Response**: `204 No Content`.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` |
| Record already `deleted` | `404` | `not_found` |

## Out of scope for this phase

No restore/undelete endpoint (Clarification 3). No bulk import. No
`/totals` or aggregation endpoint — that is Phase 4 (research.md Decision
11); this contract's `GET` endpoints return raw records only.
