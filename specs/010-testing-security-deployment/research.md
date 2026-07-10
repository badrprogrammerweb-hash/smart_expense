# Phase 0 Research: Testing, Security Review, and Deployment

This phase adds no product code, so research centers on **how to verify** the
existing system and **how to deploy** it, not on new design. All decisions below are
resolved (no open NEEDS CLARIFICATION remains).

## R1. Acceptance-test layering: gap-fill vs rewrite

**Decision**: Add a new `apps/api/tests/acceptance/` subpackage and a handful of new
`apps/web/e2e/` + `apps/web/tests/unit/` specs that exercise the assembled system
end-to-end and cross-phase. Do **not** modify or replace the ~50 existing per-phase
test files.

**Rationale**: Phases 2–9 already ship dedicated per-phase suites (verified present:
`test_income_expense_edit_delete.py`, `test_workspace_isolation.py`,
`test_files_access_privacy.py`, `test_extraction_secrecy.py`,
`test_reports_reconciliation.py`, `test_history_access.py`, etc.). Re-implementing
those would be wasted effort and would risk diverging from the behavior they already
pin. The gap this phase fills is *cross-cutting*: a single seeded world with multiple
workspaces and all four roles, asserting the non-negotiables hold when features are
combined (e.g., a viewer in workspace A cannot touch workspace B's files while a
draft AI extraction is pending). A new subpackage with its own shared fixture keeps
this separable and lets `pytest apps/api/tests/acceptance` run as a distinct gate.

**Alternatives considered**: (a) One mega-test file — rejected: unreadable, hard to
map to FRs. (b) Editing existing per-phase files to add cross-cutting cases —
rejected: muddies per-phase ownership and risks touching more than intended.

## R2. Deterministic, offline test execution

**Decision**: Backend acceptance tests reuse the existing `conftest.py`
`requires_supabase` pattern (real local-Auth users against the Supabase CLI Docker
stack) with a new shared fixture that seeds a fixed multi-workspace/multi-role world
and tears it down. AI provider calls are stubbed with the Phase 8 injected-`httpx`
transport so no live external request is ever made. Frontend e2e seeds via the same
backend/local stack (the Phase 5/8 e2e seeding approach).

**Rationale**: Determinism is an explicit requirement (FR-022, FR-024). Live AI
calls would make tests flaky, slow, costly, and dependent on a third party — and
would risk leaking a real key into CI. The stack + stub pattern is already proven in
the repo.

**Alternatives considered**: Mocking the DB layer entirely — rejected: would not
exercise RLS/policies, which is the whole point of the isolation tests.

## R3. CI system and pipeline shape

**Decision**: GitHub Actions, one workflow at `.github/workflows/ci.yml`. Steps:
check out; set up Python 3.12 + Node; install the Supabase CLI and `supabase start`
(or use the Supabase-provided GitHub Action) to bring up the local stack; apply
migrations; install backend + frontend deps; run `pytest` (incl. the acceptance
subpackage) and the Vitest suite; run Playwright e2e; upload results. AI env is set
to stub mode so no external key is needed.

**Rationale**: The repo is on GitHub and uses `gh`; GitHub Actions is the
zero-friction, no-new-vendor choice and was chosen in clarification. The Supabase CLI
already backs local testing, so CI mirrors local exactly.

**Alternatives considered**: GitLab CI / CircleCI — rejected: not where the repo
lives. A hosted Supabase test project for CI — rejected for the default: slower to
provision per-run and risks shared-state flakiness; the local stack is deterministic.

## R4. Security-review methodology

**Decision**: A structured, checklist-driven manual review documented in
`specs/010-.../security-review.md`, organized by constitution principles VI (Privacy
& Security), VII (Multi-Tenant Isolation), IX (Architecture Authority), and X
(Financial Accuracy). Each principle expands into concrete checks (e.g., "BYOK key
never in an API response/log/error", "files private, no public URL", "every
protected action enforced on backend/DB", "money is integer minor units, confirmed-
only"). Each check gets a PASS / FAIL / N-A verdict, evidence (code path or test
reference), and, on FAIL, a linked findings-register entry. Automated checks in the
acceptance suite are cross-referenced so the review is partly test-backed, not purely
narrative.

**Rationale**: The constitution mandates security/financial testing as part of
"done" (XIV) and the exit criterion is "MVP ready for review." A principle-indexed
review is directly traceable to governance and to the automated tests. This is an
internal review, not a third-party audit or pen-test (out of scope, FR-034).

**Alternatives considered**: An external audit or automated SAST/DAST scan —
rejected for MVP scope; may be a future follow-up. A free-form prose review —
rejected: not traceable to principles or findings.

## R5. Findings register model

**Decision**: A single Markdown table in `specs/010-.../findings-register.md`. Fields
per finding: **ID** (`F-NNN`), **Title**, **Area** (financial-accuracy / tenant-
isolation / role-permissions / file-privacy / ai-behavior / localization /
deployment / other), **Severity** (Critical / High / Medium / Low), **Source**
(failing test id or review check), **Reproduction**, **Status** (Open / Triaged /
Deferred / Fixed-elsewhere), **Remediation owner/target**, **Release-blocker?**
(yes/no). A finding is a release blocker iff it is Critical or High in the financial-
accuracy or tenant-isolation area.

**Rationale**: Makes "no known issues remain" operational: it means "no *untracked*
issues" — every issue has an ID, severity, and status. Severity scale fixed to four
levels in clarification. Release-blocker flag implements the clarified readiness gate
(FR-033) without requiring in-phase code fixes.

**Alternatives considered**: GitHub Issues instead of a Markdown register — viable
and can be mirrored, but the in-repo register is the source of truth for the phase's
readiness summary and reviewable in the same PR.

## R6. Arabic/English + RTL verification

**Decision**: Automated + manual. Automated: a Vitest component test asserting
`dir="rtl"` under Arabic and `dir="ltr"` under English, SAR formatting, and absence
of raw untranslated message keys on core surfaces; a Playwright spec toggling locale
on the core routes. Manual: a written checklist
(`manual-ar-en-rtl-checklist.md`) enumerating each core surface (dashboard, income/
expense entry, reports/summaries, history, settings, AI review) × {AR, EN} for a
human visual pass on layout mirroring and truncation.

**Rationale**: Automated tests catch missing keys and direction regressions cheaply
and repeatably (FR-021); visual RTL correctness (mirroring, alignment, icon flips)
still benefits from a human eye, hence the checklist. Matches the constitution's
AR/EN + RTL testing requirement (XIV) and Saudi-first principle (IV).

**Alternatives considered**: Screenshot/visual-regression tooling — rejected for MVP:
adds a dependency and flakiness; the checklist + assertions suffice.

## R7. Bunny Magic Containers deployment (verified against official docs)

**Decision / verified facts** (from https://docs.bunny.net/magic-containers and its
sub-pages, fetched 2026-07-09):

- **Registry**: A **private container registry must be configured first** (GitHub or
  Docker registry types are supported). Source:
  https://docs.bunny.net/docs/magic-containers-how-to-configure-private-container-registry-integration
- **Image platform**: **`linux/amd64` only** is supported. Both Dockerfiles must
  build amd64 images.
- **Create app**: Dashboard → **Magic Containers → Add App**; name the app; choose a
  deployment option — **Magic** (auto-provision/scale globally), **Single Region**
  (one region, no autoscale), or **Advanced** (base vs enabled regions, min/max
  instances, max 10 per region). Source:
  https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app
- **Container config**: **Add Container** → select image + tag from the registry;
  configure **Endpoints** for internet access (unique endpoint name; expose via CDN
  or Anycast; define the **container port** the app listens on; SSL for CDN
  endpoints).
- **Multi-container pod**: multiple containers can share one pod/sandbox and reach
  each other over `localhost` (relevant if api + web are co-deployed).
- **Trial limits**: valid payment card required to unlock trial features; trial
  limited to five regions and up to two instances per region. Source:
  https://docs.bunny.net/docs/magic-containers-getting-started

**Explicitly marked as VERIFY-AT-IMPLEMENTATION (docs did not state in the fetched
pages)**: exact mechanism/UI for **environment variables and secrets**, and image
**tag selection** specifics. The deployment doc/tasks MUST confirm these against the
current Bunny dashboard/docs at implementation time and MUST NOT invent a syntax.

**Rationale**: The advisor and FR-030 require Bunny specifics to be cited, not
fabricated. The above are quoted from the official docs; the two unknowns are flagged
rather than guessed.

**Alternatives considered**: Pinning an exact CLI/manifest recipe now — rejected:
the fetched docs are dashboard-oriented and did not confirm a stable CLI/manifest for
env/secrets; asserting one would violate FR-030.

## R8. Container images for FastAPI and Next.js

**Decision**: `apps/api` → a slim Python 3.12 image running `uvicorn app.main:app`,
installing `apps/api/requirements.txt`, built for `linux/amd64`. `apps/web` → a
multi-stage Node build serving the production Next.js server (`next start`), built for
`linux/amd64`. If the smaller **standalone** output is desired it is used only when it
can be enabled without editing `apps/web` product source (per FR-001); otherwise the
Dockerfile serves the standard production build. Both images are parameterized purely
by environment variables (no baked secrets).

**Rationale**: Standard, minimal images matching the existing stack; amd64 satisfies
the Bunny constraint from R7. This is build config, not product code, and does not
require touching `apps/web` behavioral source.

**Alternatives considered**: A single combined image — possible given multi-container
pods, but two images keep api/web independently scalable and mirror the monorepo
split.

## R9. Environment / secret inventory and production migrations

**Decision**: Enumerate required config from the actual codebase (verified):

- **Backend (`apps/api`)**: `SUPABASE_URL`, `SUPABASE_DB_URL` (secret),
  `SUPABASE_SERVICE_ROLE_KEY` (secret), `SUPABASE_JWT_SECRET` (secret),
  `CORS_ALLOW_ORIGINS`, `APP_ENV`.
- **Frontend (`apps/web`)**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (all public, non-secret by design).
- **BYOK AI keys** are per-workspace user secrets stored in Supabase Vault (Phase 7)
  — not a deploy-time env var.

Production migrations: apply the tracked `supabase/migrations/` to the hosted
Supabase project as a documented, repeatable step (e.g., `supabase db push` / linked
project migration) executed before/with the deploy; the deploy doc pins the exact
command and order.

**Rationale**: FR-029/FR-031 require a complete, secret-safe inventory and a
documented production-migration step. Values are taken from `.env.example` files and
`os.getenv`/`process.env` usage, so the inventory is grounded, not guessed. Secrets
are supplied via Bunny's env/secret mechanism at deploy time (never committed).

**Alternatives considered**: Baking config into images — rejected: violates secret
hygiene and makes images environment-specific.

## Sources

- [Magic Containers — bunny.net Documentation](https://docs.bunny.net/magic-containers)
- [Quickstart / Getting Started](https://docs.bunny.net/docs/magic-containers-getting-started)
- [Deploying your app](https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app)
- [Configuring private container registry integration](https://docs.bunny.net/docs/magic-containers-how-to-configure-private-container-registry-integration)
