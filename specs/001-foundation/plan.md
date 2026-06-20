# Implementation Plan: Foundation and Repository Setup

**Branch**: `001-foundation` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-foundation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Establish the monolith repository's top-level boundaries (frontend, backend,
shared code, database artifacts, specs, docs, deployment, tests — already
scaffolded as empty placeholders) and turn them into a confirmed-working
local development baseline: a minimal runnable Next.js frontend shell, a
minimal runnable FastAPI backend shell with a dependency-aware health
endpoint, and practical setup documentation covering every environment
variable a contributor needs, with an explicit secret-vs-committed
distinction. No business logic, authentication, or live external service
connection is introduced — this phase only proves the toolchain works
end-to-end so Phase 2 can build on a known-good baseline.

## Technical Context

**Language/Version**: TypeScript (Next.js 14 / React 18) for `apps/web`; Python 3.11+ for `apps/api`

**Primary Dependencies**: Next.js 14, React, Tailwind CSS, Shadcn UI (frontend, per constitution Technology Constraints); FastAPI, Uvicorn (backend)

**Storage**: N/A this phase — Supabase Postgres/Auth/Vault/Storage are the project's eventual source of truth (constitution §Technology Constraints) but no live project is provisioned or connected in Phase 1 (per spec Assumptions and FR-017)

**Testing**: Manual validation via `quickstart.md` this phase only (start both shells, confirm health response); automated test framework selection (e.g., pytest, Vitest/Playwright) is deferred to the phase that introduces the first real business logic, since Phase 1 has no business logic to test

**Target Platform**: Local development (Windows/macOS/Linux) now; container-based hosting (Bunny Magic Containers, per constitution) is configured later in Phase 10 — out of scope here

**Project Type**: Web application (frontend + backend), monolith repository

**Performance Goals**: N/A this phase — no business workload exists yet

**Constraints**: Must remain a single monolith (constitution: Architecture = Monolith repository); backend health endpoint must start and respond successfully with zero external service credentials configured (spec FR-017); no real secret values may be committed (spec FR-013)

**Scale/Scope**: One frontend shell, one backend shell, one shared-code placeholder, one setup doc — no data entities, no multi-tenant records (those begin in Phase 2)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability this phase | Status |
|---|---|---|
| I. Core Product Principle | No product feature added; repo/setup only | PASS |
| III. MVP Scope Discipline | No excluded feature (billing, banking, etc.) touched | PASS |
| IV. Saudi-First Default | UI/locale work belongs to Phase 5; no contradiction introduced now | PASS (N/A) |
| V. Manual-First, AI-Optional | No AI code introduced | PASS (N/A) |
| VI. Privacy and Security | `.env.example` pattern only; `.gitignore` already excludes real `.env*`; no secrets committed | PASS |
| VII. Workspace & Multi-Tenant Isolation | No business records exist yet (starts Phase 2) | N/A |
| VIII. Storage and File Retention | No file upload exists yet (starts Phase 6) | N/A |
| IX. Architecture Authority | Backend owns its own health/status logic; frontend has no calculation logic to misplace | PASS |
| X. Financial Accuracy | No money values exist yet (starts Phase 3) | N/A |
| XIV. Testing Requirements | Scoped to manual quickstart validation; full testing regime begins where business logic begins (Phase 3+) | PASS (scoped) |
| XVI. Spec-Kit Workflow | This plan follows the constitution-mandated specify → plan → tasks → implement order | PASS |
| II. Budgeting Philosophy, XI. Reports Integrity, XII. History Tracking, XIII. Future Monetization Readiness, XV. Scope Control | No budgeting, reports, history, monetization, or category surface exists yet — none of these principles have anything to apply to in this phase | N/A |

No violations identified. Complexity Tracking table is not applicable.

**Post-Phase 1 re-check**: `data-model.md`, `contracts/health-endpoint.md`,
and `quickstart.md` introduce no business entities, no secret values, and no
deviation from the monolith boundary — all gates above still PASS unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/001-foundation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── health-endpoint.md   # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/web/                     # Next.js 14 frontend shell (App Router)
├── app/
│   └── page.tsx               # default starter page (spec FR-016)
├── package.json
├── tsconfig.json
├── next.config.js
├── .env.example                # documents NEXT_PUBLIC_* values (spec FR-012, FR-013)
└── README.md                  # replaces current placeholder

apps/api/                      # FastAPI backend shell
├── app/
│   ├── main.py                 # FastAPI app instance
│   └── routes/
│       └── health.py           # GET /health — dependency-aware status (spec FR-017)
├── requirements.txt
├── .env.example                # documents backend env values (spec FR-012, FR-013)
└── README.md                  # replaces current placeholder

packages/shared/                # cross-cutting constants/conventions (docs-only this phase)
└── README.md                  # replaces current placeholder; explains scope limits

supabase/                       # migrations/RLS/storage policy notes (no live project yet)
└── README.md                  # replaces current placeholder

docs/
├── implementation-plan.md       # existing
└── setup.md                    # NEW — env vars, startup steps, secret-vs-committed (spec FR-006, FR-010–FR-014)

infra/
└── README.md                  # placeholder retained; real deployment config arrives Phase 10

tests/
└── README.md                  # placeholder retained; cross-app test strategy doc arrives with first tested feature
```

**Structure Decision**: Monolith "web application" layout (frontend + backend
in one repository), using the real paths already established as empty
boundaries (`apps/web`, `apps/api`, `packages/shared`, `supabase`, `docs`,
`infra`, `tests`) rather than the template's generic `backend/`/`frontend/`
placeholders. This phase fills `apps/web` and `apps/api` with a minimal
runnable skeleton and adds `docs/setup.md`; it does not restructure any
top-level boundary, since the spec (FR-001–FR-009) requires those boundaries
to already be unambiguous and stable for every later phase.

## Complexity Tracking

> No Constitution Check violations were identified — this section is not applicable.
