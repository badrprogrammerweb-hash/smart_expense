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

Most e2e specs are gated behind `E2E_EMAIL`/`E2E_PASSWORD` (a confirmed
local Supabase user) and skip themselves when those are unset:

```powershell
$env:E2E_EMAIL = "you@example.com"
$env:E2E_PASSWORD = "your-local-password"
npm run test:e2e
```

`playwright.config.ts` starts `npm run dev` automatically if nothing is
already listening on the configured base URL (override with
`PLAYWRIGHT_BASE_URL` if port 3000 is taken locally).
