# Contract: Dashboard API

Resolves FR-001 through FR-016 (all Phase 4 functional requirements).

Every request requires the session validation described in
`../../002-auth-workspace-foundation/contracts/session-validation.md`:
missing or invalid token → `401`; caller authenticated but not a member
of `{workspace_id}` → `404 not_found` (no workspace existence leak, per
established Phase 2/3 convention).

All amounts in responses are integers in minor currency units (halalas) —
`500000` means SAR 5,000.00. `currency` is always `"SAR"` this phase.

## `GET /workspaces/{workspace_id}/dashboard`

Returns the full financial snapshot for a workspace in a single combined
response (FR-002, Clarification 2). All roles — Owner, Admin, Member, and
Viewer — may call this endpoint (FR-012).

### Query Parameters

| Parameter | Type | Default | Constraints |
|---|---|---|---|
| `recent_limit` | integer | `5` | Min `1`, max `50`. Values outside this range return `422 invalid_limit`. |

### Response `200 OK`

```json
{
  "workspace_id": "a1b2c3d4-...",
  "period": {
    "start": "2026-06-01",
    "end": "2026-06-30"
  },
  "summary": {
    "total_income_minor": 500000,
    "total_expenses_minor": 180000,
    "remaining_balance_minor": 320000,
    "currency": "SAR"
  },
  "category_breakdown": [
    {
      "category_id": "uuid",
      "category_name": "Rent",
      "total_minor": 120000,
      "currency": "SAR"
    },
    {
      "category_id": "uuid",
      "category_name": "Groceries",
      "total_minor": 45000,
      "currency": "SAR"
    },
    {
      "category_id": null,
      "category_name": "Uncategorized",
      "total_minor": 15000,
      "currency": "SAR"
    }
  ],
  "recent_records": [
    {
      "type": "expense",
      "id": "uuid",
      "amount_minor": 4500,
      "currency": "SAR",
      "occurred_on": "2026-06-25",
      "description": "Lunch",
      "merchant_name": "Al Baik",
      "category_id": "uuid"
    },
    {
      "type": "income",
      "id": "uuid",
      "amount_minor": 500000,
      "currency": "SAR",
      "occurred_on": "2026-06-01",
      "description": "Monthly salary",
      "merchant_name": null,
      "category_id": null
    }
  ],
  "pending_ai_count": 0
}
```

### Field notes

- `period.start` / `period.end` — first and last calendar day of the
  current month as determined by UTC+3 (Saudi Arabia local time, fixed
  offset). Not a filter the caller sets; displayed so the frontend can
  label the period correctly.

- `summary.remaining_balance_minor` — `total_income_minor −
  total_expenses_minor`. May be negative when expenses exceed income; the
  raw signed integer is returned without clamping (Clarification 4). The
  frontend derives any "overspent" highlight from the sign.

- `category_breakdown` — only categories with at least one confirmed
  expense in the current period appear. Ordered by `total_minor`
  descending. Uncategorised expenses (`category_id: null`) appear as a
  single entry with `category_name: "Uncategorized"`. If there are no
  confirmed expenses at all, the array is empty.

- `recent_records` — up to `recent_limit` confirmed records (both income
  and expense) from the current period, ordered by `occurred_on DESC`,
  tie-broken by `created_at DESC`. Includes only confirmed records; draft
  or deleted records never appear. If no confirmed records exist, the
  array is empty.

- `pending_ai_count` — count of AI extraction jobs awaiting user review.
  Always `0` this phase; Phase 8 replaces the underlying query.

### Errors

| Condition | Status | `error.code` |
|---|---|---|
| Missing or invalid `Authorization` token | `401` | `unauthorized` |
| Caller not a member of `{workspace_id}` | `404` | `not_found` |
| `recent_limit` not an integer, or outside `[1, 50]` | `422` | `invalid_limit` |

### Behaviour rules

- All totals and the category breakdown include only records with
  `status = 'confirmed'`. Draft, pending, failed, cancelled, and deleted
  records are excluded from every field in this response (FR-003, SC-005).

- Dashboard data is calculated fresh on every request; no server-side
  cache is maintained (spec Assumption 8). The next request after a
  record is created, edited, or deleted will reflect the change (SC-003,
  FR-014).

- Financial data from other workspaces never appears in this response.
  The aggregation queries are scoped to `workspace_id` and run under RLS
  using the caller's session (FR-013, SC-006).

- The calculation logic that produces `total_income_minor`,
  `total_expenses_minor`, `remaining_balance_minor`, and
  `category_breakdown` is the same shared implementation that Phase 9
  report endpoints will use (FR-015).

## Out of scope for this phase

No period selection parameter (current month only). No year-to-date or
custom date-range variant. No POST / PATCH / DELETE on the dashboard
resource. No trend data or historical comparison. No merchant-total
grouping (Phase 9 reports). No caching or ETag/conditional-request support.
