# Feature Specification: Testing, Security Review, and Deployment

**Feature Branch**: `010-testing-security-deployment`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Phase 10 — Testing, Security Review, and Deployment. MVP hardening and release-readiness phase for Smart Expense - AI, sequenced after Phase 9. Prove the whole system is correct, isolated, private, and shippable, and make production deployment to Bunny Magic Containers documented and repeatable. This phase MUST NOT modify product application code; it produces net-new test suites, fixtures/seeds, CI configuration, a written security review, and deployment configuration + documentation. Real defects found are recorded as tracked remediation findings, not fixed in this phase."

## Overview

This feature is the MVP hardening and release-readiness phase for Smart Expense -
AI. Phases 2–9 delivered the product surfaces (auth and workspaces, income/expense/
category core, the financial dashboard, the frontend experience, receipt/invoice
storage, BYOK AI settings, AI extraction review, and reports/summaries/history),
each with its own per-phase tests. This phase does **not** add product features.
Instead it proves the assembled MVP is **financially correct, tenant-isolated,
privacy-safe, and shippable**, and it turns "deploy to production" from tribal
knowledge into a **documented, repeatable procedure** targeting Bunny Magic
Containers.

Three deliverables define the phase:

1. **A cross-cutting acceptance test layer** that verifies the constitution's
   non-negotiables end-to-end across phases — financial accuracy, tenant isolation,
   role permissions, file privacy, AI behavior, and Arabic/English + RTL UI — as
   integration and end-to-end coverage that *complements and fills gaps in* the
   per-phase suites, rather than rewriting them.
2. **A written security review** of the assembled MVP against the constitution's
   security-critical principles (Privacy & Security, Multi-Tenant Isolation,
   Architecture Authority, Financial Accuracy), with every finding recorded and
   triaged.
3. **Production deployment readiness**: environment/configuration documentation, a
   repeatable deploy procedure for Bunny Magic Containers, and the deployment
   configuration artifacts, so a release can be performed by following written
   steps.

**Critical scope boundary**: This phase MUST NOT modify product application code —
that is, the product runtime source under `apps/api/app/**` and `apps/web`
(routes, components, services, schemas, and behavior-changing database migrations).
Its output is net-new: automated tests, test fixtures/seed data, CI configuration,
the security-review document, and deployment configuration + documentation. When a
test or the security review surfaces a genuine defect in Phase 2–9 code, that
defect is captured as a **tracked remediation finding** (a numbered, severity-rated
item in a findings register), not silently patched inside this phase. This is how
the phase satisfies "no known issues remain": the issues are *known, recorded, and
triaged*, and their fixes are scheduled as explicit follow-up work rather than
smuggled into a testing/release phase.

## Clarifications

### Session 2026-07-09

- Q: Which continuous-integration system runs the automated test suites? → A: GitHub Actions (the repository already uses GitHub/`gh`); CI configuration is authored as GitHub Actions workflow(s).
- Q: What severity scale does the remediation findings register use? → A: A four-level scale — Critical / High / Medium / Low — applied to every finding.
- Q: How far must deployment be validated within this phase? → A: Produce deployment documentation + committed configuration, verify every Bunny Magic Containers-specific detail against the official Bunny docs, and validate by review/dry-run; actually executing a live production deploy is NOT required within this phase.
- Q: How is Arabic/English + RTL behavior verified? → A: Automated localization/RTL tests on the core UI surfaces plus a written manual verification checklist for visual/RTL confirmation.
- Q: With findings possibly still open, what makes "MVP ready for review" true at phase end? → A: Every discovered issue being tracked in the findings register satisfies this phase's exit criteria; any open Critical or High financial-accuracy or tenant-isolation finding is additionally flagged as a release blocker in the readiness summary and must be remediated as follow-up before an actual production release.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prove financial accuracy and tenant isolation end-to-end (Priority: P1)

The team runs a cross-cutting acceptance test suite that exercises the assembled
system the way real workspaces do, and confirms the two non-negotiable guarantees:
financial totals are always correct (confirmed-only, integer money, correct under
edits/deletes/drafts/failures, across multiple workspaces and roles), and no user
can ever read or affect another workspace's data. Any discrepancy the suite finds
is recorded as a tracked remediation finding with enough detail to reproduce it.

**Why this priority**: Financial accuracy and tenant isolation are the two
constitution non-negotiables and the two hardest exit criteria ("no known
financial-calculation issues remain", "no known tenant-isolation issues remain").
They are the reason this phase exists and deliver the core release-confidence value
on their own.

**Independent Test**: Seed multiple workspaces with income, expenses, categories,
deleted records, edited records, draft/pending/failed AI extractions, and members in
each role. Run the acceptance suite and verify: remaining balance always equals
confirmed income − confirmed expenses (including zero-income, zero-expense, and
negative-balance cases); draft/pending/failed AI records never move any total;
edits and deletes immediately recalculate; and every cross-workspace and
unauthenticated read/write attempt is denied. Confirm each failure produces a
tracked finding.

**Acceptance Scenarios**:

1. **Given** a workspace with confirmed income and expenses plus deleted, edited,
   draft, and failed-AI records, **When** the financial-accuracy suite runs,
   **Then** every total equals confirmed income − confirmed expenses and excludes
   deleted and unconfirmed records, with no floating-point drift.
2. **Given** the edge financial states (zero income, zero expenses, negative
   remaining balance, an edited record, a deleted record), **When** each is
   exercised, **Then** the recalculated totals are correct for that state.
3. **Given** two separate workspaces owned by different users, **When** a user from
   one workspace attempts to read or modify the other workspace's income, expenses,
   files, history, or reports, **Then** every attempt is denied by the backend
   and/or database policy.
4. **Given** an unauthenticated request to any protected workspace resource,
   **When** the request is made, **Then** it is denied.
5. **Given** any test in the suite fails, **When** results are collected, **Then**
   the failure is captured as a tracked remediation finding (identifier, affected
   area, severity, reproduction) rather than being fixed inline in this phase.

---

### User Story 2 - Produce a written security review of the MVP (Priority: P1)

A reviewer performs and documents a structured security review of the assembled MVP
against the constitution's security-critical principles, and records the outcome as
a durable document: what was reviewed, what passed, what failed, and the severity
and remediation owner of each finding. The review explicitly covers BYOK AI-key
secrecy, private file storage, backend/database enforcement of every protected
action, and the confirmed-only financial guarantees.

**Why this priority**: "MVP is ready for review" is a stated exit criterion, and a
release without an explicit security review of a multi-tenant financial product is
not defensible. It is independently valuable: the document stands on its own even
before every finding is fixed.

**Independent Test**: Produce the security-review document and verify it covers each
in-scope principle (Privacy & Security, Multi-Tenant Isolation, Architecture
Authority, Financial Accuracy) with a pass/fail determination and a finding entry
for every failure, cross-referenced to the test suite where a check is automated.

**Acceptance Scenarios**:

1. **Given** the assembled MVP, **When** the security review is performed, **Then** a
   written review document exists covering tenant isolation, role permissions, file
   privacy, BYOK AI-key handling, backend/database enforcement, and financial
   accuracy.
2. **Given** the review checks BYOK AI-key handling, **When** it inspects request/
   response paths and logs, **Then** it confirms and documents that the AI key is
   never exposed to the frontend, never returned in API responses, and never written
   to logs or error messages.
3. **Given** the review checks file privacy, **When** it inspects storage access,
   **Then** it confirms files are private by default with no public URLs and access
   is scoped by workspace membership.
4. **Given** the review identifies a weakness, **When** it is recorded, **Then** it
   appears in the findings register with a severity and a remediation owner, and is
   not fixed inside this phase.

---

### User Story 3 - Verify role permissions, file privacy, and AI behavior (Priority: P2)

The team runs acceptance coverage for role-based permissions (Owner/Admin/Member/
Viewer), file privacy, and AI behavior, confirming that each role can do exactly
what it should and nothing more, that financial documents stay private, and that AI
behaves safely: drafts never affect totals until confirmed, the BYOK key is never
leaked, and provider errors are handled without breaking the app or corrupting data.

**Why this priority**: These are constitution-mandated test areas that protect
privacy and correctness, but they build on the P1 isolation/accuracy foundation and
are somewhat covered by per-phase suites; this phase fills the cross-cutting gaps.

**Independent Test**: For each role, attempt the full matrix of read/write actions
across income, expenses, categories, files, settings, AI, and history, and verify
allow/deny matches the intended permission model (notably Viewer is strictly
read-only). Verify private files are not reachable without authorized workspace
membership. Verify a confirmed AI extraction becomes an expense and affects totals
while drafts/pending/failed do not, and that an induced provider failure yields a
safe error with data intact.

**Acceptance Scenarios**:

1. **Given** each of the four roles, **When** the role attempts every protected
   action, **Then** allowed actions succeed and disallowed actions are denied by the
   backend, and Viewer cannot modify any workspace record.
2. **Given** a private file belonging to a workspace, **When** a non-member or an
   unauthenticated request attempts to access it, **Then** access is denied and no
   public URL exposes it.
3. **Given** an AI extraction in draft/pending/failed state, **When** totals and
   reports are computed, **Then** the extraction does not affect any total until the
   user confirms it into an expense.
4. **Given** an AI provider error or invalid key, **When** an AI action is
   attempted, **Then** a safe non-technical error is returned, the key is not
   exposed, and no financial data is created or corrupted.

---

### User Story 4 - Make production deployment documented and repeatable (Priority: P2)

A release engineer follows written documentation to deploy the MVP to Bunny Magic
Containers, using committed deployment configuration and a clearly listed set of
required environment variables and external services, and can repeat the deployment
without undocumented manual steps or tribal knowledge.

**Why this priority**: "Production deployment is documented and repeatable" is an
explicit exit criterion. It is independently valuable and separable from the test
and security-review work.

**Independent Test**: Have someone who did not write it follow the deployment
documentation and configuration to stand up (or dry-run) the application against
Bunny Magic Containers, confirming every required environment variable, secret, and
external dependency is listed and every step is written down with no gaps.

**Acceptance Scenarios**:

1. **Given** the deployment documentation and configuration, **When** a release
   engineer follows them, **Then** they can deploy the application to Bunny Magic
   Containers by following written steps without needing undocumented knowledge.
2. **Given** the documentation, **When** it is reviewed, **Then** it lists all
   required environment variables, secrets, and external services (Supabase Auth,
   Postgres, Vault, Storage), and states how production configuration and secrets
   are supplied without committing secret values to the repository.
3. **Given** any platform-specific deployment detail whose exact form is uncertain,
   **When** the documentation is prepared, **Then** that detail is verified against
   the official Bunny Magic Containers documentation and cited, rather than invented.
4. **Given** the deployment procedure, **When** it is followed a second time,
   **Then** it produces the same result (repeatable), including how database
   migrations are applied to the production database.

---

### User Story 5 - Verify Arabic/English and RTL UI behavior (Priority: P3)

The team verifies the UI behaves correctly in both Arabic and English, including
right-to-left layout, localized labels across the core surfaces (dashboard,
income/expense entry, reports/summaries, history, settings, AI review), and
SAR-first formatting, so Saudi-first users get a correct experience in their
language.

**Why this priority**: Arabic/English + RTL correctness is a constitution testing
requirement and a Saudi-first product commitment, but it is a presentation-layer
concern that is lower risk than financial/isolation correctness.

**Independent Test**: Switch the UI to Arabic and to English on the core surfaces
and verify layout direction (RTL vs LTR), that user-facing strings are localized in
both languages, and that monetary values render with SAR formatting, with no
untranslated keys or broken layout.

**Acceptance Scenarios**:

1. **Given** the UI language is Arabic, **When** the core surfaces render, **Then**
   layout is right-to-left, strings are in Arabic, and amounts use SAR formatting.
2. **Given** the UI language is English, **When** the core surfaces render, **Then**
   layout is left-to-right, strings are in English, and amounts use SAR formatting.
3. **Given** either language, **When** the core surfaces render, **Then** there are
   no untranslated string keys or broken RTL/LTR layout on the tested surfaces.

---

### Edge Cases

- **A test uncovers a real product defect**: the defect is recorded as a tracked
  remediation finding (identifier, area, severity, reproduction, owner) and is
  **not** fixed by editing product application code in this phase.
- **A test itself is wrong (false failure)**: the test (net-new artifact) is
  corrected, since fixing test/fixture/CI/deployment/documentation artifacts is
  in scope; only product application code is off-limits.
- **Financial edge states**: zero income, zero expenses, negative remaining
  balance, deleted record, edited record, draft AI, and failed AI extraction are
  each covered by explicit accuracy checks.
- **Cross-workspace access**: a user who belongs to workspace A must be denied every
  read and write against workspace B, including files and history.
- **Unauthenticated access**: every protected resource denies unauthenticated
  requests.
- **AI key absent vs present**: with no BYOK key, AI actions are unavailable and the
  rest of the app works; with a key, the key never leaves the backend and provider
  failures are handled safely.
- **Deployment secrets**: production secrets (AI keys, service credentials) must be
  supplied at deploy time via configuration, never committed to the repository.
- **Deployment target uncertainty**: any Bunny Magic Containers command/manifest
  detail that cannot be confirmed is treated as a verification task against official
  documentation, not asserted from memory.
- **Flaky or environment-dependent tests**: tests must be deterministic and
  repeatable so a pass/fail is trustworthy for a release decision.

## Requirements *(mandatory)*

### Functional Requirements

#### Scope and boundaries

- **FR-001**: This phase MUST NOT modify product application code, defined as the
  product runtime source under `apps/api/app/**` and `apps/web` (routes,
  components, services, schemas, and behavior-changing database migrations). Its
  deliverables MUST be net-new artifacts only.
- **FR-002**: In-scope artifacts that MAY be created or modified are: automated test
  suites, test fixtures and seed data, continuous-integration configuration, the
  written security-review document, the remediation findings register, deployment
  configuration, and deployment/environment documentation.
- **FR-003**: When testing or the security review surfaces a genuine defect in
  Phase 2–9 product code, the defect MUST be recorded as a tracked remediation
  finding and MUST NOT be fixed by modifying product application code within this
  phase.

#### Financial-accuracy verification

- **FR-004**: The test layer MUST verify that remaining balance always equals
  confirmed total income minus confirmed total expenses.
- **FR-005**: The test layer MUST verify that draft, pending, processing, failed,
  and unconfirmed AI-extraction records do not affect any financial total, report,
  or remaining balance.
- **FR-006**: The test layer MUST verify that editing or deleting income or expenses
  immediately recalculates the affected totals, and that deleted records are
  excluded from active totals.
- **FR-007**: The test layer MUST cover the financial edge states required by the
  constitution: zero income, zero expenses, negative remaining balance, edited
  records, deleted records, pending AI drafts, failed AI extraction, multiple
  workspaces, and viewer access restrictions.
- **FR-008**: The test layer MUST verify that money values are handled with integer
  minor units (or fixed-precision decimals) and never via floating-point arithmetic
  in any verified total.

#### Tenant-isolation verification

- **FR-009**: The test layer MUST verify that a user cannot read data from a
  workspace they do not belong to, across income, expenses, categories, files,
  reports, summaries, and history.
- **FR-010**: The test layer MUST verify that a user cannot modify data in a
  workspace they do not belong to.
- **FR-011**: The test layer MUST verify that unauthenticated requests to protected
  workspace resources are denied.
- **FR-012**: The test layer MUST verify tenant isolation is enforced on the backend
  and/or at the database policy level, not by frontend checks alone.

#### Role-permission verification

- **FR-013**: The test layer MUST verify the four roles (Owner, Admin, Member,
  Viewer) each permit exactly their intended actions and deny the rest across the
  protected surfaces.
- **FR-014**: The test layer MUST verify that Viewer cannot modify any workspace
  record.

#### File-privacy verification

- **FR-015**: The test layer MUST verify that receipt/invoice files are private by
  default and are not accessible through any public URL.
- **FR-016**: The test layer MUST verify that file access is scoped by workspace
  membership so non-members and unauthenticated requests are denied.

#### AI-behavior verification

- **FR-017**: The test layer MUST verify that the BYOK AI key is never exposed to
  the frontend, never returned in an API response, and never written to logs or
  error messages.
- **FR-018**: The test layer MUST verify that AI extraction results do not affect
  financial totals until the user confirms them, and that unconfirmed results never
  appear as final spending.
- **FR-019**: The test layer MUST verify that provider errors and invalid keys are
  handled with a safe, non-technical error, without leaking the key and without
  creating or corrupting financial data.
- **FR-020**: The test layer MUST verify that the application is fully usable with no
  AI key configured (manual-first), and that AI actions are simply unavailable in
  that case.

#### Arabic/English and RTL verification

- **FR-021**: The test layer MUST verify that the core UI surfaces render correctly
  in both Arabic (RTL) and English (LTR), with localized strings and SAR-first
  monetary formatting, and no untranslated keys on the tested surfaces. Verification
  MUST consist of automated localization/RTL tests on the core surfaces PLUS a
  written manual verification checklist for visual/RTL confirmation.

#### Test execution and continuous integration

- **FR-022**: The test suites MUST be executable through a documented, repeatable
  command/procedure and MUST be deterministic (no flaky, environment-dependent
  pass/fail).
- **FR-023**: Continuous-integration configuration MUST run the automated test
  suites so their pass/fail status is visible for a release decision. CI MUST be
  implemented as GitHub Actions workflow(s).
- **FR-024**: The tests MUST run against the local Supabase development stack (and/or
  equivalently seeded test environment) using seed data/fixtures created in this
  phase, and MUST NOT depend on live external AI provider calls (provider
  interactions are stubbed/intercepted).

#### Security review

- **FR-025**: A written security-review document MUST be produced that reviews the
  assembled MVP against the constitution's security-critical principles: Privacy &
  Security, Multi-Tenant Isolation, Architecture Authority, and Financial Accuracy.
- **FR-026**: The security review MUST record every finding in a findings register
  with an identifier, affected area, severity, and remediation owner, and MUST
  cross-reference the automated test that covers each check where one exists.
  Severity MUST use a four-level scale: Critical, High, Medium, Low.
- **FR-027**: The security review MUST explicitly confirm (or record findings
  against): BYOK AI-key secrecy, private file storage with no public URLs, backend/
  database enforcement of every protected action, and the confirmed-only financial
  guarantees.

#### Deployment readiness

- **FR-028**: Deployment documentation MUST describe a repeatable procedure to
  deploy the application to Bunny Magic Containers, such that a release engineer can
  follow written steps without undocumented manual knowledge.
- **FR-029**: Deployment documentation MUST enumerate all required environment
  variables, secrets, and external services (Supabase Auth, Postgres, Vault,
  Storage), and MUST describe how production configuration and secrets are supplied
  without committing secret values to the repository.
- **FR-030**: Deployment configuration artifacts (for example a container image
  definition and platform configuration) MUST be committed, and any Bunny Magic
  Containers-specific detail whose exact form is uncertain MUST be verified against
  the official Bunny Magic Containers documentation and cited, not invented.
- **FR-030a**: Deployment readiness for this phase MUST be satisfied by producing the
  documentation and committed configuration and validating them by review/dry-run;
  executing a live production deploy is NOT required within this phase.
- **FR-031**: Deployment documentation MUST describe how database migrations are
  applied to the production database as part of the repeatable procedure.

#### Findings and readiness tracking

- **FR-032**: A remediation findings register MUST exist that lists every defect and
  security finding discovered in this phase with a stable identifier, severity, and
  status, so "no known issues remain" is demonstrable by an empty set of untriaged
  issues (all issues known and tracked).
- **FR-033**: The phase's readiness outcome MUST be summarized against the exit
  criteria: MVP ready for review, no untracked tenant-isolation issues, no untracked
  financial-calculation issues, and deployment documented and repeatable. The
  summary MUST additionally flag every open Critical or High financial-accuracy or
  tenant-isolation finding as a release blocker requiring follow-up remediation
  before an actual production release; tracking such a finding satisfies this phase's
  exit criteria but does not clear it as a release blocker.

#### Out of scope (explicitly deferred)

- **FR-034**: The following MUST NOT be part of this phase: modifying product
  application code to fix discovered defects; adding new product features or
  surfaces; performance/load/penetration testing beyond correctness, isolation, and
  privacy verification; automated continuous-deployment pipelines beyond a
  documented repeatable procedure; and any change to the constitution's MVP scope.

### Key Entities *(include if feature involves data)*

- **Acceptance Test Suite (net-new artifact)**: Cross-cutting integration and
  end-to-end tests verifying financial accuracy, tenant isolation, role permissions,
  file privacy, AI behavior, and AR/EN + RTL UI. Runs against seeded test data; does
  not call live AI providers.
- **Test Fixtures / Seed Data (net-new artifact)**: Deterministic seed data
  (workspaces, users per role, income/expense/category records, deleted/edited/draft/
  failed states, files) used to exercise the acceptance suite repeatably.
- **CI Configuration (net-new artifact)**: Configuration that runs the automated
  suites and surfaces pass/fail for release decisions.
- **Security Review Document (net-new artifact)**: A written review of the MVP
  against the security-critical constitution principles, with per-principle pass/fail
  and cross-references to automated checks.
- **Remediation Findings Register (net-new artifact)**: A list of discovered defects
  and security findings, each with identifier, affected area, severity, status, and
  remediation owner; the mechanism by which "no known issues remain" is demonstrated
  as "all issues known and tracked."
- **Deployment Configuration (net-new artifact)**: Committed container/platform
  configuration for deploying to Bunny Magic Containers, excluding secret values.
- **Deployment Documentation (net-new artifact)**: The repeatable deploy procedure,
  environment/secret inventory, external-service dependencies, and production
  migration steps, with platform-specific details verified against official docs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the financial-accuracy edge states (zero income, zero
  expenses, negative remaining balance, edited record, deleted record, pending AI
  draft, failed AI extraction, multiple workspaces, viewer restriction) are covered
  by automated tests, and each asserts remaining balance = confirmed income −
  confirmed expenses with no floating-point drift.
- **SC-002**: In 100% of cross-workspace and unauthenticated access attempts in the
  suite, the attempt is denied; there are zero untracked tenant-isolation failures
  at phase completion.
- **SC-003**: For all four roles, 100% of tested protected actions produce the
  intended allow/deny outcome, and Viewer produces zero successful modifications.
- **SC-004**: In 100% of tested cases, receipt/invoice files are inaccessible
  without authorized workspace membership and expose no public URL.
- **SC-005**: In 100% of tested AI paths, the BYOK key does not appear in any API
  response, frontend payload, log, or error message, and unconfirmed AI results move
  zero totals.
- **SC-006**: The core UI surfaces render correctly in both Arabic (RTL) and English
  (LTR) with SAR formatting and zero untranslated keys on the tested surfaces.
- **SC-007**: The automated test suites run deterministically via a documented,
  repeatable command/procedure (the same commands invoked locally and in CI) and are
  wired into continuous integration with visible pass/fail status.
- **SC-008**: A security-review document exists covering 100% of the in-scope
  constitution principles (Privacy & Security, Multi-Tenant Isolation, Architecture
  Authority, Financial Accuracy), with every failure recorded in the findings
  register.
- **SC-009**: A person who did not author the deployment documentation can follow it
  to deploy (or dry-run) the application to Bunny Magic Containers with zero
  undocumented manual steps, and every required environment variable/secret/external
  service is listed.
- **SC-010**: At phase completion, every discovered defect and security finding
  appears in the remediation findings register with a severity and status, so the
  set of *untracked* known issues is empty.

## Assumptions

- Phases 2–9 are implemented and each shipped its own per-phase tests; this phase
  adds cross-cutting acceptance/integration/e2e coverage and gap-fill, not a rewrite
  of those suites.
- "No known issues remain" (per the exit criteria) is satisfied by all discovered
  issues being *known and tracked* in the findings register; actually fixing product
  code for those findings is scheduled as explicit follow-up work outside this
  testing/release phase, consistent with the no-application-code-change rule.
- Tests run against the local Supabase development stack (Docker) and/or an
  equivalently seeded environment, using real local Auth test users to exercise RLS,
  roles, and isolation, and stub/intercept AI provider calls so no live external AI
  requests are made.
- The deployment target is Bunny Magic Containers per the constitution; exact
  platform CLI/manifest specifics are treated as a verification task against the
  official Bunny Magic Containers documentation during planning, not asserted from
  memory.
- Production secrets (AI keys via BYOK, Supabase service credentials) are supplied at
  deploy time through the platform's configuration/secret mechanism and are never
  committed to the repository.
- The security review is a documented manual + automated-cross-reference review
  against the constitution's security principles; it is not an external third-party
  audit or a formal penetration test.
- Continuous integration tooling is available to run the test suites; the specific CI
  system and its configuration format are a planning-level decision.
- "Core UI surfaces" for AR/EN verification are the primary user-facing surfaces
  delivered in Phases 5–9 (dashboard, income/expense entry, reports/summaries,
  history, settings, and AI review).
