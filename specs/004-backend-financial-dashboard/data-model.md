# Phase 4 Data Model: Backend Financial Calculations and Dashboard Data

No new database tables or migrations are introduced this phase. All data
is read from the `incomes`, `expenses`, and `categories` tables Phase 3
created. This file documents the API response entities (shapes returned
by the dashboard endpoint) and the key aggregation queries that produce
them.

## Response Entities

### DashboardData (root response object)

The single combined response returned by
`GET /workspaces/{workspace_id}/dashboard`.

| Field | Type | Notes |
|---|---|---|
| `workspace_id` | uuid | The requested workspace |
| `period` | object | `{ start: date, end: date }` — current calendar month in UTC+3 |
| `summary` | FinancialSummary | Confirmed income total, expense total, and balance |
| `category_breakdown` | CategoryBreakdownItem[] | Per-category confirmed expense totals |
| `recent_records` | RecentRecord[] | Most recent confirmed income + expense records |
| `pending_ai_count` | integer | Count of AI extraction jobs awaiting review (0 until Phase 8) |

### FinancialSummary

| Field | Type | Notes |
|---|---|---|
| `total_income_minor` | integer | `COALESCE(SUM(incomes.amount_minor), 0)` for confirmed rows in period |
| `total_expenses_minor` | integer | `COALESCE(SUM(expenses.amount_minor), 0)` for confirmed rows in period |
| `remaining_balance_minor` | integer | `total_income_minor − total_expenses_minor`; may be negative (Clarification 4) |
| `currency` | string | Always `"SAR"` this phase |

`remaining_balance_minor` is computed in Python, not in SQL, to keep the
formula visible in `services/dashboard.py` for FR-015 reuse (research.md
Decision 2).

### CategoryBreakdownItem

| Field | Type | Notes |
|---|---|---|
| `category_id` | uuid or null | `null` for the uncategorised group (research.md Decision 6) |
| `category_name` | string | Category display name, or `"Uncategorized"` when `category_id` is null |
| `total_minor` | integer | `SUM(expenses.amount_minor)` for confirmed rows in period with this category |
| `currency` | string | Always `"SAR"` this phase |

The breakdown includes every category that has at least one confirmed
expense in the current period, plus one entry for uncategorised expenses
if any exist. Categories with zero confirmed expenses in the period are
omitted. The list is ordered by `total_minor` descending.

### RecentRecord

| Field | Type | Notes |
|---|---|---|
| `type` | string | `"income"` or `"expense"` |
| `id` | uuid | Record identifier |
| `amount_minor` | integer | Amount in halalas |
| `currency` | string | Always `"SAR"` |
| `occurred_on` | date | The date the transaction occurred |
| `description` | string or null | Optional free text |
| `merchant_name` | string or null | For expenses only; always `null` for income records |
| `category_id` | uuid or null | For expenses only; always `null` for income records |

Records are ordered by `occurred_on DESC`, with `created_at DESC` as a
tie-breaker for records on the same date. The list is scoped to the
current calendar month and capped by the `recent_limit` query parameter
(default 5, max 50 — research.md Decision 4).

## Key Aggregation Queries

The queries below are expressed as SQL for documentation clarity. In the
implementation they are parameterised SQLAlchemy `text()` or Core
expressions using named bind parameters.

### Income total

```sql
SELECT COALESCE(SUM(amount_minor), 0) AS total_income_minor
FROM incomes
WHERE workspace_id = :workspace_id
  AND status = 'confirmed'
  AND occurred_on BETWEEN :period_start AND :period_end
```

### Expense total

```sql
SELECT COALESCE(SUM(amount_minor), 0) AS total_expenses_minor
FROM expenses
WHERE workspace_id = :workspace_id
  AND status = 'confirmed'
  AND occurred_on BETWEEN :period_start AND :period_end
```

### Category breakdown

```sql
SELECT
    e.category_id,
    COALESCE(c.name, 'Uncategorized') AS category_name,
    SUM(e.amount_minor) AS total_minor
FROM expenses e
LEFT JOIN categories c ON c.id = e.category_id
WHERE e.workspace_id = :workspace_id
  AND e.status = 'confirmed'
  AND e.occurred_on BETWEEN :period_start AND :period_end
GROUP BY e.category_id, c.name
ORDER BY total_minor DESC
```

### Recent records

```sql
SELECT 'income' AS type,
       id, amount_minor, currency, occurred_on, description,
       NULL  AS merchant_name,
       NULL  AS category_id,
       created_at
FROM incomes
WHERE workspace_id = :workspace_id
  AND status = 'confirmed'
  AND occurred_on BETWEEN :period_start AND :period_end

UNION ALL

SELECT 'expense' AS type,
       id, amount_minor, currency, occurred_on, description,
       merchant_name,
       category_id,
       created_at
FROM expenses
WHERE workspace_id = :workspace_id
  AND status = 'confirmed'
  AND occurred_on BETWEEN :period_start AND :period_end

ORDER BY occurred_on DESC, created_at DESC
LIMIT :recent_limit
```

## Period boundary calculation

The period parameters above are computed in Python before being passed
to SQL (research.md Decision 1):

```python
import calendar
from datetime import datetime, timezone, timedelta

tz_utc3 = timezone(timedelta(hours=3))
now_local = datetime.now(tz_utc3)
period_start = now_local.date().replace(day=1)
last_day = calendar.monthrange(period_start.year, period_start.month)[1]
period_end = period_start.replace(day=last_day)
```

## Out of scope for this phase

No new tables, views, functions, or migrations. No `ai_extraction_jobs`
query (Phase 8). No custom period filtering beyond the current month
(Phase 9 reports). No caching layer (post-MVP). No aggregation for
previous periods or trend data.
