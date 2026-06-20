# Phase 0 Research: Foundation and Repository Setup

All Technical Context items in `plan.md` were resolvable from the
implementation plan, the constitution, and standard practice for this stack
— no item required external clarification beyond what `/speckit-clarify`
already resolved. Each decision below addresses a concrete choice the plan
needed in order to be implementable.

## 1. Frontend package management & workspace tooling

**Decision**: Use npm with npm workspaces, with `apps/web` and
`packages/shared` registered as workspace members from a root
`package.json`.

**Rationale**: npm ships with Node.js, so no contributor needs to install an
additional package manager before following `docs/setup.md`. Workspaces let
`apps/web` reference `packages/shared` by package name without a publish
step, which keeps the "shared code" boundary (spec FR-004) real rather than
aspirational.

**Alternatives considered**: pnpm workspaces (faster, stricter, but adds a
tool contributors must install first — rejected for Phase 1 to minimize setup
friction; can be revisited later without changing the folder boundaries).
Yarn workspaces (comparable to npm; no material advantage for this scope).

## 2. Backend dependency management

**Decision**: Use a standard Python virtual environment (`venv`) plus a
`requirements.txt` in `apps/api`.

**Rationale**: Matches the constitution's plain "Python, FastAPI" constraint
without introducing an opinionated tool (Poetry/PDM) that a contributor must
separately install. `.gitignore` already excludes `.venv/`, `venv/`, `env/`,
confirming this was the anticipated approach.

**Alternatives considered**: Poetry (richer dependency resolution, but an
extra install step and lockfile format that isn't needed at this scope).

## 3. Scope of `packages/shared` for this phase

**Decision**: `packages/shared` holds documentation-only conventions and
constants in Phase 1 (e.g., naming/casing conventions, shared constants such
as default currency code). It does not attempt to generate or hand-author a
single type definition consumed identically by both TypeScript (frontend)
and Python (backend), since the two languages cannot literally share a type
without a codegen step.

**Rationale**: The implementation plan itself describes this boundary as
"shared types, validation contracts, constants, and documentation references
**where useful**" (non-prescriptive). Solving cross-language contract sharing
(e.g., OpenAPI-generated TypeScript client from the FastAPI schema) is a
concern of the phase that defines the first real API contract (Phase 2),
not the foundation phase. Deciding it now would be speculative.

**Alternatives considered**: Generating an OpenAPI client now — rejected as
premature; there is no real endpoint contract yet besides the health check,
which is simple enough to document by hand in `contracts/health-endpoint.md`.

## 4. Health endpoint contract shape

**Decision**: `GET /health` on the backend returns HTTP 200 with a JSON body
reporting overall status plus a per-dependency breakdown, where an
unconfigured dependency reports `"not_configured"` rather than causing a
non-200 response (resolves spec FR-017). The database dependency check looks
for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — Supabase-shaped names,
not a generic `DATABASE_URL` — since Supabase is the project's actual
eventual database (constitution §Technology Constraints); using a
mismatched generic name now would force a rename in Phase 2.

**Rationale**: A flat `{"status": "ok"}` would not satisfy FR-017's
requirement to explicitly surface "not configured" per dependency. Returning
200 regardless of dependency configuration (rather than 503) keeps "did the
process start" separate from "is everything wired up," which is exactly the
distinction the clarification session established.

**Alternatives considered**: HTTP 503 when a dependency is unconfigured —
rejected because it conflates "not yet configured" (expected during Phase 1)
with "broken," which contradicts the clarified behavior.

## 5. Environment variable documentation pattern

**Decision**: Each app keeps its own `.env.example` (`apps/web/.env.example`,
`apps/api/.env.example`) listing every variable it reads, with inline
comments stating purpose and whether a real value is required yet. A single
`docs/setup.md` cross-references both files and states explicitly which
variables are safe to commit (none — only `.example` files are committed)
versus which must stay local-only secrets.

**Rationale**: Per-app `.env.example` files keep each variable next to the
app that actually consumes it, satisfying FR-012 ("enumerate every
environment variable... without needing to read application source code").
This matches the existing `.gitignore` pattern (`.env`, `.env.*` ignored;
`.env.example`, `.env.*.example` explicitly un-ignored).

**Alternatives considered**: A single root `.env.example` for both apps —
rejected because it would blur which app needs which variable, especially
relevant for FR's edge case of a contributor configuring only one side.

## 6. Local process startup

**Decision**: Document two independent manual commands (one for `apps/web`,
one for `apps/api`) in `docs/setup.md`. No root-level orchestration script
(e.g., `concurrently`, Turborepo task graph) is introduced in this phase.

**Rationale**: Avoids adding build-orchestration tooling before there is
more than one real task per app to orchestrate. Two clearly documented
commands are simple enough to satisfy FR-010/FR-011 without speculative
tooling.

**Alternatives considered**: Turborepo — likely valuable once there are
multiple real build/test/lint tasks across packages, but premature for a
foundation phase with one trivial command per app.

## Outcome

All Technical Context fields in `plan.md` are resolved; no
`NEEDS CLARIFICATION` markers remain.
