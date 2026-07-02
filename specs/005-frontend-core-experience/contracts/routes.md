# Contract: Page Routes

Every route lives under a `[locale]` segment (`en` or `ar` — next-intl,
`research.md` Decision 2). Paths below omit the locale prefix for
readability: `/w/{workspaceId}/dashboard` means
`/en/w/{workspaceId}/dashboard` or `/ar/w/{workspaceId}/dashboard`.

## Public routes (no session required)

| Route | Purpose | Guard |
|---|---|---|
| `/sign-in` | Sign in (FR-002) | Redirects to last-active workspace dashboard if already signed in |
| `/sign-up` | Register (FR-001) | Same |
| `/reset-password` | Request password reset (FR-004) | None |

## Root redirect

| Route | Purpose |
|---|---|
| `/` | No UI of its own. Signed out → `/sign-in`. Signed in → `/w/{lastActiveOrPersonalWorkspaceId}/dashboard` (FR-009, Clarification Session 2026-07-01). |

## Workspace-scoped routes (session + membership required)

All routes below are nested under `/w/[workspaceId]/`. `middleware.ts`
redirects to `/sign-in` for any unauthenticated request to this subtree
(FR-005); a `404` from any API call under it (caller not a member) redirects
to the workspace selector rather than rendering the page.

| Route | Purpose | User Story |
|---|---|---|
| `/w/{workspaceId}/dashboard` | Financial summary, category breakdown, recent activity, quick actions | US1 |
| `/w/{workspaceId}/incomes` | Income history list + create/edit (Owner/Admin only) | US2 |
| `/w/{workspaceId}/expenses` | Expense history list + create/edit (role + ownership rules, `data-model.md`) | US2 |
| `/w/{workspaceId}/categories` | Category list, create/rename/archive (Owner/Admin only) | US3 |
| `/w/{workspaceId}/reports` | Current-period income/expense/category report | US5 |
| `/w/{workspaceId}/settings` | Language preference, basic profile/workspace info, AI-optional notice | US6 |
| `/w/{workspaceId}/new-workspace` | Create-team-workspace form, reached from the workspace selector | US4 |

The workspace selector itself (list + switch) is not a standalone route —
it is a persistent header/nav component rendered inside the `w/
[workspaceId]/layout.tsx` shell on every workspace-scoped page, so it is
always reachable without a page transition (FR-006/FR-007).

## Out of scope for this phase

No `/w/{workspaceId}/members` (team-member management screen — spec
Assumptions, deferred). No `/w/{workspaceId}/files` or receipt/invoice
routes (Phase 6). No `/w/{workspaceId}/settings/ai` (Phase 7). No
`/w/{workspaceId}/history` activity log beyond the dashboard's recent
records and the income/expense history lists already covered above
(Phase 9 builds a dedicated activity/history screen).
