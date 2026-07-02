# Contract: Frontend → Existing Backend API Consumption

This phase introduces **zero** new backend endpoints, request shapes, or
response shapes. This document is the Phase 1 "contract" for a
frontend-only phase: it maps every screen to the exact already-implemented,
already-tested endpoint(s) it calls, so task generation and implementation
can't silently invent a new backend shape. Every endpoint below is defined
in full (auth, request/response, errors) in the linked contract file —
this document does not repeat those details, only which screen uses which
call and any frontend-specific handling.

All calls attach `Authorization: Bearer <supabase-access-token>` via
`lib/api/client.ts`, per
`../../002-auth-workspace-foundation/contracts/session-validation.md`. A
`401` anywhere redirects to `/[locale]/sign-in`; a `404` on a workspace-
scoped call means the caller is not a member (redirect to the workspace
selector, never render a "workspace not found" leak per that contract's
own no-existence-leak rule).

## Authentication (US1)

Not a FastAPI contract — handled entirely by Supabase Auth via
`@supabase/supabase-js` / `@supabase/ssr` (research.md Decision 3):

| Screen action | Supabase Auth call |
|---|---|
| Sign up | `supabase.auth.signUp({ email, password })` |
| Sign in | `supabase.auth.signInWithPassword({ email, password })` |
| Sign out | `supabase.auth.signOut()` |
| Password reset request | `supabase.auth.resetPasswordForEmail(email)` |

## Workspace selector & new-workspace (US4)

| Screen action | Endpoint | Contract |
|---|---|---|
| List workspaces (selector) | `GET /workspaces` | `../../002-auth-workspace-foundation/contracts/workspaces-api.md` |
| Create team workspace | `POST /workspaces` | same |
| Workspace shell role/member-count | `GET /workspaces/{workspace_id}` | same |

`GET /workspaces` already returns the caller's own `role` per workspace
(FR-006/FR-021/FR-035) — the frontend does not need a separate
"who am I in this workspace" call.

## Dashboard (US1)

| Screen action | Endpoint | Contract |
|---|---|---|
| Load dashboard | `GET /workspaces/{workspace_id}/dashboard` | `../../004-backend-financial-dashboard/contracts/dashboard-api.md` |

Uses the default `recent_limit` (5) on the dashboard screen itself (FR-012);
the income/expense history screens use the raw list endpoints below, not
this endpoint's `recent_records`, to satisfy FR-022 (browsing beyond
"recent").

## Income (US2)

| Screen action | Endpoint | Contract |
|---|---|---|
| History list | `GET /workspaces/{workspace_id}/incomes` | `../../003-income-expense-category-core/contracts/incomes-api.md` |
| Create | `POST /workspaces/{workspace_id}/incomes` | same |
| View one (edit form prefill) | `GET /workspaces/{workspace_id}/incomes/{income_id}` | same |
| Edit | `PATCH /workspaces/{workspace_id}/incomes/{income_id}` | same |
| Delete | `DELETE /workspaces/{workspace_id}/incomes/{income_id}` | same |

Create/edit/delete actions are only rendered for Owner/Admin (permission
matrix, `data-model.md`); a Member/Viewer never sees them, matching that
the backend has no "own income" carve-out at all.

## Expense (US2)

| Screen action | Endpoint | Contract |
|---|---|---|
| History list | `GET /workspaces/{workspace_id}/expenses` | `../../003-income-expense-category-core/contracts/expenses-api.md` |
| Create | `POST /workspaces/{workspace_id}/expenses` | same |
| View one (edit form prefill) | `GET /workspaces/{workspace_id}/expenses/{expense_id}` | same |
| Edit | `PATCH /workspaces/{workspace_id}/expenses/{expense_id}` | same |
| Delete | `DELETE /workspaces/{workspace_id}/expenses/{expense_id}` | same |

Edit/delete are rendered per the two-part rule in `data-model.md`
(Owner/Admin: any expense; Member: only their own — `created_by` match;
Viewer: never). The category picker on the create/edit form shares its
`useCategories` cache entry with `ExpenseHistoryList`'s
`GET /workspaces/{workspace_id}/categories?include_archived=true` fetch
(same query key) rather than issuing a second, near-duplicate
`include_archived=false` request, then filters archived categories out of
the *selectable* options client-side (FR-025 — archived categories excluded
from new selection, but an already-assigned archived category still renders
correctly by name via the expense record's own `category_id`, matched
against the same full, unfiltered category list).

## Categories (US3)

| Screen action | Endpoint | Contract |
|---|---|---|
| List (all, including archived, for management view) | `GET /workspaces/{workspace_id}/categories` | `../../003-income-expense-category-core/contracts/categories-api.md` |
| List (active only, for expense form picker) | `GET /workspaces/{workspace_id}/categories?include_archived=false` | same |
| Create | `POST /workspaces/{workspace_id}/categories` | same |
| Rename and/or archive | `PATCH /workspaces/{workspace_id}/categories/{category_id}` | same |

Category reordering (`PUT /workspaces/{workspace_id}/categories/order`)
exists on the backend but has no corresponding requirement in this phase's
spec (no drag-to-reorder UI) — explicitly out of scope, listed here only so
a future phase doesn't mistake it for missing backend support.

## Reports (US5)

| Screen action | Endpoint | Contract |
|---|---|---|
| Current-period income/expense/category summary | `GET /workspaces/{workspace_id}/dashboard` (reused) | `../../004-backend-financial-dashboard/contracts/dashboard-api.md` |

No new report endpoint. The reports screen renders `summary` and
`category_breakdown` from the same dashboard response already fetched for
the dashboard screen (or refetched if navigated to directly), guaranteeing
FR-026's "consistent with the dashboard's figures" by construction rather
than by convention.

## Settings (US6)

No backend call for language preference (client-side only, `data-model.md`).
No AI-settings endpoint exists yet (Phase 7) — the settings screen renders
a static "AI is optional, not yet configured" notice (FR-034) with no API
call behind it.
