# Local development setup

This guide starts the frontend and backend development shells from a fresh
checkout. Neither shell requires a live Supabase project in this foundation
phase.

## Prerequisites

- Node.js 20.9 or newer with npm
- Python 3.11 or newer

Run all commands from the repository root unless a step says otherwise.

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

The backend example contains two optional server settings:

- `SUPABASE_URL`: URL of the future Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only credential used for the future
  Supabase connection. This is a secret and must never be exposed to the
  frontend or committed.

The API loads `apps/api/.env` when started from `apps/api`. If either
Supabase value is empty or missing, the API still starts and reports the
database as `not_configured`. This is the expected degraded mode for this
phase.

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
