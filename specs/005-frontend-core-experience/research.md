# Research: Frontend Core Experience

Phase 0 output. Resolves every `NEEDS CLARIFICATION` left implicit by the
spec's technology-agnostic requirements now that this is the phase that
actually builds `apps/web`. `apps/web` today is the bare Phase 1 shell
(`next@16.2.9`, `react@18.3.1`, a single `layout.tsx`/`page.tsx`, no
Tailwind, no Shadcn UI, no Supabase client, no i18n) — every decision below
is a genuine choice, not a confirmation of something already in place.

## 1. UI foundation: Tailwind CSS v4 + shadcn/ui

**Decision**: Install Tailwind CSS v4 (CSS-first configuration — no
`tailwind.config.js`; theme tokens live in the main CSS file under
`@theme`) and initialize `shadcn/ui` via its CLI, which as of 2026 defaults
to Tailwind v4 + the App Router + the `@/*` import alias.

**Rationale**: The constitution mandates Tailwind CSS + Shadcn UI directly.
Tailwind v4 is the current CLI default for new shadcn/ui projects and avoids
installing a config format (`tailwind.config.js`-based v3) that the
ecosystem is actively migrating away from.

**Alternatives considered**: Tailwind v3 — rejected as a needless
new-project regression; `shadcn/ui`'s own docs and CLI default to v4 for new
installs. A non-Shadcn component library — rejected, contradicts the
constitution's explicit Technology Constraints.

## 2. Internationalization & RTL: next-intl

**Decision**: Use `next-intl` with a `[locale]` App Router segment
(`en`, `ar`), JSON message catalogs (`messages/en.json`,
`messages/ar.json`), and `<html lang={locale} dir={locale === "ar" ?
"rtl" : "ltr"}>` set in the locale layout.

**Rationale**: Next.js removed built-in i18n routing from the App Router;
`next-intl` is the de facto standard replacement, actively maintained, and
used in production App Router apps. It gives locale-aware routing,
message loading, and number/date formatting in one package, satisfying
FR-028–FR-032 (language switch, RTL mirroring, Arabic/English text, SAR
formatting) without hand-rolling a message-catalog system.

**Alternatives considered**: `next-i18next` — built for the Pages Router,
requires extra work to bolt onto the App Router. Hand-rolled JSON + React
Context — rejected; reinvents routing/formatting logic `next-intl` already
solves, and Constitution XV (Scope Control) favors reusing a maintained
library over speculative custom infrastructure for a cross-cutting concern
every screen depends on.

**Noted risk (non-blocking)**: `next-intl` documents a rough edge with
Next.js 16's `'use cache'` directive (an upcoming `next/root-params` API
will resolve it). This phase does not use `'use cache'` anywhere, so the
issue does not apply; noted here so a future phase reaching for `'use
cache'` on a locale-aware route knows to re-check `next-intl`'s guidance
first.

## 3. Authentication: `@supabase/ssr` + `@supabase/supabase-js`

**Decision**: Use `@supabase/supabase-js` as the SDK and `@supabase/ssr` for
the Next.js App Router integration: a browser client (`lib/supabase/
client.ts`) for Client Components (sign-in/sign-up forms, the API client's
token attachment), and a server/middleware client (`lib/supabase/
server.ts`) used only inside `middleware.ts` to refresh the session cookie
on every request before it expires.

**Rationale**: `@supabase/ssr` is Supabase's current officially-recommended
package for the App Router (the older `@supabase/auth-helpers-nextjs` is in
maintenance-only mode); it handles the App Router's split between
Server Components (can't write cookies) and the request/response cycle
(middleware can) so a signed-in user's session survives a full page reload
without a client-side flash of "signed out."

**How the backend contract shapes this**: `apps/api` only accepts
`Authorization: Bearer <supabase-access-token>`
(`002-auth-workspace-foundation/contracts/session-validation.md`) — it has
no cookie-session mode. So every call in `lib/api/*` reads the current
session's `access_token` from the Supabase browser client and attaches it
as a Bearer header; the `@supabase/ssr` cookie/middleware machinery is only
responsible for keeping that token fresh across page loads, not for
authenticating requests to `apps/api` directly.

**Alternatives considered**: Rolling a custom fetch-based auth client
against Supabase's REST auth endpoints — rejected; duplicates
well-maintained SDK behavior (token refresh, PKCE flow for email/password)
for no benefit. `@supabase/auth-helpers-nextjs` — rejected, in
maintenance-only mode per Supabase's own migration guidance.

## 4. Server-state fetching/caching: TanStack Query v5

**Decision**: Use `@tanstack/react-query` for every read against `apps/api`
(dashboard, incomes, expenses, categories, workspaces), with query keys of
the shape `[resource, workspaceId, ...params]`, and mutations (create/edit/
delete) invalidating the relevant keys — most commonly `["dashboard",
workspaceId]` alongside the specific resource list, since almost every
mutation changes totals.

**Rationale**: Six screens (dashboard, incomes, expenses, categories,
reports, workspace switch) all read the same handful of resources with
overlapping refetch needs (e.g., creating an expense must refresh both the
expense history list and the dashboard's totals — FR-018/SC-002). TanStack
Query's cache + invalidation model replaces what would otherwise be
duplicated `useEffect`/`useState` fetch boilerplate across every screen, and
its `workspaceId`-keyed cache is what keeps Principle VII (workspace
isolation) true in the UI: switching workspaces can never show stale data
from another workspace because the cache key itself changed.

**Alternatives considered**: SWR — comparable feature set, but TanStack
Query's mutation + invalidation API is a more direct fit for this phase's
create/edit/delete-heavy screens. Plain `fetch` in Server Components with
no client cache — rejected; several screens (forms, history list with
inline edit/delete, workspace switch) need client-side refetch-after-
mutation behavior that Server Components alone don't give without a full
page reload, which would fail SC-002's "reflected in under 5 seconds"
expectation on a slow connection.

## 5. Forms & validation: react-hook-form + zod

**Decision**: Build every form (sign-in, sign-up, income, expense, category
create/rename, settings) with `react-hook-form`, schema validation via
`zod` + `@hookform/resolvers`, using `shadcn/ui`'s `Form` primitives
directly (they are built specifically for this pairing).

**Rationale**: Directly satisfies FR-020 (client-side validation with
inline errors, backend still authoritative) with minimal custom code, and
keeps every form's validation schema colocated and typed rather than
duplicated ad hoc per screen.

**Alternatives considered**: Formik — less actively aligned with
`shadcn/ui`'s documented form patterns. Native uncontrolled forms with
manual validation — rejected; would mean hand-writing the exact
positive-amount/valid-date checks FR-020 requires on five separate forms
instead of one shared schema.

## 6. Client-side presentation state: `localStorage` + React Context

**Decision**: Language preference and "last active workspace" (Clarification,
Session 2026-07-01) are held in a small React Context backed by
`localStorage`, read once on mount and written on every change. No global
state library (Zustand/Redux) is introduced.

**Rationale**: The spec's own Assumptions scope both as client-side/
user-level presentation state, not new backend-synced settings, for this
phase. Two small, independent pieces of state don't justify a new
dependency — `next-intl`'s locale routing already owns the language half of
this (the `[locale]` URL segment is the source of truth; `localStorage`
only remembers the user's *last chosen* locale so the root redirect can
send them to it), and `workspace-context.tsx` owns the workspace half.

**Alternatives considered**: Zustand — reasonable, but unnecessary for two
values with no cross-cutting update logic; adding it would be scope
creep against Constitution XV for what a `useState` + `localStorage` effect
already covers cleanly.

## 7. Money handling: integer minor units end-to-end, display-only conversion

**Decision**: Every amount from `apps/api` arrives and leaves as an integer
`amount_minor` (halalas). `lib/money.ts` provides `toDisplayAmount(minor):
string` (using `Intl.NumberFormat(locale, { style: "currency", currency:
"SAR" })`) for rendering, and `parseInputToMinor(input: string): number`
for turning a user's typed amount back into an integer before it is sent to
`apps/api`. No intermediate floating-point arithmetic is performed on any
value that reaches an API request body or a totals display — `parseInputToMinor`
parses the decimal string directly into an integer count of the smallest
unit rather than multiplying a float by 100.

**Rationale**: Constitution X is explicit that money must never be
floating-point, and Constitution IX that the frontend is never the source
of truth for financial calculation. Treating unit conversion as a pure
display/input-encoding concern — not a calculation — keeps the frontend
fully compliant while still letting users type and read amounts in whole
SAR rather than halalas.

**Alternatives considered**: A money/decimal library (e.g., `dinero.js`) —
unnecessary; the only operations needed are parse-to-integer and
format-for-display, both of which `Intl.NumberFormat` and a small manual
parser cover without adding a dependency for arithmetic this phase never
performs.

## 8. Testing stack: Vitest + React Testing Library, Playwright

**Decision**: Vitest + `@testing-library/react` for unit/component tests
(form validation rules, role-based action visibility, empty-state vs.
error-state rendering, `lib/money.ts` conversion correctness). Playwright
for end-to-end flows: sign-in → dashboard render, add income/expense →
totals update, switch language → RTL/LTR mirrors correctly, switch
workspace → data isolation holds.

**Rationale**: Phase 1's plan explicitly deferred frontend test-framework
selection to "the phase that introduces the first real business logic"
(`specs/001-foundation/plan.md`) — this is that phase. Constitution XIV
specifically calls out Arabic/English UI behavior and RTL layout behavior
as required test areas; Playwright is the right tool for asserting the
actual rendered `dir` attribute and cross-page navigation, which a
component-level test can't observe in the same way.

**Alternatives considered**: Cypress — comparable, but Playwright has
first-class multi-locale/`dir` assertion support and is the more common
pairing with Next.js App Router projects as of 2026. Jest instead of
Vitest — rejected; Vitest is faster with Vite-based tooling and is the
more common default alongside a modern Next.js + Tailwind v4 stack, with no
offsetting advantage from Jest here.

## 9. Screen-to-route mapping and "contracts" for a frontend-only phase

**Decision**: Since this phase introduces zero new backend endpoints, its
Phase 1 "contracts" are (a) a page-route map (`contracts/routes.md`) and
(b) a screen → existing-endpoint consumption map
(`contracts/frontend-api-consumption.md`), instead of new request/response
schemas.

**Rationale**: The plan template's contract step exists to make a
feature's external interfaces explicit and reviewable. For this phase, the
externally-observable surface is the page routes a user/browser sees and
which already-documented backend contract each one depends on — writing
that down catches missing-endpoint or wrong-contract-reference mistakes
before `tasks.md` is generated, the same review value a request/response
contract gives a backend phase.

**Alternatives considered**: Skipping the contracts step entirely (the
template allows this for "purely internal" projects) — rejected; this
project is not purely internal, and an explicit route/endpoint map is cheap
to produce and directly useful for `/speckit-tasks` task generation.

## 10. Permission model refinement discovered during design

**Decision**: Document explicitly (in `data-model.md`) that expense
edit/delete authorization is not just "role in workspace" — a Member may
edit/delete only an expense whose `created_by` matches their own user id;
Owner/Admin may edit/delete any expense; Viewer never. Income has no
"own record" exception — only Owner/Admin may edit/delete any income record
at all. The frontend's action-visibility logic (FR-021/FR-037) must apply
both rules, not role alone.

**Rationale**: This is already enforced server-side
(`003-income-expense-category-core/contracts/expenses-api.md`,
`incomes-api.md`) — surfacing it here isn't a new authorization decision,
it's making sure the UI doesn't show an edit/delete action that the backend
will then 403, which would violate the spec's own edge case ("any action a
user isn't permitted to perform is hidden or disabled rather than failing
silently after submission").

**Alternatives considered**: Relying on the backend's `403` alone and
letting the UI show every action to every role — rejected; directly
contradicts spec Acceptance Scenario 5 under User Story 2 and Success
Criterion SC-006.

## Outcome

All Technical Context fields in `plan.md` are resolved; no `NEEDS
CLARIFICATION` markers remain.
