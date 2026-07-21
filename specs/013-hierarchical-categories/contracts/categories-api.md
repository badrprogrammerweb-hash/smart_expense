# Contract: Categories API (supersedes Phase 3's flat-list contract)

Resolves FR-001–FR-002, FR-005–FR-014, FR-021. Every endpoint requires the
session validation described in
`../../002-auth-workspace-foundation/contracts/session-validation.md`
(missing/invalid token → `401`; caller not a member of `{workspace_id}` →
`404`), and operates on `{workspace_id}` paths.

## `GET /workspaces/{workspace_id}/categories`

Lists categories for one tree, nested one level deep. Any role, including
Viewer, may call this.

**Query parameters**:

| Param | Default | Notes |
|---|---|---|
| `category_type` | *required* | `income` or `expense` |
| `include_archived` | `true` | `false` returns only categories/subcategories that are currently selectable (both the item and, for subcategories, its parent must be active — research.md Decision 5) |

**Response** `200 OK`:

```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Restaurants",
      "translation_key": "restaurants",
      "is_system": true,
      "sort_order": 0,
      "is_archived": false,
      "subcategories": [
        { "id": "uuid", "name": "Dining Out", "translation_key": "restaurants.dining_out", "is_system": true, "sort_order": 0, "is_archived": false },
        { "id": "uuid", "name": "Cafes & Coffee", "translation_key": "restaurants.cafes_coffee", "is_system": true, "sort_order": 1, "is_archived": false }
      ]
    },
    { "id": "uuid", "name": "Other", "translation_key": "other", "is_system": true, "sort_order": 14, "is_archived": false, "subcategories": [] }
  ]
}
```

`translation_key` is `null` for user-created categories/subcategories
(FR-006) — the frontend falls back to `name` in that case. Every workspace
has the full default catalog immediately after creation (data-model.md
"Default catalog"), and every pre-existing workspace receives it via the
one-time migration backfill (FR-015a).

## `POST /workspaces/{workspace_id}/categories`

Creates a main category or a subcategory (FR-007). Caller must be Owner or
Admin.

**Request** (main category):

```json
{ "category_type": "expense", "name": "Pets" }
```

**Request** (subcategory — `category_type` is derived from the parent and
must not be sent, or must match if sent):

```json
{ "parent_id": "uuid-of-a-main-category", "name": "Grooming" }
```

The new row is appended after the current highest `sort_order` among its
siblings (same `category_type` + `parent_id IS NULL` for a main category;
same `parent_id` for a subcategory).

**Response** `201 Created`: same item shape as `GET`, `is_system: false`,
`translation_key: null`.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` |
| `name` is empty | `422` | `invalid_name` |
| `parent_id` doesn't exist in this workspace, or points to a row that already has a `parent_id` (would create depth 3) | `422` | `invalid_parent_category` (FR-002) |
| `name` duplicates an active sibling at the same level (FR-012) | `409` | `duplicate_category_name` |

## `PATCH /workspaces/{workspace_id}/categories/{category_id}`

Renames and/or archives/unarchives a category or subcategory (FR-008,
FR-009), including system-provided ones. Caller must be Owner or Admin.

**Request** (all fields optional, at least one required):

```json
{ "name": "Pet Care", "is_archived": true }
```

**Response** `200 OK`: same item shape as `GET`.

Archiving a main category does not archive its subcategories' own
`is_archived` column; it hides all of them from selection until the main
category is re-enabled (FR-009, research.md Decision 5). Renaming a
system-provided category clears nothing — `translation_key` is left
untouched, so the frontend continues preferring the translated name unless
this rename is itself meant to diverge from the system default; the
returned `name` reflects the new literal value immediately for any
consumer that ignores `translation_key`. Historical records referencing
this category are unaffected and immediately show the new display (FR-008,
FR-010).

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` |
| `category_id` doesn't exist in this workspace | `404` | `not_found` |
| New `name` is empty | `422` | `invalid_name` |
| New `name` duplicates another active sibling (FR-012) | `409` | `duplicate_category_name` |

## `PUT /workspaces/{workspace_id}/categories/order`

Reorders siblings at one level (FR-011). Caller must be Owner or Admin.

**Request**: the complete, ordered list of sibling IDs at one level —
either every main category of one `category_type`, or every subcategory
under one `parent_id`:

```json
{ "category_type": "expense", "parent_id": null, "category_ids": ["uuid-1", "uuid-2", "..."] }
```

```json
{ "parent_id": "uuid-of-a-main-category", "category_ids": ["uuid-1", "uuid-2"] }
```

**Response** `200 OK`: the full tree for that `category_type` (same shape
as `GET`), in the new order.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` |
| `category_ids` doesn't exactly match the current sibling set at the specified level (missing, extra, or duplicated IDs) | `422` | `invalid_order` |

## `DELETE /workspaces/{workspace_id}/categories/{category_id}`

Permanently removes a category or subcategory that has zero historical
references (FR-014). Caller must be Owner or Admin. This is a safety valve
for cleaning up an unused mistake, not the primary retirement path —
disabling (`PATCH` with `is_archived: true`) remains the supported way to
retire a category/subcategory that has already been used.

**Response** `204 No Content`.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member or Viewer | `403` | `forbidden` |
| `category_id` doesn't exist in this workspace | `404` | `not_found` |
| Referenced by at least one income/expense record, or (main category) still has a child subcategory | `409` | `category_has_references` |

## Out of scope for this phase

No bulk import/export of category trees. No per-user category
customization — categories remain a single shared, ordered structure per
workspace and per tree (income/expense). No deeper nesting than one
subcategory level (FR-002).
