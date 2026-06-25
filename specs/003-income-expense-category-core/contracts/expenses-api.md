# Contract: Expenses API

Resolves FR-002, FR-003, FR-005–FR-013, FR-018 (category reference only),
FR-023–FR-026, FR-029, FR-030. Every endpoint here requires the session
validation described in
`../../002-auth-workspace-foundation/contracts/session-validation.md`
(missing/invalid token → `401`; caller not a member of `{workspace_id}` →
`404`), and operates on `{workspace_id}` paths.

Amounts are integers in minor currency units (halalas) — see
`contracts/incomes-api.md` for the same convention.

## `GET /workspaces/{workspace_id}/expenses`

Lists expense records in the workspace (FR-011). Any role, including
Viewer, may call this.

**Response** `200 OK`:

```json
{
  "expenses": [
    {
      "id": "uuid",
      "amount_minor": 4500,
      "currency": "SAR",
      "occurred_on": "2026-06-10",
      "category_id": "uuid",
      "description": "Lunch with team",
      "merchant_name": "Al Baik",
      "status": "confirmed",
      "created_by": "uuid",
      "created_at": "2026-06-10T12:30:00Z",
      "updated_at": "2026-06-10T12:30:00Z"
    }
  ]
}
```

`category_id` is `null` for uncategorized expenses (FR-003). Deleted
records are excluded (FR-009) and not exposed through this endpoint at
all this phase (no restore — Clarification 3).

## `POST /workspaces/{workspace_id}/expenses`

Creates a confirmed expense record (FR-002, FR-004). Caller must be
Owner, Admin, or Member — not Viewer (FR-013, FR-015).

**Request**:

```json
{
  "amount_minor": 4500,
  "occurred_on": "2026-06-10",
  "category_id": "uuid",
  "description": "Lunch with team",
  "merchant_name": "Al Baik"
}
```

`category_id`, `description`, and `merchant_name` are all optional
(FR-002, FR-003). `currency` is not accepted — always `"SAR"` (FR-024).

**Response** `201 Created`: same shape as a list item, with
`status: "confirmed"`, `created_by` set to the caller.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Viewer | `403` | `forbidden` (FR-015) |
| `amount_minor` is zero, negative, or missing | `422` | `invalid_amount` (FR-025) |
| `occurred_on` is missing or not a valid date | `422` | `invalid_date` (FR-026) |
| `category_id` references a category outside this workspace, or that doesn't exist | `422` | `invalid_category` (data-model.md cross-table trigger) |
| `category_id` references an archived category | `422` | `category_archived` (FR-021; data-model.md cross-table trigger) |

## `GET /workspaces/{workspace_id}/expenses/{expense_id}`

Returns one expense record (FR-011).

**Response** `200 OK`: same shape as a list item.

**Errors**: `404` `not_found` if `expense_id` doesn't exist in this
workspace.

## `PATCH /workspaces/{workspace_id}/expenses/{expense_id}`

Edits an existing expense record (FR-005).

**Request** (all fields optional, at least one required):

```json
{ "amount_minor": 5000, "category_id": null, "merchant_name": "Al Baik Express" }
```

**Authorization** (FR-012, FR-013):

- Owner or Admin caller: may edit any expense in the workspace.
- Member caller: may edit only an expense where `created_by` is their own
  user id. Editing another member's expense returns `403`.
- Viewer caller: always `403`.

**Response** `200 OK`: the updated record. `updated_at` reflects the
edit; concurrent edits use last-write-wins with no conflict error
(research.md Decision 5).

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Viewer caller | `403` | `forbidden` |
| Member caller editing another user's expense | `403` | `forbidden` (FR-013) |
| Record is already `deleted` | `404` | `not_found` (no restore — Clarification 3) |
| `amount_minor` provided but zero/negative | `422` | `invalid_amount` |
| `occurred_on` provided but invalid | `422` | `invalid_date` |
| `category_id` provided but invalid for this workspace | `422` | `invalid_category` |
| `category_id` changed to an archived category | `422` | `category_archived` (FR-021; only checked when `category_id` is part of the request and differs from the current value) |

## `DELETE /workspaces/{workspace_id}/expenses/{expense_id}`

Soft-deletes an expense record (FR-006, FR-007). Same authorization rule
as `PATCH` above: Owner/Admin may delete any expense; a Member may delete
only their own; Viewer never. Sets `status = "deleted"`, excluded from
totals immediately (FR-008/FR-009), retained for traceability, no restore
endpoint (Clarification 3).

**Response**: `204 No Content`.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Viewer caller | `403` | `forbidden` |
| Member caller deleting another user's expense | `403` | `forbidden` (FR-013) |
| Record already `deleted` | `404` | `not_found` |

## Out of scope for this phase

No restore/undelete endpoint (Clarification 3). No receipt/invoice file
attachment field (research.md Decision 10 — Phase 6). No `/totals` or
aggregation endpoint (research.md Decision 11 — Phase 4).
