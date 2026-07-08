# Contract: Reports & AI Summary API

FastAPI endpoints under the existing `/workspaces/{workspace_id}` prefix, following
the Phase 4–8 route→service→schema conventions, auth via `get_current_user`, DB via
`get_rls_session`, and the standard `{ "code", "message" }` error envelope.

All figures are **confirmed-only** and reconcile with the dashboard (SC-001).

---

## GET `/workspaces/{workspace_id}/reports`

Return the full period-scoped report. Viewable by **all roles** including Viewer
(FR-031, non-AI surface).

**Query params**
| Param | Type | Rules |
|-------|------|-------|
| `period` | enum `current_month` \| `previous_month` \| `custom` | default `current_month` |
| `start` | date (ISO) | required iff `period=custom` |
| `end` | date (ISO) | required iff `period=custom` |

**Period resolution & validation (FR-002, FR-012)**
- `current_month` → `dashboard.get_current_period()` (UTC+3).
- `previous_month` → the calendar month before `current_month`.
- `custom` → `[start, end]`; **reject** `end < start` (422 `invalid_period`) and any
  span `> 366 days` (422 `range_too_large`).

**Responses**
- `200` → `ReportData` (see data-model.md): `workspace_id`, `period`, `summary`
  (reused `FinancialSummary`), `category_breakdown`, `spending_trend`,
  `top_merchants`, `recent_records`, `team_activity`, `pending_review_count`,
  `spending_summary`.
- `404 not_found` → caller is not a member of the workspace (mirrors dashboard's
  `_workspace_role` behavior; do not reveal existence).
- `401` → unauthenticated.
- `503 database_unavailable` → DB error (reuse `database_unavailable_exception`).

**Invariants**
- `summary.*` MUST equal the dashboard's values for an equivalent period (reuse the
  same service functions — SC-001).
- `spending_trend` granularity = `day` when span ≤ 31 days else `month` (FR-009);
  each point's `remaining_minor` = bucket income − bucket expense (period-net,
  Decision 3).
- `top_merchants` excludes null/blank `merchant_name`; top 5 by `total_minor`
  (FR-008).
- Empty period → all lists empty, all totals `0`; **200, not an error** (SC-009).
- All money fields are integer minor units; currency SAR.

---

## POST `/workspaces/{workspace_id}/reports/ai-summary`

Generate an on-demand AI spending summary. **Owner/Admin/Member only** (FR-031);
Viewer receives `403`. BYOK-gated (FR-026).

**Body** → `AiSummaryRequest`: same period fields as the reports GET (`period`,
optional `start`/`end`), plus `locale` (`en` \| `ar`).

**Behavior (Decision 11)**
1. Resolve & validate the period (same rules as GET).
2. Authorize: role ∈ {owner, admin, member} else `403 not_authorized`.
3. Fetch the key via the Phase 8 `get_workspace_ai_key_for_extraction` RPC.
   - Zero rows → `409 ai_not_configured` (UI simply does not offer the action).
4. Compute the confirmed aggregates (reuse the reports service) and send **aggregates
   only, never raw transaction rows** to the provider via
   `ai_providers.summarize_spending(provider, api_key, aggregates, locale)`.
5. Return the text.

**Responses**
- `200` → `AiSummaryResponse` `{ locale, text }` — plain language, no financial
  advice, workspace-confirmed data only (FR-027, FR-028).
- `403 not_authorized` → Viewer or non-member.
- `409 ai_not_configured` → no BYOK key.
- `502 ai_provider_error` / `400 ai_key_invalid` → safe, non-technical message
  (FR-029, SC-008); the rest of the reports page is unaffected.
- `422 invalid_period` / `range_too_large` → as GET.

**Security invariants (reuse Phase 8 guarantees)**
- The decrypted key exists only in backend memory for the single call; it is NEVER
  logged, returned, or persisted (constitution VI; Phase 8 secrecy test pattern).
- The provider payload contains only aggregated confirmed figures — no raw rows, no
  secrets.
