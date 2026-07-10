# Implementation Plan: Testing, Security Review, and Deployment

**Branch**: `010-testing-security-deployment` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-testing-security-deployment/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Phase 10 is the MVP hardening and release-readiness phase. It adds **no product
features and modifies no product application code**. It produces four kinds of
net-new artifact on top of the assembled Phases 2–9 system:

1. **A cross-cutting acceptance test layer** — backend integration tests
   (`pytest` + `httpx` ASGI, the existing `apps/api/tests/` pattern) and frontend
   e2e/component tests (Playwright + Vitest, the existing `apps/web/` pattern) —
   that verifies the constitution non-negotiables *end-to-end across phases*
   (financial accuracy, tenant isolation, role permissions, file privacy, AI
   behavior, AR/EN + RTL). This layer **complements and gap-fills** the ~50 existing
   per-phase test files; it does not rewrite them. Coverage is anchored to an
   explicit test-coverage matrix mapping each constitution testing area + FR + SC to
   a concrete test artifact or manual checklist item.
2. **A GitHub Actions CI workflow** that spins up the Supabase local stack, seeds
   deterministic fixtures, runs the backend + frontend suites with AI provider calls
   stubbed, and surfaces pass/fail for a release decision.
3. **A written security review** of the assembled MVP against constitution
   principles VI (Privacy & Security), VII (Multi-Tenant Isolation), IX
   (Architecture Authority), and X (Financial Accuracy), plus a **remediation
   findings register** (Critical/High/Medium/Low) that is the mechanism by which
   "no known issues remain" means "all issues known and tracked."
4. **Production deployment readiness for Bunny Magic Containers** — committed
   container/build configuration (`apps/api` and `apps/web` Dockerfiles + platform
   config), a repeatable deploy procedure, an environment/secret inventory, and
   production-migration steps — with every Bunny-specific detail verified against the
   official Bunny docs and cited (not invented). This phase requires documentation +
   committed config validated by review/dry-run; it does **not** require executing a
   live production deploy.

**Non-negotiable scope boundary:** no edits to product runtime source under
`apps/api/app/**` or `apps/web` behavioral source (routes, components, services,
schemas, behavior-changing migrations). When a test or the security review finds a
real defect, it is logged in the findings register, not patched here. Container
build files and CI config package/run the app without changing its behavior and are
therefore in scope.

## Technical Context

**Language/Version**: No new product language surface. Test/tooling languages match
the existing stack: Python 3.12 (`pytest`, `pytest-asyncio`, `httpx`) for backend
acceptance tests under `apps/api/tests/`; TypeScript 5.7 (Playwright e2e, Vitest +
React Testing Library) for frontend tests under `apps/web/`; YAML for the GitHub
Actions workflow; Dockerfile syntax for container images; Markdown for the security
review, findings register, and deployment documentation. Bash/PowerShell for CI and
deploy helper scripts only (no product code).

**Primary Dependencies**: All already present — `pytest`, `pytest-asyncio`,
`httpx`, `sqlalchemy` + `asyncpg`, `python-dotenv` (backend tests, per
`apps/api/tests/conftest.py`); `@playwright/test`, `vitest`, `@testing-library/react`
(frontend, per `apps/web/playwright.config.ts` and `vitest.config.ts`); the Supabase
CLI (Docker) local stack; Docker for image builds. **No new application dependency,
and no new runtime dependency, is introduced.** CI uses the `supabase` CLI and the
standard GitHub Actions runners.

**Storage**: **No schema change and no new table.** This phase persists nothing to
Postgres. It reads existing data through existing endpoints/policies to verify
behavior. Test fixtures seed and tear down ephemeral rows in the local stack only.
The security review, findings register, and deployment docs are Markdown files in
the repo.

**Testing**: `pytest` route-level + integration tests signing in as real local-Auth
test users (existing `conftest.py` `requires_supabase` pattern) to exercise RLS,
roles, isolation, and financial math directly; Playwright e2e + Vitest component
tests for role gating, file privacy surfacing, AI empty/error states, and AR/EN +
RTL rendering. AI provider calls are stubbed/intercepted (the Phase 8 stubbed
`httpx` transport pattern) so no live external calls occur. A manual AR/EN + RTL
verification checklist supplements the automated UI tests.

**Target Platform**: Local dev via Supabase CLI Docker stack for test execution;
GitHub Actions Ubuntu runners for CI; **Bunny Magic Containers** (linux/amd64
container images from a private GitHub/Docker registry) for production deployment,
fronted by a hosted Supabase project. Browser (desktop + mobile web) for the web app.

**Project Type**: Web-application monolith (`apps/api` FastAPI + `apps/web`
Next.js), same layout as Phases 4–9. This phase is a verification/release wrapper
around it.

**Performance Goals**: No product performance SLA is added. The only operational
target is that the automated suites are **deterministic and repeatable** (no flaky,
environment-dependent pass/fail) so their result is trustworthy for a release
decision (FR-022).

**Constraints**:
- **No product-application-code changes (FR-001/003, NON-NEGOTIABLE):** deliverables
  are net-new tests, fixtures, CI config, security-review + findings docs, and
  deployment config/docs. Discovered defects are tracked, not fixed here.
- **Confirmed-only + integer money verification (constitution X, XI):** the
  financial-accuracy tests assert remaining balance = confirmed income − confirmed
  expenses across zero-income, zero-expense, negative-balance, edited, deleted,
  pending-draft, and failed-AI states, with no floating-point drift, across multiple
  workspaces and the viewer restriction.
- **Isolation verified at the enforcing layer (constitution VI/VII):** cross-
  workspace and unauthenticated access are asserted denied by the backend/RLS, not
  by frontend checks (FR-012).
- **AI-key secrecy (constitution VI, XIV):** tests assert the BYOK key never appears
  in any API response, frontend payload, log, or error message, reusing the Phase 8
  secrecy-test pattern (FR-017).
- **Deterministic, offline AI tests (FR-024):** provider calls stubbed; suites run
  against the seeded local stack only.
- **Deployment truthfulness (FR-030):** every Bunny-specific step is cited to the
  official docs; uncertain specifics are marked as verify-against-docs, never
  asserted from memory. Secrets are supplied at deploy time, never committed
  (FR-029).
- **Readiness gate (FR-033, clarified):** all findings tracked satisfies the phase
  exit criteria; any open Critical/High financial-accuracy or tenant-isolation
  finding is additionally flagged as a release blocker for follow-up remediation.

**Scale/Scope**: ~10–14 net-new backend acceptance test files + ~4–6 frontend
e2e/component test files, 1 shared deterministic fixture/seed module, 1 GitHub
Actions workflow, 1 security-review doc, 1 findings register, 1 deployment guide,
2 Dockerfiles + 1 platform/compose config, and 1 manual AR/EN + RTL checklist. **Zero
changes to any `apps/api/app/**` or `apps/web` behavioral source and zero database
migrations.**

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Core Product Principle | PASS | Adds no product surface; verifies the existing MVP surface and prepares its release. No accounting/banking/ledger behavior introduced. |
| II. Budgeting Philosophy | PASS | Financial-accuracy tests assert the remaining-balance formula (confirmed income − confirmed expenses) rather than changing it. |
| III. MVP Scope Discipline | PASS | Only testing, security review, and deployment prep. Performance/load/pen-testing, CD automation, and product-code fixes are explicitly out of scope (FR-034). |
| IV. Saudi-First | PASS | Dedicated AR/EN + RTL + SAR-formatting verification (automated + manual checklist) on the core surfaces (FR-021, SC-006). |
| V. Manual-First, AI-Optional | PASS | Tests assert full usability with no AI key and that AI actions are simply unavailable then (FR-020); AI provider calls are stubbed. |
| VI. Privacy and Security | PASS | Dedicated security review + tests for BYOK key secrecy, private files/no public URLs, and backend/DB enforcement of every protected action (FR-015–019, FR-025–027). |
| VII. Multi-Tenant Isolation | PASS | Cross-workspace and unauthenticated denial verified at backend/RLS across all record types (FR-009–012, SC-002); a non-negotiable exit criterion. |
| IX. Architecture Authority | PASS | Tests assert enforcement happens on the backend/database, not the frontend (FR-012); no logic is moved into the frontend. This phase writes only tests/docs/deploy config. |
| X. Financial Accuracy (NON-NEGOTIABLE) | PASS | Cross-cutting accuracy suite covers every constitution-listed edge state with integer-money assertions and no floating point (FR-004–008, SC-001); a non-negotiable exit criterion. |
| XI. Reports Integrity | PASS | Confirmed-only guarantee re-verified end-to-end: drafts/pending/failed never appear as spending (FR-005, FR-018). |
| XII. History Tracking | PASS | History isolation/visibility re-verified via existing surfaces; no change to history semantics. |
| XIII. Future Monetization Readiness | PASS | No billing added; deployment config is additive and plan-agnostic. |
| XIV. Testing Requirements | PASS | This phase *is* the constitution's testing mandate made explicit and cross-cutting: auth, workspace access, roles, income/expense/balance accuracy, file privacy, AI-key security, AI review, AR/EN + RTL, and tenant isolation are each covered and matrixed. |
| XV / XVI. Scope Control / Spec-Kit | PASS | Focused release-readiness spec; out-of-scope enumerated (FR-034); sequenced after Phase 9 per the implementation plan; follows constitution → spec → plan → tasks order. |

**No violations.** The one item that could look like a violation — adding
Dockerfiles and CI under the repo — is deliberately *not* a change to product
runtime behavior: container/build/CI files package and exercise the app without
altering `apps/api/app/**` or `apps/web` source. Complexity Tracking is
intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/010-testing-security-deployment/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output — artifact schemas (no DB entities)
├── quickstart.md        # Phase 1 output — how to run the suites + validate deploy docs
├── contracts/           # Phase 1 output
│   ├── test-coverage-matrix.md   # constitution area + FR + SC -> concrete test artifact / checklist
│   ├── findings-register.md      # authoritative register format (id, area, severity, status, owner)
│   ├── security-review.md        # security-review document structure (per-principle VI/VII/IX/X)
│   └── deployment.md             # deployment contract: env/secret inventory, Bunny steps (cited), migrations
├── checklists/
│   └── requirements.md  # Spec quality checklist (/speckit-specify output)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
└── tests/                              # EXISTING pytest suite (~50 files) — NOT rewritten
    ├── acceptance/                     # NEW: cross-cutting acceptance layer (new subpackage)
    │   ├── conftest.py                 # NEW: shared multi-workspace/multi-role deterministic seed fixtures
    │   ├── test_acc_financial_accuracy.py    # NEW: remaining balance across zero/negative/edited/deleted/draft/failed states (FR-004..008, SC-001)
    │   ├── test_acc_tenant_isolation.py      # NEW: cross-workspace + unauthenticated denial across incomes/expenses/categories/files/reports/history (FR-009..012, SC-002)
    │   ├── test_acc_role_permissions.py      # NEW: full Owner/Admin/Member/Viewer allow-deny matrix; viewer read-only (FR-013/014, SC-003)
    │   ├── test_acc_file_privacy.py          # NEW: private-by-default, no public URL, membership-scoped access (FR-015/016, SC-004)
    │   ├── test_acc_ai_behavior.py           # NEW: key never leaked; drafts move zero totals; provider/invalid-key safe error; no-key usability (FR-017..020, SC-005)
    │   └── test_acc_readiness_smoke.py       # NEW: end-to-end confirmed-only reconciliation smoke across the stitched flow
    └── ...                             # existing per-phase tests unchanged

apps/web/
├── e2e/                                # EXISTING Playwright specs — NOT rewritten
│   ├── acc-role-permissions.spec.ts    # NEW: role-gated UI surfaces deny/allow (viewer read-only) e2e
│   ├── acc-file-privacy.spec.ts        # NEW: no public file URL exposed in the UI
│   └── acc-localization-rtl.spec.ts    # NEW: AR(RTL)/EN(LTR) rendering + SAR formatting on core surfaces (FR-021, SC-006)
└── tests/unit/                         # EXISTING Vitest — NOT rewritten
    └── localization-rtl.test.tsx        # NEW: component-level locale/dir/SAR assertions, no untranslated keys

.github/
└── workflows/
    └── ci.yml                          # NEW: Supabase local stack + backend pytest + frontend vitest/playwright, AI stubbed (FR-023/024, SC-007)

infra/
└── bunny/
    ├── api.Dockerfile                  # NEW: linux/amd64 image for apps/api (FastAPI/uvicorn)
    ├── web.Dockerfile                  # NEW: linux/amd64 image for apps/web (Next.js standalone)
    └── magic-containers.md             # NEW: platform config notes (endpoints/ports/registry) cited to Bunny docs
        # (Dockerfiles may instead live beside each app as apps/api/Dockerfile / apps/web/Dockerfile;
        #  final location is chosen in tasks — either way they are net-new build config, not app source)

docs/
└── deployment.md                       # NEW: repeatable Bunny deploy procedure, env/secret inventory,
                                        #   external services, production migration steps (FR-028..031, SC-009)

specs/010-testing-security-deployment/
├── security-review.md                  # NEW (living deliverable): review vs principles VI/VII/IX/X (FR-025..027, SC-008)
├── findings-register.md                # NEW (living deliverable): Critical/High/Medium/Low findings (FR-026/032, SC-010)
└── manual-ar-en-rtl-checklist.md       # NEW: manual visual/RTL verification checklist (FR-021)
```

**Structure Decision**: Web-application monolith, same layout as Phases 4–9. New
backend acceptance tests live in a new `apps/api/tests/acceptance/` subpackage so
they are clearly separable from the untouched per-phase suites and can share one
deterministic multi-workspace/multi-role seed fixture; new frontend tests extend the
existing `apps/web/e2e/` and `apps/web/tests/unit/` locations. CI is a single
GitHub Actions workflow. Deployment build config lives under `infra/bunny/` (with
`docs/deployment.md` as the human procedure), keeping all release artifacts out of
`apps/*/app`/component source so the no-application-code-change rule holds by
construction. The security review, findings register, and manual checklist live in
the feature's spec directory as durable, reviewable deliverables.

## Complexity Tracking

> No constitution violations — this table is intentionally empty. The only added
> repository surface beyond tests/docs (Dockerfiles + a CI workflow) is deployment/
> build tooling that packages and exercises the existing app without modifying any
> product runtime source, and is explicitly in scope for a deployment phase.
