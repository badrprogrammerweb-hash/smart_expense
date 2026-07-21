# Phase 13 Data Model: Hierarchical Categories

Builds on the Phase 3 `categories`/`incomes`/`expenses` tables
(`specs/003-income-expense-category-core/data-model.md`) and the Phase 12
`supported_currencies`/locale additions
(`specs/012-i18n-base-currency/data-model.md`). Every constraint below is
enforced at the database level (RLS policy, `CHECK` constraint, unique
index, or trigger), per this project's established pattern.

## categories (altered)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Unchanged |
| `workspace_id` | uuid, FK → `workspaces.id`, `ON DELETE CASCADE` | Unchanged |
| `category_type` | text, not null | **New.** `CHECK (category_type in ('income', 'expense'))`. Backfilled to `'expense'` for every pre-existing row (FR-015). |
| `parent_id` | uuid, nullable, FK → `categories.id`, `ON DELETE RESTRICT` | **New.** `null` = main category; non-null = subcategory. `ON DELETE RESTRICT` because a main category with children can only be removed via the delete-guard trigger (Decision 11), never implicitly. |
| `is_system` | boolean, not null, default `false` | **New.** `true` for seeded default rows (own name/hierarchy still editable — FR-008 — but see `translation_key`). |
| `translation_key` | text, nullable | **New.** Set only when `is_system = true`. Main-category key is a bare slug (e.g. `restaurants`); subcategory key is `<parent slug>.<sub slug>` (e.g. `restaurants.dining_out`). `null` for any user-created row. |
| `name` | text | Unchanged column; always holds a literal display string — canonical English name for system rows (fallback / history / non-i18n contexts), exact user input for user-created rows. `CHECK (length(btrim(name)) > 0)` unchanged. |
| `sort_order` | integer, not null | Unchanged meaning, now scoped per level: order among main categories sharing `(workspace_id, category_type)` where `parent_id is null`, or among subcategories sharing the same `parent_id`. |
| `is_archived` | boolean, not null, default `false` | Unchanged column; see "Effective availability" below for how a subcategory's own flag interacts with its parent's. |
| `created_at` / `updated_at` | timestamptz | Unchanged |

**Effective availability**: a subcategory is selectable for new records only
when both `subcategory.is_archived = false` AND `parent.is_archived =
false`. Disabling a main category never writes to its children's
`is_archived` column (research.md Decision 5).

**Hierarchy integrity** (`validate_category_hierarchy` trigger, `BEFORE
INSERT OR UPDATE OF parent_id, category_type`): if `new.parent_id` is not
null, the referenced row must exist, share `workspace_id`, share
`category_type`, and itself have `parent_id IS NULL` — raises
`invalid_parent_category` otherwise (research.md Decision 2).

**Uniqueness** (replaces the single Phase 3 index):

```sql
create unique index categories_unique_active_main_name
  on categories (workspace_id, category_type, lower(name))
  where parent_id is null and not is_archived;

create unique index categories_unique_active_sub_name
  on categories (workspace_id, parent_id, lower(name))
  where parent_id is not null and not is_archived;
```

**RLS**: `SELECT` unchanged (any workspace member). `INSERT`/`UPDATE`
unchanged (owner/admin only). **New** `DELETE` policy: owner/admin only,
additionally gated by the `prevent_referenced_category_delete` trigger
(research.md Decision 11), which raises `category_has_references` if the
row is referenced by any `incomes`/`expenses` record or still has any
child subcategory row — but only when the owning workspace still exists;
the guard is a no-op during a full workspace-cascade teardown (research.md
Decision 13), so it never blocks account/workspace deletion.

**Validation rules**: `name` non-empty; unique per Uniqueness above;
`category_type` one of `income`/`expense`; `parent_id`, if set, must point
to a same-workspace, same-type, top-level row.

**State transitions**: created (default/system-seeded or user-created) →
renamed any number of times → archived ⇄ unarchived (unlike Phase 3,
unarchive is now supported per FR-009) → optionally hard-deleted, only
while zero historical references and (for a main category) zero children
exist.

## incomes (altered)

| Field | Type | Notes |
|---|---|---|
| `category_id` | uuid, nullable, FK → `categories.id`, `ON DELETE RESTRICT` | **New column**, mirroring `expenses.category_id`. May reference a main category or a subcategory row where `categories.category_type = 'income'`. |

All other `incomes` columns are unchanged from Phase 3/Phase 12.

**New trigger** `validate_income_category` (`BEFORE INSERT OR UPDATE OF
category_id`): same shape as the existing `validate_expense_category`,
generalized via the shared `validate_category_assignment(category_id,
workspace_id, expected_type)` SQL function (research.md Decision 6);
`expected_type = 'income'`. Raises `category_not_in_workspace`,
`category_type_mismatch`, or `category_archived`.

## expenses (altered)

`category_id` (existing column, unchanged type/nullability) may now
reference a main category or a subcategory row where `categories.
category_type = 'expense'`. `validate_expense_category` is rewritten to
call the same shared `validate_category_assignment(...)` function with
`expected_type = 'expense'`, adding the type check and the
parent-archived check (previously only checked the category's own
`is_archived`).

## Default catalog (seed data — new workspaces and existing-workspace backfill, FR-005/FR-015a)

Every main category below is `is_system = true` with `translation_key` =
the slug shown; every subcategory's `translation_key` = `<main
slug>.<sub slug>`. All are seeded active (`is_archived = false`),
`sort_order` following listed order.

**Expense tree** (15 main categories, names unchanged from Phase 3/
Constitution Principle IV):

| Main category | slug | Subcategories (slug) |
|---|---|---|
| Restaurants | `restaurants` | Dining Out (`dining_out`), Cafes & Coffee (`cafes_coffee`), Delivery (`delivery`) |
| Groceries | `groceries` | Supermarket (`supermarket`), Bulk & Wholesale (`bulk_wholesale`) |
| Fuel | `fuel` | *(none)* |
| Transportation | `transportation` | Public Transit (`public_transit`), Ride-Hailing (`ride_hailing`), Parking & Tolls (`parking_tolls`), Vehicle Maintenance (`vehicle_maintenance`) |
| Rent | `rent` | *(none)* |
| Utilities | `utilities` | Electricity (`electricity`), Water (`water`), Gas (`gas`) |
| Internet & Mobile | `internet_mobile` | Internet (`internet`), Mobile Plan (`mobile_plan`) |
| Health | `health` | Doctor Visits (`doctor_visits`), Pharmacy (`pharmacy`), Insurance (`insurance`) |
| Education | `education` | Tuition (`tuition`), Books & Supplies (`books_supplies`), Courses (`courses`) |
| Family | `family` | Childcare (`childcare`), Household Help (`household_help`) |
| Shopping | `shopping` | Clothing (`clothing`), Electronics (`electronics`), Home Goods (`home_goods`) |
| Entertainment | `entertainment` | Movies & Events (`movies_events`), Hobbies (`hobbies`), Games & Apps (`games_apps`) |
| Travel | `travel` | Flights (`flights`), Hotels (`hotels`), Activities (`activities`) |
| Subscriptions | `subscriptions` | Streaming (`streaming`), Software (`software`), Memberships (`memberships`) |
| Other | `other` | *(none)* |

**Income tree** (new — 5 main categories):

| Main category | slug | Subcategories (slug) |
|---|---|---|
| Salary | `salary` | Primary Job (`primary_job`), Bonus & Commission (`bonus_commission`) |
| Business Income | `business_income` | Sales Revenue (`sales_revenue`), Services Revenue (`services_revenue`) |
| Gifts | `gifts` | *(none)* |
| Investment Returns | `investment_returns` | Dividends (`dividends`), Interest (`interest`) |
| Other Income | `other_income` | *(none)* |

**Existing-workspace backfill** (one-time, part of this phase's migration
— research.md Decision 8): for each existing workspace, (1) stamp
`is_system = true` + matching `translation_key` on any existing category
row whose `lower(name)` exactly matches one of the 15 expense main-category
names above; (2) insert the missing default subcategories under whichever
row now carries the matching main-category `translation_key`; (3) insert
the entire income tree fresh (no existing income categories exist to
reconcile against).

## ExtractionDraft (altered — `apps/api/app/schemas/extractions.py`)

| Field | Type | Notes |
|---|---|---|
| `suggested_category` | `str \| None` | Unchanged — raw AI text, kept as a non-authoritative fallback display value. |
| `suggested_category_id` | `UUID \| None` | **New.** Set only when the AI's chosen name(s) exactly match (case-insensitive) an entry in the workspace's *active* catalog snapshot passed into the prompt (research.md Decision 9). May resolve to a main category or a subcategory id. |

`ConfirmExtractionRequest.category_id` is unchanged in shape; it already
accepts any category id (main or sub) the user confirms, superseding the
suggestion.

## Report schemas (altered — `apps/api/app/schemas/dashboard.py`,
`apps/api/app/schemas/reports.py`)

`CategoryBreakdownItem` (existing shape, unchanged fields) now represents
one **main category's** total — `category_id` is always the resolved main
category id (`coalesce(c.parent_id, c.id)`), never a subcategory id, per
research.md Decision 10.

New: `SubcategoryBreakdownItem`:

| Field | Type | Notes |
|---|---|---|
| `subcategory_id` | `UUID \| None` | `null` = the explicit "no subcategory" bucket (FR-016). |
| `subcategory_name` | `str` | Localized "No subcategory" bucket label when `subcategory_id` is null, matching existing `'Uncategorized'` bucket convention. |
| `total_minor` | `int` | |
| `currency` | `Currency` | |

`ReportData` gains `income_category_breakdown: list[CategoryBreakdownItem]`
alongside the existing (expense-focused) `category_breakdown` field, since
income and expense are separate trees (research.md Decision 10).

## activity_history (altered — history tracking for the new delete capability)

`public.activity_history.event_type`'s `CHECK` constraint gains
`'category_deleted'`; `apps/api/app/schemas/history.py`'s `ActivityEventType`
gains `CATEGORY_DELETED = "category_deleted"`. The `public.record_activity()`
trigger's `categories` branch gains a `tg_op = 'DELETE'` check (evaluated
first, before the archive/update checks) that emits this new event type —
without it, the hard-delete introduced by FR-014 would silently produce no
history row (research.md Decision 12).

## Key relationships summary

```text
workspaces 1───* categories (category_type, parent_id self-FK, depth ≤ 2)
categories 1───* categories        (parent_id; children have parent_id = null themselves)
categories 1───* incomes            (category_id, nullable, category_type must = 'income')
categories 1───* expenses           (category_id, nullable, category_type must = 'expense')
```
