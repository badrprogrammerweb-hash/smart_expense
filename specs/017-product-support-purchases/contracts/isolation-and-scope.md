# Contract: Isolation and Scope (binding)

This is the single most important contract in this phase. It exists because
Constitution Principle XIII and spec FR-004/FR-008/FR-026 require that
support purchases can **never** become, or influence, workspace financial
truth.

## Binding rules

1. `public.support_purchases` **MUST NOT** have a `workspace_id` column, a
   foreign key to `public.workspaces`, or any other column that names or
   references a workspace.
2. No dashboard, report, or history **service function or query** (existing
   or new) MAY join, reference, or read from `public.support_purchases`.
   Dashboard totals, report aggregations, and history entries are computed
   exactly as before this phase, byte-for-byte (spec SC-001).
3. `public.support_purchases` rows are scoped **only** to `user_id
   (= auth.uid())`. There is no workspace-scoped endpoint, RLS policy, or
   query path that can return another user's purchase, or any purchase
   filtered "by workspace."
4. A support purchase, in any state (`pending`, `completed`, `failed`,
   `refunded`), **MUST NOT**:
   - Create, modify, or delete a row in `incomes`, `expenses`, `categories`,
     `files`, or `history`.
   - Change a role, permission, or workspace-membership row.
   - Change any feature flag, usage limit, or entitlement (none exist for
     this reason — see rule 5).
5. This phase introduces **no entitlement, feature-flag, or limit-adjustment
   mechanism of any kind**. There is nothing for a purchase to grant, so
   there is nothing to isolate beyond the data itself.
6. Endpoints in this domain (`/support-purchases/...`) **MUST NOT** accept,
   require, or expose a `workspace_id` path/query/body parameter.

## Why this is a contract, not just an FR

A future maintainer adding a "recent activity" widget or an admin report
might reflexively join every table with a `user_id` into a workspace-scoped
view. This contract exists precisely to make that specific, easy mistake a
named, testable violation rather than a subtle regression discovered late.

## Verification

- **Schema check**: assert `information_schema.columns` for
  `support_purchases` contains no `workspace_id` column and no FK to
  `workspaces`.
- **Query-surface check**: assert none of `services/dashboard.py`,
  `services/reports.py`, `services/history.py` reference
  `support_purchases` (static grep/import check as part of CI, documented in
  `quickstart.md`).
- **Behavioral check**: create purchases in every state for a test user with
  workspace data present; assert workspace dashboard/report/history
  responses are unchanged before and after (spec SC-001).
- **RLS check**: as User B, attempt to read User A's `support_purchases`
  rows via the API and directly via RLS; both MUST return zero rows.
