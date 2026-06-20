# Quickstart: Foundation and Repository Setup

Validates this feature end-to-end on a clean machine, proving SC-001
through SC-005 from `spec.md`. This guide will be superseded by the real
`docs/setup.md` produced during implementation — that file is the
contributor-facing source of truth; this one is the validation checklist for
this feature.

## Prerequisites

- Node.js (LTS) and npm installed
- Python 3.11+ installed
- A fresh clone of the repository, no prior environment configured

## 1. Validate repository layout (SC-001)

From repo root, **before opening any README**, confirm each top-level
boundary's directory name alone makes its purpose unambiguous:

`apps/web`, `apps/api`, `packages/shared`, `supabase`, `specs`, `docs`,
`infra`, `tests`.

Expected: a contributor can state, within 2 minutes and without reading
source code or any README, which boundary owns frontend code, backend code,
database artifacts, shared code, specs, docs, deployment config, and test
strategy docs.

Then open each boundary's `README.md` and confirm it states the same purpose
just identified from the name alone — the README confirms, it does not
establish, that purpose.

## 2. Configure environment (SC-003, SC-004)

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

Read `docs/setup.md`. Expected: every variable referenced by either app's
startup code is listed there with its purpose, and the doc explicitly states
which values are safe to commit (none — only the `.example` files) versus
which must stay local secrets. Confirm no real secret values exist anywhere
in the committed tree (`git status` shows only `.example` files tracked).

## 3. Start the backend shell (FR-011, FR-016, FR-017)

```bash
cd apps/api
python -m venv .venv
.venv/Scripts/activate   # or: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Expected: process starts without error using only the values copied in step
2 (which intentionally configure no real database connection yet). Then:

```bash
curl http://localhost:8000/health
```

Expected response per `contracts/health-endpoint.md`:

```json
{ "status": "ok", "dependencies": { "database": "not_configured" } }
```

## 4. Start the frontend shell (FR-010, FR-016)

```bash
cd apps/web
npm install
npm run dev
```

Expected: dev server starts and reports a local URL (e.g.,
`http://localhost:3000`). Visiting it in a browser shows the default
starter page without errors.

## 5. Confirm independence of the two shells (Edge case: partial setup)

Stop the backend process and reload the frontend page. Expected: the
frontend shell still starts and serves its default page even with the
backend not running, demonstrating the two app boundaries don't have a
hidden startup dependency on each other in this phase.

## 6. Confirm next feature's spec convention (SC-005, User Story 3)

Expected: `specs/001-foundation/` is the pattern (`specs/<seq>-<short-name>/`
containing `spec.md`, `plan.md`, `research.md`, `data-model.md`,
`quickstart.md`, `contracts/`, `tasks.md`); Phase 2's feature will reuse this
same convention without modification.

## Done

If steps 1–6 all produce their expected results, this feature's success
criteria (SC-001–SC-005) are satisfied.
