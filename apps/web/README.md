# Web application

Next.js 16 (App Router) frontend for Smart Expense. See
`specs/005-frontend-core-experience/plan.md` for the full architecture and
`docs/setup.md` for the repository-wide setup walkthrough (Supabase stack,
backend, env files).

## App structure

- `app/[locale]/` — locale-prefixed routes (`en`/`ar`, always prefixed).
  `(auth)/sign-in`, `(auth)/sign-up`, `(auth)/reset-password` are
  unauthenticated; everything under `w/[workspaceId]/` (dashboard, incomes,
  expenses, categories, reports, settings, new-workspace) requires a signed-in
  session, enforced in `middleware.ts`.
- `components/` — UI grouped by feature (`dashboard/`, `income/`, `expense/`,
  `category/`, `reports/`, `settings/`, `layout/`) plus `providers.tsx` for
  the shared TanStack Query client.
- `hooks/` — TanStack Query hooks per resource (`use-dashboard`,
  `use-incomes`, `use-expenses`, `use-categories`, `use-workspaces`).
- `lib/` — `api/` (typed fetch clients against the FastAPI backend),
  `supabase/` (browser + middleware Supabase clients), `workspace-context.tsx`
  (active workspace/role provider), `permissions.ts` (role matrix),
  `money.ts` (SAR minor-unit parsing/formatting).
- `i18n/` — `next-intl` routing and request config; `messages/en.json` and
  `messages/ar.json` hold every translation string used by the app.
- `tests/unit/` — Vitest; `tests/e2e/` — Playwright.

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values `npx supabase
status` prints (see `docs/setup.md`):

- `NEXT_PUBLIC_API_URL` — base URL of the FastAPI backend (defaults to
  `http://localhost:8000`).
- `NEXT_PUBLIC_SUPABASE_URL` — local (or hosted) Supabase project URL, used
  by the browser Supabase client for auth.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key paired with the
  URL above.

All three are `NEXT_PUBLIC_*` values exposed to browser code — never put a
secret in this file.

## Run the dev server

```powershell
npm install
npm run dev
```

Starts on `http://localhost:3000` (or the next free port if that one is
already in use). Requires the local Supabase stack and the FastAPI backend
running alongside it — see `docs/setup.md`.

## Run the tests

Unit tests (Vitest — component and pure-logic tests, no browser or network):

```powershell
npm run test
```

End-to-end tests (Playwright — drives a real browser against the dev server;
most specs also need a signed-in user and the FastAPI backend running):

```powershell
npm run test:e2e
```

Every spec is gated behind `E2E_EMAIL`/`E2E_PASSWORD` (a confirmed local
Supabase user) and skips itself when those are unset:

```powershell
$env:E2E_EMAIL = "you@example.com"
$env:E2E_PASSWORD = "your-local-password"
npm run test:e2e
```

That covers most specs, but three need more to actually run rather than
skip:

- `auth.spec.ts` additionally needs `E2E_WORKSPACE_ID` (the owner's own
  workspace id — e.g. the personal workspace `E2E_EMAIL` lands on after
  sign-in).
- `roles.spec.ts`, and the member/viewer half of `categories.spec.ts`,
  additionally need `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`,
  `E2E_VIEWER_EMAIL`, `E2E_VIEWER_PASSWORD`, and `E2E_TEAM_WORKSPACE_ID` — a
  team workspace `E2E_EMAIL` owns, with those two accounts added as Member
  and Viewer respectively (via `POST /workspaces/{id}/members`).

Without those, the suite still runs and passes — it just silently skips
those three cases rather than failing, so it is easy to believe you covered
the full suite when you have not.

`playwright.config.ts` starts `npm run dev` automatically if nothing is
already listening on the configured base URL (override with
`PLAYWRIGHT_BASE_URL` if port 3000 is taken locally). Playwright also
defaults to full parallelism; the suite shares one Supabase account across
most specs, and `supabase-js`'s default `signOut()` scope is global (it
invalidates every session for that user), so running `auth.spec.ts`
alongside others in parallel can intermittently sign other in-flight specs
out mid-test. Add `--workers=1` for a reliable full-suite run.
