# Phase 1 Data Model: Reports, Summaries, and History

This phase introduces **one** new persisted entity (`activity_history`). Everything
else in the feature — reports, the plain-language summary, the team activity summary,
the pending review summary, and the AI summary — is **computed on demand** from
existing confirmed records and is not stored (FR-034, no snapshots). Those computed
shapes are documented here as response contracts, not tables.

The DDL, trigger functions, RLS policies, grants, and indexes live in
[contracts/history-schema.md](./contracts/history-schema.md). This document is the
conceptual model and the authoritative event-type mapping.

---

## Persisted entity: `public.activity_history`

A lightweight, append-only, workspace-scoped log of tracked events. **Not** an
audit-grade / immutable-compliance / diff-versioning / ledger system (constitution
XII, FR-023).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK, default `gen_random_uuid()` | |
| `workspace_id` | `uuid` NOT NULL → `public.workspaces(id)` on delete cascade | Every entry belongs to exactly one workspace (FR-025). |
| `event_type` | `text` NOT NULL, CHECK in the enumerated set below | The tracked event (FR-019). |
| `actor_user_id` | `uuid` NULL → `public.user_profiles(id)` on delete set null | Who did it, captured as `auth.uid()` at trigger time (FR-020). Nullable so a later user deletion does not erase history. |
| `entity_table` | `text` NOT NULL | Source table name (e.g. `expenses`), for the entity reference (FR-020). |
| `entity_id` | `uuid` NULL | Affected row id (nullable for events without a single row id). |
| `summary` | `jsonb` NOT NULL default `'{}'` | Minimal, non-sensitive context for display (e.g. `{"amount_minor":1500,"merchant_name":"…"}` or `{"old_role":"member","new_role":"admin"}`). MUST NOT contain secrets, API keys, or decrypted values (constitution VI). |
| `created_at` | `timestamptz` NOT NULL default `now()` | Event time; ordering key (FR-024). |

**Behavioral rules**
- **Append-only**: no `UPDATE`/`DELETE` policy is granted; there is no application or
  RLS path to modify or remove an entry (FR-023, lightweight — enforced by absence of
  write policies, not by heavyweight immutability machinery).
- **Forward-only**: rows are created only by triggers on new mutations from this
  migration onward; no backfill (FR-022).
- **Synchronous/atomic**: written inside the mutating transaction by the trigger
  (FR-021); rolls back with the mutation.
- **Retention**: all forward events retained, no automatic purge in the MVP (FR-024a).

**Indexes**
- `(workspace_id, created_at desc, id desc)` — powers the newest-first, keyset-
  paginated read (FR-024; Decision 9).

**RLS / grants** (detail in the schema contract)
- `select`: only Owner/Admin members of `workspace_id` (FR-032), via the existing
  `public.workspace_role_for(workspace_id, auth.uid())` helper.
- `insert`: performed by the `SECURITY DEFINER` trigger function only; no direct
  `insert`/`update`/`delete` grant to `authenticated`/`anon`.

---

## Event-type vocabulary and trigger mapping (authoritative)

One `SECURITY DEFINER` trigger function inspects `TG_TABLE_NAME`, `TG_OP`, and the
OLD/NEW row to derive `event_type`. Triggers fire **only on meaningful changes** — a
plain `updated_at` bump with no other column change produces **no** entry.

| Source table | Trigger condition | `event_type` |
|--------------|-------------------|--------------|
| `incomes` | INSERT | `income_created` |
| `incomes` | UPDATE, `status` → `'deleted'` | `income_deleted` |
| `incomes` | UPDATE, other meaningful change | `income_updated` |
| `expenses` | INSERT | `expense_created` |
| `expenses` | UPDATE, `status` → `'deleted'` | `expense_deleted` |
| `expenses` | UPDATE, other meaningful change | `expense_updated` |
| `categories` | INSERT | `category_created` |
| `categories` | UPDATE, `is_archived` false → true | `category_archived` |
| `categories` | UPDATE, other meaningful change | `category_updated` |
| `files` | INSERT | `file_uploaded` |
| `files` | UPDATE, `status` → deleted/removed, or DELETE | `file_deleted` |
| `ai_extractions` | INSERT (status `processing`) | `extraction_started` |
| `ai_extractions` | UPDATE, status → `ready_for_review` | `extraction_completed` |
| `ai_extractions` | UPDATE, status → `failed` | `extraction_failed` |
| `ai_extractions` | UPDATE, status → `confirmed` | `ai_draft_confirmed` |
| `workspace_memberships` | INSERT | `member_added` |
| `workspace_memberships` | DELETE | `member_removed` |
| `workspace_memberships` | UPDATE, `role` changed | `role_changed` |
| `workspaces` | UPDATE, `auto_delete_after_extraction` changed | `setting_changed` |
| `workspace_ai_settings` | INSERT/UPDATE/DELETE (provider/key configured, replaced, cleared) | `setting_changed` |

Notes:
- `ai_extractions` `discarded` is intentionally **not** a tracked event in the MVP
  (spec lists confirm, not discard); revisit only if explicitly specified later.
- The exact "meaningful change" column set per table is enumerated in the schema
  contract so `*_updated` does not fire on bookkeeping-only column changes.
- The `event_type` CHECK constraint lists exactly the values above; the backend
  `ActivityEventType` enum mirrors it.
- **Codex risk**: the `ai_extractions` mapping depends on the committed status
  vocabulary; reconcile against the tracked migration before applying (see research
  Decision 7).

---

## Computed response shapes (not persisted)

### `ReportData` (GET reports response)

| Field | Type | Source |
|-------|------|--------|
| `workspace_id` | uuid | request |
| `period` | `{ preset?: 'current_month'\|'previous_month', start: date, end: date }` | parsed & validated (FR-002, FR-012) |
| `summary` | `FinancialSummary` | **reused** dashboard shape: `total_income_minor`, `total_expenses_minor`, `remaining_balance_minor` (= income − expenses, period-net) |
| `category_breakdown` | `CategoryBreakdownItem[]` | **reused** `dashboard.get_category_breakdown` (Uncategorized bucket preserved) |
| `spending_trend` | `TrendPoint[]` | NEW `get_spending_trend`; `TrendPoint = { bucket: date, granularity: 'day'\|'month', income_minor, expense_minor, remaining_minor }` (daily ≤31d else monthly) |
| `top_merchants` | `MerchantTotal[]` | NEW `get_top_merchants`; `{ merchant_name, total_minor, count }`, blanks excluded, top 5 |
| `recent_records` | `RecentRecord[]` | **reused** `dashboard.get_recent_records` (combined income+expense recent activity; the spec's "recent expenses" is realized via this existing combined list) |
| `team_activity` | `TeamActivityItem[]` | NEW `get_team_activity`; `{ user_id, display_name?, records_created }` per member for the period |
| `pending_review_count` | int | **reused** `dashboard.get_pending_ai_count` (consistent with dashboard, FR-017) |
| `spending_summary` | `SpendingSummary` | NEW structured inputs for the plain-language summary |

### `SpendingSummary` (structured; localized on the frontend)

`{ total_income_minor, total_expenses_minor, remaining_balance_minor,
top_category: { category_id?, category_name, total_minor } | null,
trend_direction: 'up' | 'down' | 'flat' }` — `trend_direction` compares this period's
total expenses to the previous comparable period (FR-013, FR-014). Currency is always
SAR; all values are integer minor units.

### `HistoryPage` (GET history response)

`{ items: ActivityHistoryItem[], next_before: timestamptz | null }` where
`ActivityHistoryItem = { id, event_type, actor_user_id, actor_display_name?,
entity_table, entity_id, summary, created_at }`, newest-first, page size 50 (keyset
on `created_at`/`id`). Owner/Admin only (FR-024, FR-032).

### `AiSummaryResponse` / `AiSummaryFailure` (POST ai-summary)

Success: `{ locale, text }` — plain-language, no financial advice, derived only from
confirmed aggregates (FR-027, FR-028). Failure: `{ code, message }` with a safe,
non-technical message (FR-029). Absent entirely (endpoint returns a
`ai_not_configured` code, or the UI never offers the action) when BYOK is not set
(FR-026).

---

## Relationships & isolation

- `activity_history.workspace_id` → `workspaces.id` (the single tenancy anchor);
  RLS and every query filter on it (constitution VII).
- `activity_history.actor_user_id` → `user_profiles.id` (nullable; set null on user
  delete so history survives).
- `entity_id` is a soft reference (no FK) because it may point at rows in different
  tables and must survive the referenced row's later soft-deletion.
- No report/summary entity is persisted, so they hold no relationships; they read
  `incomes`, `expenses`, `categories`, and `ai_extractions` through the same
  confirmed-only filters the dashboard uses.
