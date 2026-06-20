---

description: "Task list for Foundation and Repository Setup (001-foundation)"
---

# Tasks: Foundation and Repository Setup

**Input**: Design documents from `/specs/001-foundation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not included — the spec's Technical Context scopes this phase to manual `quickstart.md` validation only; no automated test framework is selected until the phase that introduces real business logic (Phase 2 onward).

**Organization**: Tasks are grouped by user story (US1, US2, US3 from `spec.md`) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in each description

## Path Conventions

Monolith web application layout per `plan.md`: `apps/web` (frontend),
`apps/api` (backend), `packages/shared` (cross-cutting), `supabase`,
`specs`, `docs`, `infra`, `tests` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization needed before any story-specific work

- [X] T001 Initialize root `package.json` at repository root declaring npm workspaces for `apps/web` and `packages/shared` (research.md decision 1; supports FR-004)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core verification that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Verify the repository's top-level boundaries exactly match `plan.md`'s Project Structure (`apps/web`, `apps/api`, `packages/shared`, `supabase`, `specs`, `docs`, `infra`, `tests` — no extra or missing top-level directories) and confirm no top-level directory declares independent versioning/publishing (e.g., no standalone `.git`, no `apps/*` package configured for separate release) at repository root (FR-001–FR-009)

**Checkpoint**: Foundation verified — user story implementation can now begin

---

## Phase 3: User Story 1 - Start the project from a clear repository layout (Priority: P1) 🎯 MVP

**Goal**: A contributor can identify, from the top-level layout alone, exactly one place for frontend code, backend code, database artifacts, shared code, specs, docs, deployment config, and test strategy docs (SC-001).

**Independent Test**: Clone the repository fresh and verify, from the top-level layout alone, that the location for each kind of work is unambiguous (per `quickstart.md` step 1).

### Implementation for User Story 1

- [X] T003 [P] [US1] Replace placeholder text in `apps/web/README.md` with a purpose statement: owns Next.js 14 frontend application code (FR-001)
- [X] T004 [P] [US1] Replace placeholder text in `apps/api/README.md` with a purpose statement: owns FastAPI backend application code (FR-002)
- [X] T005 [P] [US1] Replace placeholder text in `packages/shared/README.md` with a purpose + scope statement: cross-cutting constants/conventions, documentation-only in this phase per research.md decision 3 (FR-004)
- [X] T006 [P] [US1] Replace placeholder text in `supabase/README.md` with a purpose statement: owns DB migrations, RLS policy files, and storage policy notes; no live project provisioned yet (FR-003)
- [X] T007 [P] [US1] Replace placeholder text in `infra/README.md` with a purpose statement: owns deployment configuration and environment notes; real deployment config arrives in Phase 10 (FR-007)
- [X] T008 [P] [US1] Replace placeholder text in `tests/README.md` with a purpose statement: owns cross-application testing strategy documentation (FR-008)
- [X] T009 [US1] Validate User Story 1 independently per `quickstart.md` step 1: confirm a contributor can identify all eight boundary purposes from the top-level directory names alone, without opening any README, within 2 minutes — then confirm each README written in T003-T008 states the same purpose without contradiction (SC-001)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Set up a working local development environment (Priority: P1)

**Goal**: A contributor can follow only the written setup documentation to get both the frontend and backend application shells running locally on a clean machine (SC-002, SC-003, SC-004).

**Independent Test**: Follow only `docs/setup.md` on a clean checkout and successfully start both application shells (per `quickstart.md` steps 2-5).

### Implementation for User Story 2

- [ ] T010 [P] [US2] Scaffold minimal Next.js 14 app shell in `apps/web` (`package.json`, `tsconfig.json`, `next.config.js`, `app/page.tsx` default starter page) per FR-016
- [ ] T011 [P] [US2] Scaffold minimal FastAPI app shell in `apps/api` (`app/main.py`, `requirements.txt` pinning `fastapi` + `uvicorn`) per FR-016
- [ ] T012 [US2] Implement `GET /health` route in `apps/api/app/routes/health.py` per `contracts/health-endpoint.md`, reading `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and reporting `"not_configured"` unless both are present (depends on T011; FR-017)
- [ ] T013 [P] [US2] Create `apps/web/.env.example` documenting every frontend environment variable and its purpose (FR-012, FR-013)
- [ ] T014 [P] [US2] Create `apps/api/.env.example` documenting every backend environment variable and its purpose, including `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the Supabase-shaped connection values defined in `contracts/health-endpoint.md`), marked as not required to start (FR-012, FR-013, FR-014)
- [ ] T015 [US2] Write `docs/setup.md` covering prerequisites, both `.env.example` files, the startup command for each shell, what "started successfully" looks like for each, the secret-vs-committed distinction, and which steps run in a degraded/"not configured" mode without external credentials (depends on T010-T014; FR-006, FR-010, FR-011, FR-012, FR-013, FR-014)
- [ ] T016 [US2] Validate User Story 2 independently per `quickstart.md` steps 2-5: both shells start using only documented steps, `GET /health` returns the documented `"not_configured"` response with zero external credentials configured, and the frontend shell keeps working when the backend is stopped (depends on T015; SC-002, SC-003, SC-004)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently — this is the MVP-equivalent local dev loop

---

## Phase 5: User Story 3 - Know where the next feature's spec, plan, and tasks belong (Priority: P2)

**Goal**: A contributor can locate the convention for where a brand-new feature's spec, plan, and tasks files will be created, matching what this foundation feature itself used (SC-005).

**Independent Test**: Locate the spec/plan/tasks storage convention and confirm it matches `specs/001-foundation/`'s own layout (per `quickstart.md` step 6).

### Implementation for User Story 3

- [ ] T017 [US3] Add a "Feature spec convention" section to `docs/setup.md` explaining the `specs/<seq>-<short-name>/` pattern (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `tasks.md`), referencing `specs/001-foundation/` as the worked example (FR-005, FR-015)
- [ ] T018 [US3] Validate User Story 3 independently per `quickstart.md` step 6: confirm `.specify/init-options.json`'s `feature_numbering: "sequential"` setting matches the `001-foundation` directory actually produced (SC-005)

**Checkpoint**: All three user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories

- [ ] T019 [P] Run the full `quickstart.md` (steps 1-6) end-to-end on a clean clone as final cross-story validation
- [ ] T020 [P] Confirm `.gitignore` already excludes every local artifact newly introduced by this feature (`apps/web/node_modules`, `apps/web/.next`, `apps/api/.venv`, real `.env`/`.env.local` files), add any missing pattern, and actively scan the working tree (`git status`, `git diff --staged`) for any committed file containing a real-looking secret value to confirm zero are present (FR-013, SC-004)
- [ ] T021 Update `specs/001-foundation/spec.md` Status field from `Draft` to `Implemented` once T001-T020 are verified complete (closes out FR-001–FR-017, SC-001–SC-005)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 — implement in spec order (US1 then US2) or in parallel if staffed
  - US3 (P2) can start any time after Foundational, but its convention note in `docs/setup.md` (T017) reads more naturally once T015 (US2) exists
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — independently testable; does not require US1's README edits
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) — independently testable; T017 is easiest to write after T015 exists but does not require US1 or US2 to be "done"

### Parallel Opportunities

- T003-T008 (all US1 README replacements, six different files) can run in parallel
- T010, T011, T013, T014 (US2 scaffolding + env files, four different files) can run in parallel; T012 depends on T011; T015 depends on T010-T014
- T019 and T020 (Polish) can run in parallel
- Different user story phases (US1, US2, US3) can be staffed in parallel once Phase 2 is complete

---

## Parallel Example: User Story 1

```bash
# Launch all README purpose-statement replacements together:
Task: "Replace placeholder text in apps/web/README.md with a purpose statement"
Task: "Replace placeholder text in apps/api/README.md with a purpose statement"
Task: "Replace placeholder text in packages/shared/README.md with a purpose + scope statement"
Task: "Replace placeholder text in supabase/README.md with a purpose statement"
Task: "Replace placeholder text in infra/README.md with a purpose statement"
Task: "Replace placeholder text in tests/README.md with a purpose statement"
```

## Parallel Example: User Story 2

```bash
# Launch independent scaffolding and env-doc tasks together:
Task: "Scaffold minimal Next.js 14 app shell in apps/web"
Task: "Scaffold minimal FastAPI app shell in apps/api"
Task: "Create apps/web/.env.example documenting every frontend environment variable"
Task: "Create apps/api/.env.example documenting every backend environment variable"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. **STOP and VALIDATE**: both shells run locally from documentation alone — this is the working baseline Phase 2 (Supabase Auth and Workspace Foundation) builds on

### Incremental Delivery

1. Complete Setup + Foundational → boundaries confirmed
2. Add User Story 1 → validate independently → repository layout is self-explanatory
3. Add User Story 2 → validate independently → local dev loop confirmed (MVP-equivalent for this infra feature)
4. Add User Story 3 → validate independently → next phase's spec convention is documented
5. Polish → final cross-story validation via full `quickstart.md` run

### Parallel Team Strategy

With multiple contributors:

1. Complete Setup + Foundational together (single contributor, fast)
2. Once Foundational is done:
   - Contributor A: User Story 1 (README purpose statements)
   - Contributor B: User Story 2 (app shells, env docs, `docs/setup.md`)
   - Contributor C: User Story 3 (spec convention note) — best started once T015 lands
3. Stories complete and validate independently; Polish phase runs last

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] label maps each task to its user story for traceability
- No automated tests are generated for this phase (see Tests note above); `quickstart.md` is the validation mechanism
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
