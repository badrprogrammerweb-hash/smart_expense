# Contract: Income/Expense record category field (delta on existing endpoints)

Resolves FR-003, FR-004. Extends
`../../003-income-expense-category-core/contracts/incomes-api.md` and
`.../expenses-api.md` — endpoint routes, auth, and all other fields are
unchanged; only the `category_id` field's availability and validation
changes.

## `incomes` endpoints — new `category_id` field

`IncomeCreateRequest`, `IncomeUpdateRequest`, and the `Income` response now
all include `category_id: uuid | null` (mirroring the shape `expenses`
already has). Omitted or `null` means uncategorized (FR-004).

```json
{ "amount_minor": 500000, "occurred_on": "2026-07-21", "category_id": "uuid-of-a-salary-subcategory" }
```

**New errors** (same codes/shapes the `expenses` endpoints already return
for its `category_id`, now shared via `validate_category_assignment`):

| Condition | Status | `error.code` |
|---|---|---|
| `category_id` belongs to a different workspace | `422` | `category_not_in_workspace` |
| `category_id` refers to an `expense`-type category | `422` | `category_type_mismatch` |
| `category_id` (or its parent, if it is a subcategory) is archived | `422` | `category_archived` |

## `expenses` endpoints — unchanged field, extended validation

`category_id` keeps its existing shape and optionality. Its validation
trigger now additionally rejects an `income`-type category
(`category_type_mismatch`) and now also rejects a subcategory whose
**parent** is archived, not just a directly-archived category
(`category_archived` — previously only the category's own `is_archived`
was checked).

## Reading category context on a record

Neither `Income` nor `Expense` response bodies are expanded to include the
category's name, tree, or parent — clients already fetch the workspace's
category tree separately (`GET /workspaces/{workspace_id}/categories`) and
resolve `category_id` client-side, consistent with how `expenses` already
worked pre-Phase-13. A record's `category_id` may point at a main category
or at a subcategory row.
