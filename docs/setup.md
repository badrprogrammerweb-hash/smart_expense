# Local development setup

This guide starts the frontend and backend development shells from a fresh
checkout. The frontend still runs with no live Supabase project. The backend
also starts and reports a degraded health status without one, but the
authentication and workspace endpoints (`/workspaces`, `/workspaces/{id}`,
`/workspaces/{id}/members`, ...) and the backend test suite require a local
Supabase stack to be running, as introduced in Phase 2 (Authentication and
Workspace Foundation).

## Prerequisites

- Node.js 20.9 or newer with npm
- Python 3.11 or newer
- [Supabase CLI](https://supabase.com/docs/guides/cli) with Docker running
  (required for `supabase start`)

Run all commands from the repository root unless a step says otherwise.

## Start the local Supabase stack

```bash
supabase start
```

This applies every migration under `supabase/migrations/` to a fresh local
Postgres instance — the `user_profiles`, `workspaces`, and
`workspace_memberships` tables, their RLS policies, and triggers (see
`supabase/README.md`) — and prints local URLs and keys, including the
`DB URL` and `anon`/`service_role` keys. Re-run later with `supabase status`
to print those values again, or `supabase db reset` to re-apply every
migration from scratch (wipes local data).

## Configure local environment files

On PowerShell:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/api/.env.example apps/api/.env
```

On macOS or Linux:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

The frontend example contains one optional public setting:

- `NEXT_PUBLIC_API_URL`: Base URL for future browser requests to the FastAPI
  app. The starter page does not call the API, so it runs when this value or
  the backend is unavailable. Because `NEXT_PUBLIC_*` values are visible in
  browser code, this value must never contain a secret.

The backend example contains four server settings, all populated from the
values `supabase start`/`supabase status` printed in the previous step:

- `SUPABASE_URL`: URL of the local (or hosted) Supabase project.
- `SUPABASE_DB_URL`: Direct Postgres connection string used for the
  RLS-aware workspace queries in `app/db.py`. Local secret; must never be
  exposed to the frontend or committed.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only credential used for the Supabase
  REST connection (e.g. the `/health` check, and test fixtures that sign up
  users directly against Auth). This is a secret and must never be exposed
  to the frontend or committed.
- `SUPABASE_JWT_SECRET`: Optional legacy HS256 JWT verification fallback for
  older Supabase projects; JWKS verification is preferred when available.
  Local secret; must never be committed with a real value.

The API loads `apps/api/.env` when started from `apps/api`. If
`SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is empty or missing, the API
still starts and `/health` reports the database as `not_configured` — this
is the expected degraded mode. `SUPABASE_DB_URL` is required for the
workspace endpoints and the backend test suite; without it, those endpoints
return `503 database_not_configured`.

Only the `.env.example` files are safe to commit. Real `.env`, `.env.local`,
and other `.env.*` files are local-only and ignored by Git. Example files
must contain placeholders or empty values, never real credentials.

## Start the backend

Move into the backend directory and create a virtual environment:

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

On macOS or Linux:

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

A successful start reports that Uvicorn is running at `http://127.0.0.1:8000`.
Open `http://127.0.0.1:8000/health` or run:

```bash
curl http://127.0.0.1:8000/health
```

With the empty example values, the response is:

```json
{"status":"ok","dependencies":{"database":"not_configured"}}
```

Leave this process running while starting the frontend in a second terminal.

## Run the backend test suite

With the local Supabase stack running and `apps/api/.env` populated from
`supabase status`, run `pytest` from `apps/api` (a separate terminal; it
does not require the `uvicorn` process from the previous step):

```powershell
cd apps/api
.venv\Scripts\python.exe -m pytest
```

On macOS or Linux:

```bash
cd apps/api
source .venv/bin/activate
python -m pytest
```

Tests that need Supabase (most of the suite, from Phase 2 onward) are
skipped automatically — not failed — when `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_DB_URL` is missing from
`apps/api/.env` (see the `requires_supabase` marker in
`apps/api/tests/conftest.py`). Each test signs up real users against local
Auth and exercises the real RLS-protected endpoints — there are no mocks
for the database layer, since RLS correctness cannot be verified by
mocking it away. If a test run leaves stale users behind (tests reuse a few
fixed email addresses for readable role-matrix assertions) and a later run
fails with `user_already_exists`, run `supabase db reset` for a clean
slate.

## Start the frontend

From the repository root:

```powershell
cd apps/web
npm install
npm run dev
```

A successful start reports a local URL, normally `http://localhost:3000`.
Opening it shows the Smart Expense starter page and the message that the
frontend development shell is running.

## Run either shell independently

The shells have no startup dependency on each other. Stop the backend with
Ctrl+C and reload `http://localhost:3000`; the frontend page must continue to
work. A backend-only contributor can likewise run the health endpoint without
starting the frontend.

## A note on `npm ls postcss`

Running `npm ls postcss` in `apps/web` (or the repository root) reports an
`ELSPROBLEMS` error. This is expected and not a broken install: `next`
pins its own dependency on `postcss` to the exact version `8.4.31`, while
the root `package.json`'s `overrides` field intentionally resolves the
patched `8.5.10` release instead (the version that fixes a known PostCSS
advisory). `npm ls` flags that mismatch against `next`'s declared pin
regardless of whether the override is correctly applied, so it is not a
reliable health check here. `npm ci`, `npm audit`, and `npm run build` are
the actual validation gates — all three passing confirms the dependency
tree is healthy.

## Feature spec convention

Each new feature uses a sequentially numbered directory under `specs/`:

```text
specs/<seq>-<short-name>/
```

Use the next sequence number and a concise kebab-case name. Keep the feature's
Spec Kit artifacts together in that directory:

```text
spec.md
plan.md
research.md
data-model.md
quickstart.md
contracts/
tasks.md
```

The foundation feature is the worked example at `specs/001-foundation/`.
Its specification, plan, research, data model, quickstart, contracts, and
tasks all follow this convention. The repository's
`.specify/init-options.json` sets `feature_numbering` to `sequential`, so
subsequent features reuse this pattern rather than choosing a new location
or numbering scheme.
