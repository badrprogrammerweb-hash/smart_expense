# Implementation Plan: Frontend Core Experience

**Branch**: `005-frontend-core-experience` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-frontend-core-experience/spec.md`

## Summary

Build the first real `apps/web` frontend on top of the currently-bare Next.js
16 shell: authentication screens, a workspace selector/shell, a dashboard,
income/expense forms plus a browsable history list, category management,
a current-period reports view, and a settings screen with Arabic/English +
RTL support. Every screen consumes existing Phase 2-4 FastAPI endpoints only
(`/workspaces`, `/workspaces/{id}/incomes`, `/expenses`, `/categories`,
`/dashboard`) via a Supabase-issued bearer token; no backend endpoint, table,
or migration changes are introduced. Remaining balance and all totals are
always the value the backend returned — the frontend never recomputes them.
Locale (Arabic/English + RTL) and the "last active workspace" are client-side
presentation state (`localStorage`), not new backend settings, per the
spec's Clarifications and Assumptions.

## Technical Context

**Language/Version**: TypeScript 5.7 on Next.js 16.x (App Router) / React
18.3 — extends `apps/web` only. No changes to `apps/api` or `supabase/`.

**Primary Dependencies**:
- Already present: `next@16.2.9`, `react@18.3.1`, `react-dom@18.3.1`.
- New this phase: Tailwind CSS v4 + `shadcn/ui` (CLI-generated components;
  constitution-mandated UI stack, not yet installed); `@supabase/supabase-js`
  + `@supabase/ssr` (browser/server Supabase clients, session refresh);
  `next-intl` (Arabic/English message catalogs + RTL, the standard i18n
  solution for App Router since Next.js dropped built-in i18n routing);
  `@tanstack/react-query` v5 (server-state fetching/caching/invalidation for
  dashboard, incomes, expenses, categories, reports); `react-hook-form` +
  `zod` + `@hookform/resolvers` (form state/validation — the pairing
  `shadcn/ui`'s Form primitives are built for).

**Storage**: N/A — no new persistence. All business data continues to live
in Supabase Postgres behind the existing FastAPI endpoints. The only new
client-side state is `localStorage`: language preference and last-active
workspace id (spec Assumptions; Clarifications, Session 2026-07-01).

**Testing**: Vitest + React Testing Library for unit/component tests (form
validation, role-based action hiding, empty/error states, money formatting);
Playwright for end-to-end flows (sign-in → dashboard, add income/expense
with totals updating, language switch mirroring RTL/LTR, workspace switch
isolation). Phase 1 explicitly deferred frontend test-framework selection to
"the phase that introduces the first real business logic" — this is that
phase.

**Target Platform**: Browser (desktop + mobile web), served by the existing
Next.js dev/build setup; no new deployment target this phase (Phase 10
handles Bunny Magic Containers hosting).

**Project Type**: Web application — frontend only this phase. `apps/api` and
`supabase/` are unchanged; every request `apps/web` makes is to an endpoint
that already exists and is already tested server-side.

**Performance Goals**: Dashboard and history screens interactive within 2
seconds on a typical broadband connection for workspaces at the Phase 4
10,000-record scale the backend already validated (SC-002 in this spec: a
new record reflected in totals in under 5 seconds after submission, which
includes one API round trip plus a query invalidation/refetch).

**Constraints**:
- Frontend performs no financial calculation beyond unit conversion for
  display/input (minor units ⇄ major SAR) — remaining balance, totals, and
  category breakdown are always the values the backend returned
  (Constitution IX/X).
- Every protected screen re-derives the caller's role from `GET /workspaces`
  (which already returns the caller's own `role` per workspace) rather than
  trusting a role cached since page load, satisfying FR-035.
- Expense edit/delete has a per-record nuance beyond role alone: a Member
  may only edit/delete an expense they created themselves (`created_by`
  match); Owner/Admin may edit/delete any; Viewer never. Income has no
  "own record" carve-out — Owner/Admin only. The UI must reflect both rules,
  not just workspace role (see `data-model.md`).
- No new backend endpoints, tables, migrations, or RLS policy changes.
- Locale routing uses a `[locale]` App Router segment (`en`/`ar`); RTL is
  driven by `<html dir="rtl">` on the Arabic locale, not a separate style
  system.
- The FastAPI backend accepts only `Authorization: Bearer <supabase-access-
  token>` (`002-auth-workspace-foundation/contracts/session-validation.md`)
  — every `apps/web` call to `apps/api` must attach the current Supabase
  session's access token; there is no cookie-session fallback on the API
  side.

**Scale/Scope**: ~14 pages/routes (3 auth, 1 root redirect, 8 workspace-
scoped screens including the income/expense history list, plus a
new-team-workspace flow embedded in the workspace selector), 1 combined
i18n+auth middleware, 2 message catalogs (`en.json`, `ar.json`), and the
`apps/api`/`supabase/` trees untouched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability this phase | Status |
|---|---|---|
| I. Core Product Principle | Delivers the exact core screens (income, expense, categories, remaining-balance dashboard, reports, workspaces) | PASS |
| II. Budgeting Philosophy | Dashboard/reports render the backend's Remaining Balance = Income − Expenses figure verbatim; frontend never recomputes it | PASS |
| III. MVP Scope Discipline | File upload, BYOK/AI settings, AI extraction review, and multi-period reports/history are explicitly out of scope (spec Assumptions) | PASS |
| IV. Saudi-First Default | Arabic/English + RTL readiness, SAR-first `Intl.NumberFormat` display, existing Saudi-first default categories rendered as-is | PASS |
| V. Manual-First, AI-Optional | Every screen is manual-entry; AI settings shown only as "optional, not configured" (FR-034), never a broken partial flow | PASS |
| VI. Privacy and Security | Bearer token from Supabase session only, attached via a shared API client; no secret ever placed in a `NEXT_PUBLIC_*` var; role-gated actions revalidated server-side by the API regardless of UI hiding (FR-035/FR-037) | PASS |
| VII. Workspace and Multi-Tenant Isolation | Every API call is workspace-scoped by path param; TanStack Query cache keys include `workspaceId` so switching workspaces cannot show stale cross-workspace data | PASS |
| VIII. Storage and File Retention | No file upload UI this phase | N/A |
| IX. Architecture Authority | Frontend renders backend-computed totals only; the only "calculation" performed client-side is minor⇄major unit display/input conversion, not authoritative math | PASS |
| X. Financial Accuracy (NON-NEGOTIABLE) | Amounts round-trip as integers end-to-end; conversion helper (`lib/money.ts`) never uses floating-point for the values sent back to the API | PASS |
| XI. Reports Integrity | Reports view reuses the same confirmed-only dashboard endpoint/data — cannot diverge from the dashboard by construction | PASS |
| XII. History Tracking | No new activity-log UI this phase; the income/expense history list added here is a record browser, not an audit trail (Phase 9 builds activity history) | N/A |
| XIII. Future Monetization Readiness | No billing surface touched | N/A |
| XIV. Testing Requirements | Vitest covers role-hiding/empty-state/validation logic; Playwright covers Arabic/English/RTL rendering and the core sign-in→dashboard→record→totals flow (constitution's explicit Arabic/English/RTL testing requirement) | PASS |
| XV. Scope Control | Screens map 1:1 to the spec's six user stories; nothing speculative added | PASS |
| XVI. Spec-Kit Workflow | spec → clarify → this plan, in order; no implementation started yet | PASS |

No violations identified. Complexity Tracking table is not applicable.

**Post-Phase 1 re-check**: All gates remain PASS. `data-model.md` confirms
no new backend entities are introduced — only client-side presentation
state and a documented permission matrix derived from existing contracts.
`contracts/frontend-api-consumption.md` confirms every screen maps to an
already-implemented, already-tested endpoint; no new request/response shape
is defined. The Member-can-only-edit-own-expense nuance surfaced during
design strengthens Principle VI/VII rather than introducing new risk, since
it is enforced server-side already (`expenses-api.md`) — the frontend only
needs to mirror it for a clean UX, not to invent a new authorization rule.

## Project Structure

### Documentation (this feature)

```text
specs/005-frontend-core-experience/
├── plan.md                                  # This file
├── research.md                              # Phase 0 output
├── data-model.md                            # Phase 1 output
├── quickstart.md                            # Phase 1 output
├── contracts/
│   ├── frontend-api-consumption.md          # Phase 1 output — screen → existing endpoint map
│   └── routes.md                            # Phase 1 output — page-route contract
└── tasks.md                                 # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/web/
├── app/
│   ├── middleware.ts                        # NEW — combined next-intl + Supabase session-refresh + auth guard
│   └── [locale]/                            # NEW — next-intl locale segment (en, ar)
│       ├── layout.tsx                       # NEW — locale/dir provider, React Query provider, Supabase session context
│       ├── page.tsx                         # NEW — redirect to last-active workspace dashboard or /sign-in
│       ├── (auth)/
│       │   ├── sign-in/page.tsx             # NEW
│       │   ├── sign-up/page.tsx             # NEW
│       │   └── reset-password/page.tsx      # NEW
│       └── w/
│           └── [workspaceId]/
│               ├── layout.tsx               # NEW — workspace shell: selector, nav, role/membership fetch
│               ├── dashboard/page.tsx       # NEW — US1
│               ├── incomes/page.tsx         # NEW — US2 (form + history list, income slice)
│               ├── expenses/page.tsx        # NEW — US2 (form + history list, expense slice)
│               ├── categories/page.tsx      # NEW — US3
│               ├── reports/page.tsx         # NEW — US5
│               ├── settings/page.tsx        # NEW — US6
│               └── new-workspace/page.tsx   # NEW — US4 (create-team-workspace flow)
├── components/
│   ├── ui/                                  # NEW — shadcn/ui-generated primitives
│   ├── layout/                              # NEW — header, workspace selector, nav shell
│   ├── income/                              # NEW — income form + history table
│   ├── expense/                             # NEW — expense form + history table
│   ├── category/                            # NEW — category list + create/rename/archive form
│   ├── dashboard/                           # NEW — summary cards, category breakdown, recent activity
│   ├── reports/                             # NEW — current-period report view
│   └── settings/                            # NEW — language switcher, profile/workspace info
├── lib/
│   ├── supabase/
│   │   ├── client.ts                        # NEW — browser Supabase client
│   │   ├── server.ts                        # NEW — server component/middleware Supabase client
│   ├── api/
│   │   ├── client.ts                        # NEW — fetch wrapper: base URL + bearer token attach + error shape
│   │   ├── workspaces.ts                    # NEW — GET/POST /workspaces, GET /workspaces/{id}
│   │   ├── incomes.ts                       # NEW — Incomes API client (specs/003 contract)
│   │   ├── expenses.ts                      # NEW — Expenses API client (specs/003 contract)
│   │   ├── categories.ts                    # NEW — Categories API client (specs/003 contract)
│   │   └── dashboard.ts                     # NEW — Dashboard API client (specs/004 contract)
│   ├── money.ts                             # NEW — minor⇄major SAR conversion + Intl.NumberFormat helpers
│   └── workspace-context.tsx                # NEW — active-workspace state, localStorage-backed
├── i18n/
│   ├── routing.ts                           # NEW — next-intl locale list + routing config
│   └── request.ts                           # NEW — next-intl request config
├── messages/
│   ├── en.json                              # NEW
│   └── ar.json                              # NEW
├── hooks/
│   ├── use-dashboard.ts                     # NEW — TanStack Query hook
│   ├── use-incomes.ts                       # NEW
│   ├── use-expenses.ts                      # NEW
│   ├── use-categories.ts                    # NEW
│   └── use-workspaces.ts                    # NEW
├── tests/
│   ├── unit/                                # NEW — Vitest + RTL
│   └── e2e/                                 # NEW — Playwright
├── package.json                             # MODIFIED — add dependencies above
├── next.config.js                           # MODIFIED — next-intl plugin wiring
└── .env.example                             # MODIFIED — add NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY

apps/api/                                    # unchanged — no new/modified endpoints
supabase/                                    # unchanged — no new tables or migrations
```

**Structure Decision**: Introduce the `apps/web` application layout for the
first time beyond the bare Phase 1 shell, using Next.js App Router's
`[locale]` segment (required by `next-intl` for App Router i18n) and a
nested `w/[workspaceId]` segment that mirrors the backend's
`{workspace_id}` path convention so every data-fetching hook can key its
cache directly on the URL segment. `lib/api/*` isolates all HTTP calls to
`apps/api` behind small typed functions (one file per backend contract
already documented in `specs/002-*`/`specs/003-*`/`specs/004-*`), so no
screen component talks to `fetch` directly and every request shape stays
traceable to an existing, already-tested contract. No Postgres, RLS, or
FastAPI changes are needed — this phase is additive to `apps/web` only.

## Complexity Tracking

> No Constitution Check violations were identified — this section is not
> applicable.
