# Contract: Categories API

Resolves FR-003, FR-016–FR-022. Every endpoint here requires the session
validation described in
`../../002-auth-workspace-foundation/contracts/session-validation.md`
(missing/invalid token → `401`; caller not a member of `{workspace_id}` →
`404`), and operates on `{workspace_id}` paths.

## `GET /workspaces/{workspace_id}/categories`

Lists every category in the workspace, including archived ones (a
`?include_archived=false` query parameter, default `true`, lets a caller
fetch only categories valid for new-expense selection). Any role,
including Viewer, may call this. Ordered by `sort_order`.

**Response** `200 OK`:

```json
{
  "categories": [
    { "id": "uuid", "name": "Restaurants", "sort_order": 0, "is_archived": false },
    { "id": "uuid", "name": "Groceries", "sort_order": 1, "is_archived": false },
    { "id": "uuid", "name": "Other", "sort_order": 14, "is_archived": false }
  ]
}
```

Every workspace has these 15 entries immediately after creation, with no
extra setup call (FR-016, research.md Decision 7): Restaurants,
Groceries, Fuel, Transportation, Rent, Utilities, Internet & Mobile,
Health, Education, Family, Shopping, Entertainment, Travel,
Subscriptions, Other.

## `POST /workspaces/{workspace_id}/categories`

Creates a custom category (FR-017). Caller must be Owner or Admin
(research.md Decision 3).

**Request**:

```json
{ "name": "Pets" }
```

The new category is appended after the current highest `sort_order`.

**Response** `201 Created`:

```json
{ "id": "uuid", "name": "Pets", "sort_order": 15, "is_archived": false }
```

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` (research.md Decision 3) |
| `name` is empty | `422` | `invalid_name` |
| `name` duplicates an active category (case-insensitive) in this workspace | `409` | `duplicate_category_name` (FR-018) |

## `PATCH /workspaces/{workspace_id}/categories/{category_id}`

Renames and/or archives a category (FR-019, FR-020). Caller must be Owner
or Admin.

**Request** (all fields optional, at least one required):

```json
{ "name": "Pet Care", "is_archived": true }
```

**Response** `200 OK`:

```json
{ "id": "uuid", "name": "Pet Care", "sort_order": 15, "is_archived": true }
```

Archiving a category does not change `sort_order` or remove its
association with existing expenses (FR-021); it only excludes the
category from selection on new expenses (enforced by `categories-api`
callers filtering on `is_archived`, and by the cross-table trigger in
`data-model.md` only checking workspace match, not archive status — an
already-assigned archived category remains valid on its existing
expense, it just cannot be newly assigned).

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` |
| `category_id` doesn't exist in this workspace | `404` | `not_found` |
| New `name` is empty | `422` | `invalid_name` |
| New `name` duplicates another active category (case-insensitive) | `409` | `duplicate_category_name` (FR-018) |

## `PUT /workspaces/{workspace_id}/categories/order`

Reorders the workspace's categories (FR-022, research.md Decision 12).
Caller must be Owner or Admin.

**Request**: the complete, ordered list of the workspace's category IDs.

```json
{ "category_ids": ["uuid-1", "uuid-2", "uuid-3", "..."] }
```

**Response** `200 OK`: the categories list (same shape as `GET`), in the
new order.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` |
| `category_ids` doesn't exactly match the workspace's current category ID set (missing, extra, or duplicated IDs) | `422` | `invalid_order` |

## Out of scope for this phase

No hard-delete endpoint for categories — archive is the only removal
mechanism (FR-020). No unarchive endpoint exists this phase (data-model.md
notes the schema doesn't prevent adding one later). No per-user category
customization — categories are a single shared, ordered list per
workspace (research.md Decision 3).
