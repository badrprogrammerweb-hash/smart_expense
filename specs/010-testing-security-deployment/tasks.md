---
description: "Task list for Phase 10 — Testing, Security Review, and Deployment"
---

# Tasks: Testing, Security Review, and Deployment

**Input**: Design documents from `/specs/010-testing-security-deployment/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: This phase's deliverable *is* tests plus a security review and deployment
readiness. The constitution (Principle XIV) makes security and financial-accuracy
tests part of "done"; plan.md and `contracts/test-coverage-matrix.md` enumerate every
required verifier.

**Organization**: Tasks are grouped by user story (US1–US5) for independent
implementation and verification.

## ⚠️ Non-negotiable scope rule (applies to EVERY task)

This phase MUST NOT modify product application code — the product runtime source under
`apps/api/app/**` and `apps/web` behavioral source (routes, components, services,
schemas, behavior-changing migrations). Deliverables are **net-new** artifacts only:
tests, fixtures, CI, the security review, the findings register, and deployment
config/docs. When any task surfaces a genuine product defect, **record a
findings-register row (`F-NNN`) and do NOT fix product code here** (FR-001, FR-003).
Container/build/CI files package and exercise the app without changing behavior and
are in scope.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US5 (setup/foundational/polish carry no story label)
- All paths are repository-relative.

## Path Conventions

Monolith: backend `apps/api/`, frontend `apps/web/`, deployment `infra/bunny/` +
`docs/`, CI `.github/workflows/`, phase deliverables
`specs/010-testing-security-deployment/`.

---

## Phase 1: Setup (Deliverable scaffolding)

**Purpose**: Create the living deliverable documents from their contracts so tasks
can fill them incrementally.

- [X] T001 [P] Create the remediation findings register `specs/010-testing-security-deployment/findings-register.md` from `contracts/findings-register.md` (severity legend, release-blocker rule, empty table with the E1 columns, and a "No findings recorded at phase completion." note)
- [X] T002 [P] Create the security-review skeleton `specs/010-testing-security-deployment/security-review.md` per `contracts/security-review.md` (header + Sections VI/VII/IX/X with each mandatory `SR-*` check id, blank verdict/evidence/finding_ref)
- [X] T003 [P] Create the manual AR/EN + RTL checklist `specs/010-testing-security-deployment/manual-ar-en-rtl-checklist.md` enumerating each core surface (dashboard, income/expense entry, reports/summaries, history, settings, AI review) × {Arabic, English} with pass/fail + notes columns
- [X] T004 [P] Register an `acceptance` pytest marker and a `tests/acceptance` path in the backend test config (`apps/api/pytest.ini` or `apps/api/pyproject.toml`, whichever the repo uses) so the new subpackage runs as a distinct selectable gate — test config only, no app code

**Checkpoint**: The three living deliverables exist as skeletons; the acceptance suite is selectable.

---

## Phase 2: Foundational (Blocking prerequisites)

**Purpose**: The deterministic seed world and AI stub that the backend acceptance tests share. Blocks US1 and US3.

**⚠️ CRITICAL**: No backend acceptance test can run until T005 exists.

- [X] T005 Create `apps/api/tests/acceptance/conftest.py`: a deterministic seed fixture (reusing the existing `apps/api/tests/conftest.py` `requires_supabase` / real local-Auth patterns) that builds **two workspaces owned by different users**, one member of workspace A per role (Owner/Admin/Member/Viewer), confirmed income + expenses, plus deleted, edited, draft/pending, and failed-AI records — with teardown; exposes helpers to sign in as each user/role (blocks US1, US3)
- [X] T006 [P] Add an AI-provider stub fixture in `apps/api/tests/acceptance/conftest.py` (inject an `httpx` transport per the Phase 8 stub pattern) so AI paths return deterministic success/error responses and never make a live external call (FR-024) (depends on T005)

**Checkpoint**: A shared, deterministic multi-workspace/multi-role world is seedable and AI calls are stubbed.

---

## Phase 3: User Story 1 - Prove financial accuracy and tenant isolation end-to-end (Priority: P1) 🎯 MVP

**Goal**: A cross-cutting acceptance suite that proves the two non-negotiables — correct financial totals and no cross-tenant access — across the seeded world.

**Independent Test**: Run `pytest apps/api/tests/acceptance/test_acc_financial_accuracy.py apps/api/tests/acceptance/test_acc_tenant_isolation.py`; every accuracy edge state holds and every cross-workspace/unauthenticated attempt is denied. Any failure becomes a findings-register row, not a code fix.

- [X] T007 [P] [US1] `apps/api/tests/acceptance/test_acc_financial_accuracy.py`: remaining balance = confirmed income − confirmed expenses; zero-income, zero-expense, and negative-balance states; money is integer minor units with no floating-point drift (FR-004, FR-007, FR-008, SC-001) (depends on T005)
- [X] T008 [US1] Extend `test_acc_financial_accuracy.py`: editing and deleting income/expenses immediately recalculates totals; deleted records excluded; draft/pending/failed AI records move zero totals; multi-workspace totals are independent (FR-005, FR-006, FR-018) (depends on T007)
- [X] T009 [P] [US1] `apps/api/tests/acceptance/test_acc_tenant_isolation.py`: a user of workspace A is denied **read** of workspace B's incomes, expenses, categories, files, reports, and history (FR-009, SC-002) (depends on T005)
- [X] T010 [US1] Extend `test_acc_tenant_isolation.py`: cross-workspace **write** denied; unauthenticated requests to protected resources denied; assert denial originates at the backend/RLS, not a frontend check (FR-010, FR-011, FR-012, SC-002) (depends on T009)
- [X] T011 [P] [US1] `apps/api/tests/acceptance/test_acc_readiness_smoke.py`: an end-to-end confirmed-only reconciliation smoke over the stitched flow (create → confirm → report equals dashboard) proving the assembled path is consistent (depends on T005)
- [X] T012 [US1] Update `contracts/test-coverage-matrix.md` financial-accuracy + tenant-isolation row statuses (`planned → implemented → passing`); for any failing assertion, add a finding to `findings-register.md` with area/severity and set its release-blocker flag (depends on T008, T010, T011)

**Checkpoint**: Financial accuracy and tenant isolation are proven (or every gap is a tracked, severity-rated finding). This is the MVP of the phase.

---

## Phase 4: User Story 2 - Produce a written security review of the MVP (Priority: P1)

**Goal**: A principle-indexed security review with a verdict and evidence per check, every failure logged as a finding.

**Independent Test**: `security-review.md` covers principles VI, VII, IX, X with PASS/FAIL/N-A verdicts, evidence/test cross-references, and a `finding_ref` on every FAIL.

- [X] T013 [US2] Complete Section VI (Privacy & Security) in `security-review.md`: verdict + evidence for BYOK key secrecy, private files/no public URL, backend-enforced permissions, RLS, no secrets in logs/errors; cross-reference `test_acc_ai_behavior.py`, `test_acc_file_privacy.py`, `test_extraction_secrecy.py`, `test_storage_error_sanitization.py` (FR-025, FR-027)
- [X] T014 [US2] Complete Section VII (Multi-Tenant Isolation) in `security-review.md`: verdicts cross-referencing the US1 isolation tests and existing `test_workspace_isolation.py`, `test_files_isolation.py`, `test_reports_isolation.py`, `test_history_access.py` (FR-025) (depends on T010)
- [X] T015 [US2] Complete Section IX (Architecture Authority) in `security-review.md`: verify backend owns calculations and authorization (frontend display-only), cross-referencing `test_acc_financial_accuracy.py`, `test_acc_role_permissions.py`, `test_reports_reconciliation.py` (FR-025)
- [X] T016 [US2] Complete Section X (Financial Accuracy) in `security-review.md`: integer-money, confirmed-only, edit/delete recalculation, edge-state coverage, cross-referencing the US1 accuracy tests and `test_extraction_totals.py`, `test_income_expense_edit_delete.py` (FR-025) (depends on T008)
- [X] T017 [US2] Complete the Findings Summary in `security-review.md` and mirror every FAIL into `findings-register.md` with severity + release-blocker flag; confirm 100% principle coverage (FR-026, FR-027, SC-008) (depends on T013, T014, T015, T016)

**Checkpoint**: A defensible, test-evidenced security review exists; all weaknesses are tracked findings.

---

## Phase 5: User Story 3 - Verify role permissions, file privacy, and AI behavior (Priority: P2)

**Goal**: Acceptance coverage of the role matrix, file privacy, and safe AI behavior, backend + UI.

**Independent Test**: Run the US3 backend + frontend specs; each role is confined to its intended actions, files stay private, and AI behaves safely with the key never leaked.

- [X] T018 [P] [US3] `apps/api/tests/acceptance/test_acc_role_permissions.py`: full Owner/Admin/Member/Viewer allow-deny matrix across income/expenses/categories/files/settings/AI/history; Viewer makes zero successful modifications (FR-013, FR-014, SC-003) (depends on T005)
- [X] T019 [P] [US3] `apps/api/tests/acceptance/test_acc_file_privacy.py`: files private by default with no public URL; access scoped to workspace membership; non-member and unauthenticated denied (FR-015, FR-016, SC-004) (depends on T005)
- [X] T020 [P] [US3] `apps/api/tests/acceptance/test_acc_ai_behavior.py`: BYOK key never in any API response/log/error; unconfirmed AI moves zero totals; provider error + invalid key produce a safe non-technical error with no data corruption; app fully usable with no key (FR-017, FR-018, FR-019, FR-020, SC-005) (depends on T005, T006)
- [X] T021 [P] [US3] `apps/web/e2e/acc-role-permissions.spec.ts`: role-gated UI surfaces deny/allow correctly (Viewer read-only) end-to-end (FR-013)
- [X] T022 [P] [US3] `apps/web/e2e/acc-file-privacy.spec.ts`: the UI never surfaces a public file URL for a financial document (FR-015)
- [X] T023 [US3] Update `contracts/test-coverage-matrix.md` role/file/AI row statuses and log any failures as findings with severity + release-blocker flag (depends on T018, T019, T020, T021, T022)

**Checkpoint**: Roles, file privacy, and AI safety are verified across backend and UI (or gaps are tracked findings).

---

## Phase 6: User Story 4 - Make production deployment documented and repeatable (Priority: P2)

**Goal**: Committed Bunny Magic Containers build config + a repeatable, secret-safe, cited deploy procedure a non-author can follow.

**Independent Test**: A person who did not write it follows `docs/deployment.md` + `infra/bunny/*` to build the images and dry-run the deploy with no undocumented steps; every env var/secret/service is listed; Bunny specifics are cited.

- [X] T024 [P] [US4] `infra/bunny/api.Dockerfile`: slim Python 3.12 `linux/amd64` image installing `apps/api/requirements.txt` and running `uvicorn app.main:app`, configured purely by environment variables (no baked secrets)
- [X] T025 [P] [US4] `infra/bunny/web.Dockerfile`: multi-stage Node `linux/amd64` image building and serving `apps/web` (production Next.js server), configured purely by `NEXT_PUBLIC_*` build/runtime env — without modifying `apps/web` application source
- [X] T026 [P] [US4] `infra/bunny/magic-containers.md`: platform config notes (registry type, endpoints, container ports, deployment option) with citations to the official Bunny docs and the two VERIFY-at-implementation items (env/secret mechanism, tag selection) flagged, not invented (FR-030)
- [X] T027 [US4] `docs/deployment.md`: the repeatable procedure per `contracts/deployment.md` — full env/secret inventory (grounded in `.env.example` + code), external-service list, cited Bunny steps, the production-migration step (`supabase/migrations/` → hosted project), and secret-hygiene note (no committed secrets) (FR-028, FR-029, FR-031) (depends on T024, T025, T026)
- [X] T028 [US4] Dry-run validation: build both images locally for `linux/amd64` and confirm each starts; have a non-author read `docs/deployment.md` for completeness (SC-009); record any gap or platform-specific defect as a `deployment`-area finding (FR-030a) (depends on T027)

**Checkpoint**: Deployment is documented, cited, secret-safe, and repeatable; build config is committed and validated by dry-run.

---

## Phase 7: User Story 5 - Verify Arabic/English and RTL UI behavior (Priority: P3)

**Goal**: Automated + manual confirmation that the core surfaces are correct in AR (RTL) and EN (LTR) with SAR formatting.

**Independent Test**: Run the localization specs and complete the manual checklist; Arabic is RTL, English is LTR, amounts use SAR, and no untranslated keys appear on core surfaces.

- [X] T029 [P] [US5] `apps/web/tests/unit/localization-rtl.test.tsx`: assert `dir="rtl"` under Arabic and `dir="ltr"` under English, SAR monetary formatting, and absence of raw untranslated message keys on core surfaces (FR-021, SC-006)
- [X] T030 [P] [US5] `apps/web/e2e/acc-localization-rtl.spec.ts`: toggle locale on the core routes (dashboard, income/expense, reports, history, settings, AI review) and assert direction + localized strings + SAR formatting (FR-021, SC-006)
- [X] T031 [US5] Execute the manual AR/EN + RTL checklist (`manual-ar-en-rtl-checklist.md`), record pass/fail per surface × locale, and log any visual/RTL defect as a `localization`-area finding (FR-021) (depends on T003, T029, T030)

**Checkpoint**: AR/EN + RTL correctness is verified automatically and by a human visual pass (or gaps are tracked findings).

---

## Phase 8: Polish & Cross-Cutting (CI, determinism, readiness)

**Purpose**: Wire everything into CI, prove determinism, and produce the readiness summary against the exit criteria.

- [X] T032 `.github/workflows/ci.yml`: on push/PR, start the Supabase local stack, apply migrations, install backend + frontend deps, run `pytest` (including `tests/acceptance`) and the frontend Vitest + Playwright suites with AI in stub mode (no external key), and publish pass/fail (FR-023, FR-024, SC-007) (depends on T007–T011, T018–T022, T029–T030)
- [X] T033 [P] Verify determinism: run the full backend + frontend acceptance suites twice from a clean seed and confirm identical, stable results (no flaky/environment-dependent pass-fail); document the single run command in `quickstart.md` if it drifted (FR-022) (depends on T032)
- [X] T034 Produce the readiness summary (append to `findings-register.md` per `contracts/findings-register.md`): suite results + CI link, finding counts by severity and area, an explicit statement for each exit criterion (MVP ready for review; no untracked tenant-isolation issues; no untracked financial-calculation issues; deployment documented and repeatable), and the list of release-blocker findings or "none" (FR-032, FR-033, SC-010) (depends on T012, T017, T023, T028, T031, T033)
- [X] T035 Final consistency pass: confirm every FR-004…FR-021 verification requirement in `contracts/test-coverage-matrix.md` has an `implemented`/`passing` verifier and no required guarantee is unverified; reconcile matrix, security review, and findings register (depends on T034)

**Checkpoint**: CI is green (or failures are tracked findings), suites are deterministic, and the readiness summary demonstrates the exit criteria.

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **Foundational (T005, T006)** blocks all backend acceptance tests (US1, US3).
- **US1 (P1)** and **US2 (P1)** are the core; US2 cross-references US1 tests (T014/T016 depend on US1 test tasks).
- **US3 (P2)**, **US4 (P2)**, **US5 (P3)** are independent of each other. US4 (deployment) has **no dependency on the test/foundational work** and can proceed in parallel from the start.
- **Polish (Phase 8)** depends on the test files existing (CI) and on all stories (readiness summary).

### Story independence

- US1: backend acceptance tests only — independently runnable once T005 exists.
- US2: documentation review — independently authored; richer when US1 tests exist to cite.
- US3: backend + frontend acceptance tests — independent once T005/T006 exist.
- US4: deployment config/docs — fully independent of the test tracks.
- US5: frontend localization tests + manual checklist — independent once T003 exists.

## Parallel Execution Examples

- After T005/T006: run **T007, T009, T011, T018, T019, T020** (distinct backend test files) in parallel; **T021, T022** (frontend e2e) in parallel.
- US4 build config: **T024, T025, T026** in parallel from the start (distinct files).
- Setup: **T001, T002, T003, T004** in parallel (distinct files).
- US5: **T029, T030** in parallel.

## Implementation Strategy

- **MVP scope**: Phase 1 → Phase 2 → **US1 (Phase 3)**. Proving financial accuracy
  and tenant isolation end-to-end is the minimum that satisfies the two non-negotiable
  exit criteria and delivers release confidence on its own.
- **Incremental delivery**: add US2 (security review) to make the MVP reviewable, then
  US3 (roles/files/AI), US4 (deployment), US5 (localization), then Polish (CI +
  readiness).
- **Findings discipline**: any failure in any task is recorded in
  `findings-register.md` (severity, area, release-blocker) and **never** fixed by
  editing product application code in this phase (FR-001, FR-003).

## Task summary

- **Total tasks**: 35
- **Setup**: 4 (T001–T004) · **Foundational**: 2 (T005–T006)
- **US1 (P1)**: 6 (T007–T012) · **US2 (P1)**: 5 (T013–T017) · **US3 (P2)**: 6 (T018–T023)
- **US4 (P2)**: 5 (T024–T028) · **US5 (P3)**: 3 (T029–T031) · **Polish**: 4 (T032–T035)
