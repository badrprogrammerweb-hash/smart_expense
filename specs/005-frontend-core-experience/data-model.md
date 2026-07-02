# Phase 5 Data Model: Frontend Core Experience

No new database tables, migrations, or backend response shapes are
introduced this phase. This file documents (1) the new client-side-only
state this phase introduces, and (2) the permission matrix the frontend
must apply when deciding which actions to show — derived entirely from
data the existing Phase 2/3 endpoints already return, not a new
authorization decision.

## Client-side state entities

### Session

Not a stored entity — the live Supabase Auth session (`access_token`,
`user.id`, `expires_at`) held by `@supabase/ssr`'s browser client and
refreshed by `middleware.ts`. Every `lib/api/*` call reads the current
`access_token` at call time; nothing caches a token beyond what Supabase's
own client already manages.

| Field | Source | Used for |
|---|---|---|
| `access_token` | Supabase browser client | `Authorization: Bearer <token>` header on every `apps/api` call |
| `user.id` | Supabase browser client | Compared against an expense's `created_by` to decide Member edit/delete visibility (see Permission Matrix) |

### Language preference

`localStorage["smart-expense.locale"]` — `"en" | "ar"`. Written whenever the
user switches language in settings (FR-030). Read once, before the initial
locale redirect, to decide which `[locale]` segment to send a fresh visitor
into; after that, `next-intl`'s `[locale]` URL segment is the single source
of truth for the currently rendered locale (research.md Decision 6).

### Last active workspace

`localStorage["smart-expense.lastWorkspaceId"]` — a workspace uuid. Written
every time the user switches workspace via the selector or lands on a
workspace successfully. Read on sign-in / root-page load to decide which
`/[locale]/w/{workspaceId}/dashboard` to redirect into (FR-009,
Clarification Session 2026-07-01). If the stored id is no longer in the
user's `GET /workspaces` list (e.g., removed from a team), the app falls
back to the workspace flagged `type: "personal"`, which always exists.

### Active workspace context (`workspace-context.tsx`)

In-memory React Context, derived from the `w/[workspaceId]` URL segment
plus the matching entry from the cached `GET /workspaces` response (which
already includes the caller's own `role` for that workspace — no second
request needed).

| Field | Type | Source |
|---|---|---|
| `workspaceId` | uuid | URL segment |
| `workspaceType` | `"personal" \| "team"` | Matching entry in `GET /workspaces` response |
| `workspaceName` | string | Matching entry in `GET /workspaces` response |
| `role` | `"owner" \| "admin" \| "member" \| "viewer"` | Matching entry in `GET /workspaces` response |
| `memberCount` | integer | `member_count` field from `GET /workspaces/{workspace_id}` (`002-auth-workspace-foundation/contracts/workspaces-api.md`) — drives the "no team members yet" empty state (FR-035) when a team workspace has no member beyond the caller |

Re-fetched (not just re-read from a stale cache) on every workspace-scoped
navigation and on window refocus, satisfying FR-037 ("re-validate a
user's permitted actions against their current role... rather than relying
solely on a role held in client memory since the page loaded").

## Permission matrix (derived from existing contracts — not new rules)

The frontend must gate action visibility using **both** workspace role and,
for expenses only, record ownership. This mirrors exactly what
`003-income-expense-category-core/contracts/incomes-api.md` and
`expenses-api.md` already enforce server-side; the frontend is not adding
new rules, only avoiding showing an action the backend would 403.

| Action | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| View dashboard / reports / history | Yes | Yes | Yes | Yes |
| Create income | Yes | Yes | No | No |
| Edit/delete **any** income | Yes | Yes | No | No |
| Create expense | Yes | Yes | Yes | No |
| Edit/delete **own** expense (`created_by == session.user.id`) | Yes | Yes | Yes | No |
| Edit/delete **another member's** expense | Yes | Yes | No | No |
| Create/rename/archive category | Yes | Yes | No | No |
| Create team workspace | Yes* | Yes* | Yes* | Yes* |
| Switch workspace | Yes | Yes | Yes | Yes |

\* Team workspace creation is available to any authenticated user
regardless of their role in *other* workspaces — the caller becomes Owner
of the new workspace (`002-auth-workspace-foundation/contracts/
workspaces-api.md`, FR-007/FR-008). It is not gated by a role in an
existing workspace.

Controls throughout the income/expense forms and history lists (`lib/
permissions.ts`) are computed as three separate functions, since income has
no per-record ownership exception and expense does:

```text
canManageIncome(role) =
  role in {"owner", "admin"}
  # governs both create and edit/delete — income has no "own record" exception

canCreateExpense(role) =
  role in {"owner", "admin", "member"}

canEditOrDeleteExpense(record, role, currentUserId) =
  role in {"owner", "admin"}
  or (role === "member" and record.created_by === currentUserId)
```

## Screen-level state summary

| Screen | Reads | Writes |
|---|---|---|
| Dashboard | `GET .../dashboard` | — (quick-action links to income/expense forms) |
| Income history/form | `GET/POST/PATCH/DELETE .../incomes` | income records |
| Expense history/form | `GET/POST/PATCH/DELETE .../expenses` | expense records |
| Categories | `GET/POST/PATCH .../categories` | categories (create/rename/archive) |
| Reports | `GET .../dashboard` (reused, no separate endpoint) | — |
| Settings | Language preference (`localStorage`), `memberCount` (workspace context) | Language preference |
| Workspace selector / new-workspace | `GET /workspaces`, `GET /workspaces/{id}` (`memberCount`), `POST /workspaces` | last-active-workspace (`localStorage`), new team workspace |

## Out of scope for this phase

No new backend entity, column, endpoint, or migration. No server-side
persistence of language preference or last-active-workspace (spec
Assumptions — left to a later settings-focused phase if ever needed). No
team-member management entity (invite/remove/role-change UI is out of
scope per spec Assumptions).
