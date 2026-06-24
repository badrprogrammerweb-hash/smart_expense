# Implementation Plan: Authentication and Workspace Foundation

**Branch**: `002-auth-workspace-foundation` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-auth-workspace-foundation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Provision Supabase Auth (email/password only) and the first real database
schema — `user_profiles`, `workspaces`, `workspace_memberships` — with Row
Level Security as the enforced tenant-isolation boundary, not an
application-only check. A signup trigger atomically gives every new user a
profile, a personal workspace, and Owner membership; FastAPI adds a thin
authorization layer (JWT verification, role-permission checks, friendly
error shapes) in front of a direct, RLS-respecting Postgres connection, and
exposes the workspace/membership endpoints needed to create and manage a
minimal (≤10-member) team workspace with fixed roles. No frontend UI is
built this phase (Phase 5) and no business records (income, expenses,
files, etc.) exist yet.

## Technical Context

**Language/Version**: Python 3.11+ for `apps/api` (extended this phase); SQL (Postgres 15, Supabase-managed) for `supabase/migrations/`. `apps/web` (TypeScript/Next.js 16) is untouched — Phase 5 builds its UI.

**Primary Dependencies**: FastAPI (existing); new — `PyJWT[crypto]` (JWKS-based Supabase JWT verification, research.md Decision 5), SQLAlchemy async engine + `asyncpg` (direct, RLS-respecting Postgres access, Decision 6). Supabase CLI for local Postgres/Auth (Decision 9, dev/test tooling, not an app dependency).

**Storage**: Supabase Postgres — first live schema this project has (`user_profiles`, `workspaces`, `workspace_memberships`), with RLS enabled on every table (data-model.md). Local dev/test uses the Supabase CLI's local stack; staging/production use a hosted Supabase project (provisioning itself is an implementation task, not a planning decision).

**Testing**: `pytest` + `pytest-asyncio` + `httpx` (ASGI transport) for route-level FastAPI tests; integration tests sign in as real local-Auth test users via the Supabase CLI stack to exercise RLS directly, satisfying SC-004/SC-005's "100% verified" requirement (Decision 9). Automated frontend testing remains deferred (no UI this phase).

**Target Platform**: Local development via Supabase CLI; hosted Supabase for staging/production (provisioning happens in its own implementation step, consistent with constitution Technology Constraints).

**Project Type**: Web application (frontend + backend) monolith — this phase's changes are confined to `apps/api` and `supabase/`; `apps/web` is unaffected.

**Performance Goals**: No raw throughput/latency target is specified by the spec — SC-001 (<2 min signup-to-workspace) and SC-003 (<3 min team-create-and-add) are end-to-end, human-paced task budgets, not API latency SLAs. No NEEDS CLARIFICATION: the spec intentionally measures user-task time, and a separate technical latency target isn't required to implement or test this phase.

**Constraints**: Team workspaces capped at 10 members (FR-030); personal workspaces are exactly 1 member, never more (Assumptions); fixed 4-role set, no custom roles (FR-010/FR-011); no workspace deletion/archival (FR-029); no social/SSO/magic-link/phone auth (FR-002); tenant isolation must be enforced at the database level, not application checks only (FR-025).

**Scale/Scope**: 3 new tables, ~7 new API endpoints (`GET/POST /workspaces`, `GET /workspaces/{id}`, `GET/POST /workspaces/{id}/members`, `PATCH/DELETE /workspaces/{id}/members/{user_id}`, `DELETE /workspaces/{id}/members/me`), 1 signup-bootstrap trigger, RLS policies on all 3 tables.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability this phase | Status |
|---|---|---|
| I. Core Product Principle | Auth + workspace foundation is explicitly in-scope MVP surface; no excluded feature added | PASS |
| III. MVP Scope Discipline | FR-026 explicitly excludes income/expense/categories/reports/files/AI/billing this phase | PASS |
| IV. Saudi-First Default | No UI exists yet this phase (Phase 5); nothing here contradicts SAR/Arabic/RTL defaults later | N/A |
| V. Manual-First, AI-Optional | No AI surface touched | N/A |
| VI. Privacy and Security | RLS on every table, JWT verification, no service-role key in the per-request hot path, no secrets in error responses (`contracts/session-validation.md`) | PASS |
| VII. Workspace & Multi-Tenant Isolation | Core focus of this phase: personal + minimal team workspaces, 4 fixed roles, RLS-enforced isolation | PASS |
| VIII. Storage and File Retention | No file upload exists yet (Phase 6) | N/A |
| IX. Architecture Authority | FastAPI owns authorization/role validation; Postgres (via RLS) is the enforced source of truth, not the frontend | PASS |
| X. Financial Accuracy | No money values exist yet (Phase 3+) | N/A |
| XI. Reports Integrity | No reports exist yet | N/A |
| XII. History Tracking | No history/audit trail requirement exists in this phase's spec; deferred to Phase 9 (master plan §14) | N/A |
| XIII. Future Monetization Readiness | No billing surface touched | N/A |
| XIV. Testing Requirements | RLS and role-permission outcomes tested against a real local Postgres/Auth stack, not mocks (research.md Decision 9), satisfying SC-004/SC-005 | PASS |
| XV. Scope Control | Every endpoint/table maps to an FR in spec.md; nothing speculative added | PASS |
| XVI. Spec-Kit Workflow | Spec → clarify → this plan, in order; no implementation has started | PASS |
| II. Budgeting Philosophy | No income/expense exists yet | N/A |

No violations identified. Complexity Tracking table is not applicable.

**Post-Phase 1 re-check**: `research.md` and `data-model.md` introduce RLS
policies, triggers, and a direct-Postgres-connection backend pattern that
keep authorization logic in FastAPI/Postgres, not the (still nonexistent)
frontend — consistent with Principle IX. The member-cap and last-Owner
triggers enforce FR-030/FR-017 at the database level, reinforcing Principle
VI/VII rather than weakening them. All gates above still PASS unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-workspace-foundation/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/
│   ├── session-validation.md        # Phase 1 output (/speckit-plan command)
│   ├── workspaces-api.md            # Phase 1 output (/speckit-plan command)
│   └── workspace-members-api.md     # Phase 1 output (/speckit-plan command)
└── tasks.md                         # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── <timestamp>_auth_workspace_foundation.sql   # user_profiles, workspaces,
│                                                    # workspace_memberships, RLS
│                                                    # policies, signup trigger,
│                                                    # member-cap + last-owner triggers
└── README.md                        # updated to describe the live schema

apps/api/
├── app/
│   ├── main.py                      # existing — registers new routers
│   ├── core/
│   │   ├── config.py                # NEW — SUPABASE_URL, SUPABASE_DB_URL,
│   │   │                            #   SUPABASE_SERVICE_ROLE_KEY, JWKS settings
│   │   └── auth.py                  # NEW — JWT verification + current-user
│   │                                #   dependency (contracts/session-validation.md)
│   ├── db.py                        # NEW — SQLAlchemy async engine/session,
│   │                                #   per-request RLS claim-setting (research.md
│   │                                #   Decision 4/6)
│   ├── routes/
│   │   ├── health.py                # existing, unchanged
│   │   ├── workspaces.py            # NEW — contracts/workspaces-api.md
│   │   └── workspace_members.py     # NEW — contracts/workspace-members-api.md
│   └── schemas/
│       └── workspaces.py            # NEW — Pydantic request/response models
├── requirements.txt                 # extended: PyJWT[crypto], SQLAlchemy, asyncpg
├── .env.example                     # extended: SUPABASE_DB_URL, JWKS-related settings
└── tests/
    ├── conftest.py                       # NEW — shared fixtures (research.md Decision 9)
    ├── test_signup_bootstrap.py          # NEW — US1
    ├── test_workspaces_list.py           # NEW — US1
    ├── test_workspace_isolation.py       # NEW — US4
    ├── test_workspace_members_list.py    # NEW — US4
    ├── test_workspaces_create.py         # NEW — US2
    ├── test_workspace_members_add.py     # NEW — US2
    ├── test_workspace_members_role.py    # NEW — US3
    ├── test_workspace_members_remove.py  # NEW — US3
    └── test_workspace_members_leave.py   # NEW — US3

apps/web/                            # unchanged this phase (Phase 5 builds the UI)
```

**Structure Decision**: Continue the monolith layout established in
Phase 1 (`apps/web`, `apps/api`, `supabase`). This phase's real work lands
in `apps/api` (new routers/auth/db layer) and `supabase/migrations`
(first live schema); `apps/web` is untouched because Phase 5 owns the
authentication UI per the master implementation plan's phase list. No new
top-level boundary is introduced.

## Complexity Tracking

> No Constitution Check violations were identified — this section is not applicable.
