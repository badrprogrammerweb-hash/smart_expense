# Feature Specification: Foundation and Repository Setup

**Feature Branch**: `001-foundation`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "Read Phase 1 from docs/implementation-plan.md - and according to the best practices of Github's speckit, create the first spec."

## Clarifications

### Session 2026-06-20

- Q: Should this foundation phase include scaffolding an actually-runnable minimal frontend + backend (toolchain validated end-to-end now), or stay limited to folder boundaries and documentation, leaving the first real running code for Phase 2? → A: Minimal runnable skeleton for both frontend and backend (default page + health endpoint) — confirms the toolchain works end-to-end before Phase 2.
- Q: Should the minimal runnable skeleton work with zero external service dependencies, or is a live external service connection part of what "successfully started" means? → A: Optional/degraded — the shell starts either way; the health endpoint explicitly reports "not configured" when no external credentials are present, instead of failing or requiring them.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
-->

### User Story 1 - Start the project from a clear repository layout (Priority: P1)

A new contributor (or the project owner returning after time away) clones the
repository and needs to immediately understand where frontend code, backend
code, database artifacts, specs, and documentation each belong, without
having to ask anyone or guess.

**Why this priority**: Every later phase (auth, income/expense core,
dashboard, AI extraction, deployment) depends on contributors and AI coding
agents alike placing new code in a predictable location. Getting this wrong
early creates rework and merge friction across all nine remaining phases.

**Independent Test**: Can be fully tested by cloning the repository fresh and
verifying that the location for frontend work, backend work, database/schema
work, shared contracts, specs, documentation, deployment config, and tests is
unambiguous from the top-level directory names alone, before opening any
README. Each boundary's README must then confirm — not establish — that same
purpose, so the layout itself carries the meaning and the README is a
supporting confirmation, not a requirement to understand it.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** a contributor looks at
   the top-level folders, **Then** they can identify exactly one place for
   frontend application code, one place for backend application code, one
   place for database/storage artifacts, one place for shared/cross-cutting
   code, one place for product specs, one place for practical documentation,
   one place for deployment configuration, and one place for test strategy
   documentation.
2. **Given** the repository layout, **When** a contributor searches for where
   a new feature's frontend screen versus backend endpoint versus database
   migration should live, **Then** the answer is the same regardless of
   which phase or feature they are working on.

---

### User Story 2 - Set up a working local development environment (Priority: P1)

A contributor wants to run the project locally (frontend shell and backend
shell) before any real feature work exists, so that later phases can build on
a confirmed-working baseline instead of discovering environment problems
mid-feature.

**Why this priority**: Phase 2 onward assumes a working local dev loop.
Discovering setup gaps (missing env var documentation, unclear startup
steps) during Phase 2+ work would block multiple downstream phases at once.

**Independent Test**: Can be fully tested by following only the written
environment setup documentation, with no prior project knowledge, and
successfully starting the frontend application shell and the backend
application shell locally.

**Acceptance Scenarios**:

1. **Given** the documented environment setup steps, **When** a contributor
   follows them on a clean machine, **Then** they can determine every
   environment variable or external service credential they are expected to
   provide, without needing to read application source code to find it.
2. **Given** a completed local setup, **When** the contributor starts the
   frontend and backend application shells, **Then** both start successfully
   and the documentation states what "started successfully" looks like for
   each (e.g., reachable local URL or confirmation output).
3. **Given** the documentation, **When** a contributor looks for which
   environment values are safe to commit versus which must remain local
   secrets, **Then** this distinction is explicit and no real secret values
   are present in any committed file.

---

### User Story 3 - Know where the next feature's spec, plan, and tasks belong (Priority: P2)

A contributor (human or AI coding agent) finishing this foundation phase
needs to know where the Phase 2 feature's spec, plan, and task files will
live and what naming pattern they follow, so the Spec-Kit cycle
(specify → plan → tasks → implement) continues without re-deciding structure
each time.

**Why this priority**: The project constitution requires every phase to go
through its own spec/plan/tasks/implement cycle. If the spec/plan/task
storage convention is not established now, every subsequent phase risks
inventing a different convention.

**Independent Test**: Can be fully tested by locating the convention for
where a brand-new feature's spec, plan, and tasks files will be created and
confirming it matches what this foundation feature itself used.

**Acceptance Scenarios**:

1. **Given** this foundation feature's own spec location, **When** a
   contributor starts the next phase's spec, **Then** the same parent
   location and naming convention apply without modification.

---

### Edge Cases

- What happens when a contributor adds a file to the wrong top-level
  location (e.g., backend code under the frontend boundary)? The layout and
  its documentation must make the correct location obvious enough that this
  is self-evident during review, even though no automated enforcement is
  required at this stage.
- How does the setup process behave when an expected external service
  credential (e.g., a database connection value) is missing? The backend
  shell must still start, and its health/status response must explicitly
  report "not configured" for that dependency, so a contributor isn't
  blocked guessing whether the project is broken.
- What happens if a contributor only wants to work on the frontend (or only
  the backend) without configuring the other side? The repository structure
  and documentation must make it possible to identify which environment
  values are specific to which application boundary.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a single, unambiguous top-level
  location for frontend application code.
- **FR-002**: The repository MUST provide a single, unambiguous top-level
  location for backend application code.
- **FR-003**: The repository MUST provide a single, unambiguous top-level
  location for database migrations, policy definitions, and seed/storage
  policy notes.
- **FR-004**: The repository MUST provide a single, unambiguous top-level
  location for code, types, or contracts shared across the frontend and
  backend boundaries.
- **FR-005**: The repository MUST provide a single, unambiguous top-level
  location for product and feature specifications (specs, plans, and task
  files), following one consistent naming convention that subsequent phases
  reuse without modification.
- **FR-006**: The repository MUST provide a single, unambiguous top-level
  location for practical setup, environment, architecture, and decision
  documentation.
- **FR-007**: The repository MUST provide a single, unambiguous top-level
  location for deployment configuration and environment notes.
- **FR-008**: The repository MUST provide a single, unambiguous top-level
  location for cross-application testing strategy documentation.
- **FR-009**: The repository structure MUST remain a single monolith — no
  top-level location may represent a separately deployable, independently
  versioned repository.
- **FR-010**: The documentation MUST describe how to start the frontend
  application shell locally, including what a successful start looks like.
- **FR-011**: The documentation MUST describe how to start the backend
  application shell locally, including what a successful start looks like.
- **FR-012**: The documentation MUST enumerate every environment variable or
  external credential a contributor is expected to supply for local
  development, and state its purpose.
- **FR-013**: The documentation MUST clearly distinguish committed,
  non-sensitive configuration from local-only secret values, and no real
  secret values may exist in any committed file.
- **FR-014**: The documentation MUST state which local startup steps are
  expected to fail, be skipped, or run in a degraded mode when an external
  service credential is not yet configured (since Phase 1 precedes
  authentication and database setup).
- **FR-015**: The repository MUST make it possible to add a new feature's
  spec, plan, and task files using the same top-level location and naming
  convention this foundation feature itself uses.
- **FR-016**: The repository MUST include a minimal runnable skeleton for
  both the frontend and backend application shells (e.g., a default starter
  page and a basic health/status response) that starts successfully using
  only the documented setup steps, so the local development toolchain is
  validated end-to-end before Phase 2 begins.
- **FR-017**: The backend process MUST start successfully whether or not an
  external service connection (e.g., database/auth credentials) is
  configured; its health/status response MUST explicitly report a
  "not configured" status for that dependency rather than failing or
  blocking startup.

### Key Entities

- **Repository Boundary**: A top-level directory representing one domain of
  the system (frontend, backend, shared code, database artifacts, specs,
  documentation, deployment config, or tests). Each boundary has exactly one
  intended purpose and must not overlap in responsibility with another
  boundary.
- **Environment Setup Documentation**: The practical reference a contributor
  follows to go from a fresh clone to a running local frontend and backend
  shell, including required environment variables and their purpose, and
  which are secret versus safe to commit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor unfamiliar with the project can correctly
  identify, from the top-level repository layout alone, where frontend code,
  backend code, database artifacts, specs, and documentation belong, in
  under 2 minutes.
- **SC-002**: A contributor following only the written setup documentation
  can get both the frontend and backend application shells running locally
  on a clean machine without needing to ask a question or read application
  source code.
- **SC-003**: 100% of environment variables referenced by the local startup
  process are documented with their purpose before this feature is
  considered complete.
- **SC-004**: Zero real secret values exist in committed files at the end of
  this feature.
- **SC-005**: Every one of the nine subsequent implementation phases can
  state, without ambiguity, which top-level repository boundary its new code
  belongs in, using only this foundation's structure.

## Assumptions

- The minimal runnable skeleton (FR-016) covers only a default starter page
  and a basic health/status response — full authentication, workspace, and
  business features are out of scope for this phase and are covered by later
  phases (Phase 2 onward).
- Provisioning the actual hosted database/authentication/storage service
  (creating the live project, enabling tenant-isolation policies, configuring
  secret storage) is noted as a future setup step but standing up that live
  service with real schema is out of scope for this phase; this phase covers
  the repository boundary and local documentation only, consistent with
  Phase 2 owning auth and workspace schema.
- No automated build pipeline, automated linting enforcement, or production
  deployment is required in this phase; deployment is explicitly covered
  later (Phase 10) and only basic local-development confirmation is in scope
  here, per the implementation plan's Phase 1 exit criteria.
- "Contributor" in this spec includes both human developers and AI coding
  agents acting on the repository, since the project explicitly uses
  AI-assisted, spec-driven development.
