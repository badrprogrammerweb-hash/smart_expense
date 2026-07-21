# Contract: Reports category breakdown (delta + new drill-down endpoint)

Resolves FR-016–FR-017. Extends
`../../009-reports-summaries-history/contracts/` (dashboard and reports
endpoints) — routes, auth, and period-selection query params are
unchanged.

## `GET /workspaces/{workspace_id}/dashboard` and `GET /workspaces/{workspace_id}/reports` (existing routes)

`category_breakdown` (already present) now groups by **resolved main
category** — a confirmed expense whose `category_id` points at a
subcategory is attributed to that subcategory's parent, not listed
separately (research.md Decision 10). `category_id` in each item is
therefore always a main-category id (or `null` for uncategorized, as
today).

`reports` responses gain a new field, `income_category_breakdown`, same
item shape as `category_breakdown`, computed identically but over
confirmed income records grouped by their resolved main income category.
`category_breakdown` itself continues to reflect expenses only (unchanged
meaning from Phase 9).

```json
{
  "category_breakdown": [
    { "category_id": "uuid-of-restaurants", "category_name": "Restaurants", "total_minor": 125000, "currency": "SAR" }
  ],
  "income_category_breakdown": [
    { "category_id": "uuid-of-salary", "category_name": "Salary", "total_minor": 1200000, "currency": "SAR" }
  ]
}
```

Amounts referencing a category or subcategory that is now disabled or
renamed are still included in these totals, shown under the category's
current name (FR-017) — the underlying query is a live join, not a
snapshot.

## `GET /workspaces/{workspace_id}/reports/category-breakdown/{main_category_id}/subcategories` (new)

Drills into one main category's subcategory split for the same reporting
period (FR-016). Accepts the same period query parameters
(`preset`/`start`/`end`) as the existing `reports` endpoint. Any role may
call this (matches existing reports read access).

**Response** `200 OK`:

```json
{
  "main_category_id": "uuid-of-restaurants",
  "main_category_name": "Restaurants",
  "subcategory_breakdown": [
    { "subcategory_id": "uuid-of-dining-out", "subcategory_name": "Dining Out", "total_minor": 80000, "currency": "SAR" },
    { "subcategory_id": null, "subcategory_name": "No subcategory", "total_minor": 45000, "currency": "SAR" }
  ]
}
```

The `subcategory_id: null` row aggregates confirmed records whose
`category_id` points directly at `main_category_id` itself (no
subcategory chosen) — it is always present when such records exist in the
period, never silently dropped (FR-016, spec User Story 3 Acceptance
Scenario 4).

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| `main_category_id` doesn't exist in this workspace, or is itself a subcategory (has a `parent_id`) | `404` | `not_found` |
| Invalid period params | `422` | (unchanged from existing `reports` endpoint) |

This endpoint works identically for an `income`-type `main_category_id` —
the response resolves the record type from the category row itself, so no
separate income-specific route is needed.
