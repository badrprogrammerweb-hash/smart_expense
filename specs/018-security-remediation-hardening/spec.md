# Feature Specification: Security Remediation and Production Hardening

**Feature Branch**: `018-security-remediation-hardening`

**Created**: 2026-07-30

**Status**: Implemented

**Input**: User description: "Phase 18 — Security Remediation and Production Hardening. Remove the confirmed production-blocking security vulnerabilities found in the Phase 17 security audit, and apply the minimum production hardening required before staging with real credentials or production security testing."

## Overview

A repository-wide security audit performed after Phase 17 identified four **confirmed**
vulnerabilities that block production release, plus a set of hardening gaps. All four confirmed
vulnerabilities share a single root cause: privileged database routines that were designed to be
called only by the trusted backend are published on the same client-facing data API that ordinary
signed-in users can reach directly with their own credentials. Because those routines run with
elevated database privileges, calling them directly bypasses the tenant-isolation rules that
protect every other part of the product.

This phase closes that exposure, adds a second independent control so the most severe issue stays
closed even if the exposure regresses, and applies the minimum operational hardening needed before
the product may run in an environment holding real user data or real payment-provider credentials.

This phase changes **no product behaviour**. No screen, permission, financial rule, or user-visible
workflow changes. Success is measured by attacks that stop working and existing behaviour that
keeps working.

## Implementation and release-gate status

The local Phase 18 implementation is complete. Phase 9 / User Story 7 was completed: both
`workspace_role_for(uuid,uuid)` and `is_workspace_member(uuid,uuid)` were successfully relocated
to `private` while preserving their authenticated execution grants and dependent RLS behavior.

Implementation completion is not release approval or hosted-deployment verification. The complete
local backend suite and web unit suite pass, and migration idempotence, both rollback targets,
static gates, browser signup, and mapped security flows were verified. T035 is complete after the
real local browser signup check.

Correction Pass A (2026-08-02) closed the rollback gate and one test-coverage regression:
`rollback.sql` now requires an explicit `rollback_target` (`phase3` or `identity_guard`), executes
exactly one target per run, and cannot compose the two — the earlier whole-file composition produced
an invalid duplicate state and was never a valid procedure. The `phase3` target is documented as
requiring a coordinated application rollback. `test_extraction_secrecy.py`'s
`vault.decrypted_secrets` catalog scan, which Phase 18 had narrowed from `public` to `private`, now
scans both schemas. T088 and T089 are verified against the corrected interface.

The full Playwright gate (T086) remained unresolved through Correction Pass A. It was closed in
Correction Pass B against a CI-equivalent definition that excludes visual regression, and the pinned
Linux visual gate (quickstart Step 9c) was closed in Correction Pass C, so **T086 and T091 are now
green**. **T093** (deployed PostgREST smoke) subsequently **passed** against the real hosted project:
`ensure_personal_workspace` returned `404 / PGRST202` while the EX-5 control returned a non-404,
using only a publishable key and an ordinary `role=authenticated` token.

**T092** (hosted exposed-schema evidence) subsequently **passed** as well: the target project's
Dashboard → Integrations → Data API → Settings records **"2 of 3 schemas exposed"** with
`graphql_public` and `public` selected and **`private` present but not selected**. The Dashboard
screenshot was reviewed as external release evidence on 2026-08-03 and is retained with the release
record rather than in this repository.

**All Phase 11 verification gates (T085–T097) are therefore complete**, including both hosted
release gates. Two standing caveats apply and are not closed by these gates: T092 and T093 are
**point-in-time** and must be re-verified after any Supabase project configuration change, since
dashboard drift re-exposes every relocated routine with no code change and no failing test; and the
separately recorded low-severity `download-url` robustness defect (a bare `ValueError` escaping as
HTTP 500 on a malformed `storage_path`) remains open by design. **Sign-off for a production release
remains a human decision and is not claimed here.**

## Clarifications

### Session 2026-07-30

All five answers were auto-selected as the recommended conservative, MVP-safe option under
explicit instruction, and are recorded here as binding decisions.

- Q: What per-account throttling allowance and window should each protected operation use? → A:
  Fixed one-hour window per account, differentiated by cost: support-checkout creation 5/hour,
  store-purchase verification 10/hour, AI extraction trigger 30/hour, AI summary 10/hour. Chosen
  because each ceiling is roughly an order of magnitude above realistic human use, so no genuine
  user is ever affected, while abuse is bounded to negligible cost.
- Q: Over what scope is the throttling count kept — per service instance, or shared across all
  instances? → A: Per service instance, held in process memory. Chosen because a shared counter
  store would introduce a new infrastructure dependency that the project's technology constraints
  do not currently include, which would require its own specification. The consequence — that the
  effective allowance is multiplied by the number of running instances — is accepted and MUST be
  documented rather than hidden.
- Q: If the throttling mechanism itself fails unexpectedly, should the request be allowed or
  refused? → A: Refused (fail closed). Chosen because a refusal can never corrupt financial or
  purchase state, whereas allowing the request would silently remove the only abuse control. The
  mechanism performs no network access, so its failure probability is very low.
- Q: Must the new throttling refusal be presented in the user's language? → A: Yes. The backend
  returns a stable machine-readable code and the frontend maps it to Arabic and English messages,
  matching how every existing error is handled. An untranslated message would be a visible
  regression in the Arabic-first interface.
- Q: In what form should the database reversal procedure be delivered? → A: As reviewed reversal
  statements committed inside this feature's specification directory, never inside the applied
  change-history directory, so an operator has an exact reviewed artifact while the forward
  change history stays forward-only and unaffected by environment rebuilds.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Privileged routines are unreachable from any client (Priority: P1)

An ordinary signed-in user — using nothing but the credentials their own browser or mobile app
already holds — attempts to invoke the product's privileged internal routines directly against the
data API, bypassing the trusted backend. Every such attempt fails as though the routine does not
exist. The same routines continue to work normally when the trusted backend calls them on the
user's behalf.

**Why this priority**: This single change closes all four confirmed vulnerabilities at once — the
account-identity rewrite, the plaintext AI-provider-key disclosure, the account enumeration, and
the cross-tenant relationship disclosure. It is the release blocker. Nothing else in this phase
matters if this is not done.

**Independent Test**: Sign in as an ordinary user, call each of the four privileged routines
directly against the data API with that user's own token, and confirm each is rejected as
unavailable. Then exercise the corresponding product flows through the application (sign-in
bootstrap, inviting a member by email, running an AI extraction, generating an AI summary) and
confirm all still succeed.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a valid session, **When** they directly invoke the
   personal-workspace bootstrap routine against the data API with another account's identifier,
   **Then** the request is rejected as an unavailable operation and no profile record is modified.
2. **Given** a signed-in user who is a Member of a workspace that has an AI provider key
   configured, **When** they directly invoke the key-retrieval routine against the data API,
   **Then** the request is rejected and no key material is returned.
3. **Given** a signed-in user, **When** they directly invoke the email-lookup routine against the
   data API for an address belonging to another account, **Then** the request is rejected and no
   account identifier or address is returned.
4. **Given** a signed-in user, **When** they directly invoke the shared-workspace relationship
   routine against the data API for two arbitrary account identifiers, **Then** the request is
   rejected and no relationship information is returned.
5. **Given** a brand-new account signing up, **When** the account is created, **Then** its personal
   workspace is created with the account as Owner exactly as before.
6. **Given** an existing account signing in, **When** any authenticated request is made, **Then**
   the personal-workspace repair step completes successfully and the request proceeds.
7. **Given** an Owner or Admin of a team workspace, **When** they invite an existing user by email
   address, **Then** the invitation resolves to the correct account and the member is added.
8. **Given** a workspace with an AI provider key configured, **When** an Owner, Admin, or Member
   triggers an AI extraction or requests an AI summary, **Then** the operation succeeds using the
   key without the key ever appearing in any response.
9. **Given** every existing tenant-isolation rule in the database, **When** the change is applied,
   **Then** all of them continue to enforce identical access decisions for Owner, Admin, Member,
   Viewer, and non-member.

---

### User Story 2 - The bootstrap routine refuses to act for anyone but the caller (Priority: P1)

Even in a hypothetical future where the privileged routines became reachable again — through a
configuration mistake in a hosted environment, or a new deployment whose API exposure settings
differ — the personal-workspace bootstrap routine independently refuses any request that asks it to
act on an identity other than the caller's own.

**Why this priority**: The exposure fix in User Story 1 depends on an environment setting that
lives outside version control in hosted environments. A configuration mistake would silently
re-open the most severe vulnerability with no failing test and no code change. This story makes the
routine safe on its own merits, so two independent controls must both fail before the
account-identity rewrite becomes possible again.

**Independent Test**: Invoke the bootstrap routine with a caller identity that differs from the
target identity and confirm it is refused. Then confirm the two legitimate paths still work: new
account signup (where no caller identity exists) and an existing account's own repair call.

**Acceptance Scenarios**:

1. **Given** a request whose caller identity is known, **When** the bootstrap routine is asked to
   act on a different identity, **Then** it refuses with a permission error and modifies nothing.
2. **Given** a request whose caller identity is known, **When** the bootstrap routine is asked to
   act on that same identity, **Then** it completes normally.
3. **Given** the new-account creation path, where no caller identity exists, **When** the bootstrap
   routine runs, **Then** it completes normally and the personal workspace is created.
4. **Given** an account whose stored email differs from the address in its current session,
   **When** it makes an authenticated request, **Then** its own stored email is corrected as before.

---

### User Story 3 - Costly and state-changing operations resist abuse (Priority: P2)

A signed-in user who repeatedly hammers the operations that cost real money or consume third-party
quota is throttled. When throttled, the request is refused before any payment session is created,
any purchase record is written, and any external provider is contacted — so a throttled user's
financial and purchase state is exactly what it was before the attempt.

**Why this priority**: These endpoints currently have no abuse protection at all. One account can
create unbounded live payment sessions and drive unbounded third-party API calls. This is a real
cost and availability exposure, but it does not grant unauthorised access to anyone's data, so it
ranks below the confirmed vulnerabilities.

**Independent Test**: Drive one account past the threshold on each protected operation and confirm
the excess requests are refused with a clear, non-technical throttling response. Then confirm no
payment session was created, no purchase record changed state, and no provider call was made for
the refused attempts.

**Acceptance Scenarios**:

1. **Given** a signed-in user who has reached the threshold for support-checkout creation,
   **When** they request another checkout, **Then** the request is refused with a throttling
   response, no payment session is created, and no purchase record is added.
2. **Given** a signed-in user who has reached the threshold for store-purchase verification,
   **When** they submit another verification, **Then** the request is refused and no external store
   verification call is made.
3. **Given** a signed-in user who has reached the threshold for AI extraction or AI summary,
   **When** they submit another request, **Then** the request is refused and no AI provider call is
   made and no provider key is read.
4. **Given** a user who was throttled, **When** the throttling window elapses, **Then** their next
   request is accepted and behaves normally.
5. **Given** two different accounts, **When** one is throttled, **Then** the other is unaffected.
6. **Given** a genuine provider webhook delivery, **When** it arrives, **Then** it is never
   throttled, because losing a verified provider signal would corrupt purchase state.
7. **Given** a throttled request, **When** the refusal is displayed, **Then** the message appears in
   the user's active language in both Arabic and English interfaces.

---

### User Story 4 - Secret redaction in operational logs actually applies (Priority: P2)

The system's secret-redaction safeguard applies to every log record the application produces,
including records produced by individual modules rather than only the top-level logger. An operator
reading logs never sees credential material, regardless of which part of the system wrote the line.

**Why this priority**: The redaction safeguard exists but is attached at a level where it does not
apply to the records the application actually emits. No secret is currently proven to leak, because
every existing log statement redacts its own content before writing. The defect is that the
safety net is not there for the next log statement anyone adds. Fixing it is cheap and prevents a
whole class of future incident.

**Independent Test**: Emit a log record containing credential-shaped content from a module-level
logger and confirm the written output is redacted. Confirm the same for the top-level logger.

**Acceptance Scenarios**:

1. **Given** a log record containing a bearer credential written by a module-level logger,
   **When** it is emitted, **Then** the credential is replaced by a redaction marker in the output.
2. **Given** a log record containing an email address written by a module-level logger, **When** it
   is emitted, **Then** the address is masked in the output.
3. **Given** a log record whose sensitive content arrives as a formatting argument rather than in
   the message text, **When** it is emitted, **Then** the sensitive content is still redacted.
4. **Given** the existing log statements that already redact their own content, **When** the change
   is applied, **Then** their output is unchanged and not doubly mangled.

---

### User Story 5 - Token verification rejects unexpected algorithms safely (Priority: P2)

A caller presenting a session token that declares an unexpected or malformed signing method is
rejected with a clean authentication failure. The accepted signing methods are determined by
trusted server-side configuration, never by a value the caller supplies inside the token itself.

**Why this priority**: Today the accepted signing method is read from the token the caller
controls. This is not currently an authentication bypass — the mismatch causes an internal error
rather than acceptance — but it means an unauthenticated caller can trigger internal server errors,
and it leaves the door open for a future dependency change to turn a hardening gap into a real
bypass.

**Independent Test**: Present tokens declaring an unexpected signing method, a missing signing
method, and a signing method that mismatches the server's trusted key material. Confirm each is
rejected as an authentication failure, and that no internal error is returned.

**Acceptance Scenarios**:

1. **Given** a token declaring a signing method the server does not trust, **When** it is
   presented, **Then** the request is rejected as unauthenticated.
2. **Given** a token whose declared signing method does not match the server's trusted key
   material, **When** it is presented, **Then** the request is rejected as unauthenticated and no
   internal error is surfaced.
3. **Given** a token with a missing or malformed signing method declaration, **When** it is
   presented, **Then** the request is rejected as unauthenticated.
4. **Given** a legitimately issued session token, **When** it is presented, **Then** it is accepted
   exactly as before.
5. **Given** a service-level credential presented as a user session token, **When** it is
   presented, **Then** it continues to be rejected.

---

### User Story 6 - Production exposes a minimal surface and discloses nothing extra (Priority: P2)

In a production environment, the machine-readable interface description and interactive interface
explorer are unavailable, diagnostic error detail is off, and the availability probe answers without
reaching out to any external service or using any privileged credential. Local development keeps
all of these conveniences.

**Why this priority**: Each item is individually small and none grants access on its own. Together
they remove reconnaissance value from an attacker and remove a per-probe amplification and
credential-use path. They are cheap and appropriate to land alongside the blocking fixes.

**Independent Test**: Start the service configured as production and confirm the interface
description and explorer paths are unavailable, an error response carries no diagnostic detail, and
the availability probe returns promptly with no outbound request. Start it configured for local
development and confirm the explorer is available again.

**Acceptance Scenarios**:

1. **Given** a production configuration, **When** the interface description or interactive explorer
   paths are requested, **Then** they are unavailable.
2. **Given** a local development configuration, **When** those paths are requested, **Then** they
   are available as before.
3. **Given** a production configuration, **When** an internal failure occurs, **Then** the response
   carries a stable error code and non-technical message and no diagnostic detail.
4. **Given** an environment where the environment-identity setting is absent or unrecognised,
   **When** an internal failure occurs, **Then** diagnostic detail is withheld — the safe behaviour
   is the default, never something that must be switched on.
5. **Given** any configuration, **When** the availability probe is requested, **Then** it responds
   without making an outbound network request and without using a privileged service credential.
6. **Given** the availability probe, **When** it is requested repeatedly, **Then** each response is
   fast and consumes no external quota.

---

### User Story 7 - Remaining shared authorisation helpers are also unreachable (Priority: P3)

The two shared authorisation helper routines that the tenant-isolation rules depend on are also
removed from the client-reachable API surface, closing the residual ability to query an arbitrary
account's role in a known workspace.

**Why this priority**: Deliberately deferred and **explicitly not part of the release gate**.
Unlike the four confirmed vulnerabilities, exploiting these requires already knowing a workspace's
internal identifier, which is not obtainable through any exposed routine. Against that small
residual risk, these two helpers are referenced by roughly fifty tenant-isolation rules and by five
other privileged routines whose stored definitions resolve them by name at execution time — so a
careless change breaks AI settings management and AI extraction confirmation silently, at runtime,
with no migration error. This story is included so the residual risk is tracked rather than
forgotten, and must only be attempted with the full reference inventory in hand.

**Independent Test**: After the change, confirm the two helpers are unreachable directly, then
re-run the complete role-permission and tenant-isolation suites plus the AI settings and extraction
confirmation flows, confirming zero behaviour change.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they directly invoke either shared helper against the data
   API, **Then** the request is rejected.
2. **Given** every tenant-isolation rule that depends on these helpers, **When** the change is
   applied, **Then** each continues to enforce identical access decisions for all four roles and
   for non-members.
3. **Given** the five privileged routines whose definitions reference these helpers by name,
   **When** each is exercised after the change, **Then** all succeed — specifically AI key
   configuration, AI key removal, AI key retrieval, and AI extraction confirmation.
4. **Given** the change cannot be completed without breaking any of the above, **Then** it is
   abandoned and the residual risk is documented — this story may be dropped without affecting the
   release gate.

---

### User Story 8 - Build pipeline dependencies are pinned and audited (Priority: P3)

The automated build pipeline resolves its third-party build steps to exact, immutable versions, and
the project's dependencies are checked automatically for known published vulnerabilities.

**Why this priority**: Lowest priority by explicit direction. The pipeline is already well
positioned — it never exposes credentials to untrusted contributions — so this is hygiene that
reduces future supply-chain risk rather than closing a current hole.

**Independent Test**: Inspect the pipeline definition and confirm every third-party build step
resolves to an immutable version. Confirm a dependency audit runs and reports findings.

**Acceptance Scenarios**:

1. **Given** the build pipeline definition, **When** it is inspected, **Then** every third-party
   build step references an immutable version rather than a moving label.
2. **Given** a dependency with a known published vulnerability, **When** the pipeline runs,
   **Then** the audit step reports it.
3. **Given** the audit step, **When** it reports findings, **Then** the reporting behaviour is
   defined and does not block unrelated work by surprise.

---

### Edge Cases

- **New account signup, where no caller identity exists.** The bootstrap routine runs from account
  creation with no request context, so the identity guard in User Story 2 must treat "no caller
  identity" as legitimate rather than as a mismatch. Getting this wrong breaks all new signups.
- **An account whose stored email drifts from its session email.** The repair path must still
  correct the account's own email; only acting on a *different* identity is refused.
- **A privileged routine that is referenced by name inside another routine's stored definition.**
  Moving a routine without updating those references produces a failure at execution time, not at
  change time — so it is invisible until the dependent flow is exercised.
- **A hosted environment whose API exposure list is configured outside version control.** The
  primary control depends on it. If it were to include the internal grouping, every relocation
  would silently revert to exploitable with no failing test.
- **A local database that has diverged from the recorded change history.** The relocation change
  must produce the same end state whether applied to a freshly rebuilt database or to one where the
  routines have already been moved, are absent, or partially exist.
- **Rolling back after release.** Each change must be independently reversible; reversing the
  exposure fix must not force reversing the identity guard, and vice versa.
- **A throttled request that arrives mid-purchase.** Throttling must never leave a purchase in a
  partially-advanced state; the refusal happens before any state change.
- **A genuine provider webhook arriving in a burst.** Providers legitimately retry and batch.
  Throttling a verified provider signal would silently lose a real payment or refund.
- **Multiple service instances behind a load balancer.** Per-instance throttling counters mean the
  effective allowance is multiplied by the instance count. This is an accepted, documented
  limitation rather than a defect.
- **A restart mid-window.** Because throttling counts live in process memory, a restart resets
  them. Accepted: throttling is a cost control, not a correctness boundary.
- **The throttling mechanism itself failing.** The request is refused rather than allowed, since a
  refusal cannot alter financial or purchase state.
- **An existing test that asserts against the interface description or explorer paths.** Disabling
  them in production must not silently break such a test.
- **A log record whose sensitive content arrives as a formatting argument** rather than embedded in
  the message text.

## Requirements *(mandatory)*

### Functional Requirements

#### Closing the confirmed vulnerabilities (P1 — release blocking)

- **FR-001**: Privileged routines intended solely for the trusted backend MUST NOT be reachable by
  any client that possesses only ordinary end-user credentials.
- **FR-002**: The system MUST provide an internal grouping for privileged routines that is excluded
  from the published client-facing data API, and the four confirmed-vulnerability routines MUST be
  moved into it: the personal-workspace bootstrap routine, the AI-provider-key retrieval routine,
  the email-to-account lookup routine, and the shared-workspace relationship routine.
- **FR-003**: The trusted backend MUST retain the ability to call every relocated routine using its
  existing tenant-isolation-aware database connection. The system MUST NOT introduce use of a
  privileged service-level credential to preserve this access.
- **FR-004**: Every remaining reference to a relocated routine — whether in backend code, in
  another routine's stored definition, or in a tenant-isolation rule — MUST be identified before
  the change and MUST resolve correctly after it.
- **FR-005**: All calls to relocated routines MUST name the routine's grouping explicitly rather
  than relying on name-resolution order.
- **FR-006**: Every relocated or redefined routine MUST continue to pin the set of groupings its
  own internal references resolve against, so that resolution cannot be influenced by a caller.
- **FR-007**: Access rights on relocated routines MUST be the minimum that preserves current
  behaviour: permission to reach the internal grouping and permission to run the specific routines,
  and nothing broader.
- **FR-008**: The personal-workspace bootstrap routine MUST refuse any request that asks it to act
  on an identity other than the caller's, while continuing to permit the account-creation path
  where no caller identity exists.
- **FR-009**: A raw AI provider key MUST NOT be obtainable by any client through any route: not in
  an API response, not through a direct data-API call, not in logs, not in a frontend bundle, and
  not in mobile application state.
- **FR-010**: All existing tenant-isolation rules MUST enforce identical access decisions before
  and after this phase, for Owner, Admin, Member, Viewer, and non-member.
- **FR-011**: The system MUST NOT revoke the permission to run the shared authorisation helper
  routines from ordinary users, because the tenant-isolation rules evaluate those routines as the
  requesting user; revoking it would disable tenant isolation entirely and take the product down.

#### Change safety and reversibility

- **FR-012**: Each database change in this phase MUST produce the same end state whether applied to
  a freshly rebuilt database or to one where the change is already wholly or partly present.
- **FR-013**: Each database change MUST have a documented, tested reversal procedure that restores
  the previous grouping and access rights. The reversal statements MUST be committed inside this
  feature's specification directory and MUST NOT be placed in the applied change-history directory,
  so that the forward change history stays forward-only and environment rebuilds never apply them.
- **FR-014**: The exposure relocation and the identity guard MUST be independently reversible.
- **FR-015**: The correct-by-construction assumption that tenant-isolation rules automatically
  follow a relocated routine MUST be proven on a disposable database **before** the real change is
  authored, together with the complementary proof that a routine referencing a relocated routine by
  name in its stored definition **fails** until redefined. A documented fallback procedure MUST
  exist for the case where the assumption does not hold.
- **FR-016**: The ordering of changes MUST be defined such that no intermediate state leaves the
  product unable to authenticate users or enforce tenant isolation.

#### Abuse protection (P2)

- **FR-017**: The system MUST limit how frequently a single account may create support-checkout
  sessions, submit store-purchase verifications, trigger AI extraction, and request AI summaries.
  The allowances MUST be, within a fixed one-hour window per account: 5 support-checkout creations,
  10 store-purchase verifications, 30 AI extraction triggers, and 10 AI summary requests.
- **FR-018**: A refused throttled request MUST be rejected before any purchase record is created or
  changed, before any payment session is created, and before any external provider is contacted.
- **FR-019**: A throttling refusal MUST return a stable machine-readable error code and a clear
  non-technical message, and MUST NOT disclose the configured threshold or the time remaining in a
  way that aids evasion.
- **FR-020**: Throttling MUST be scoped per account so one account's activity cannot deny service
  to another.
- **FR-021**: Verified provider webhook deliveries MUST NOT be throttled.
- **FR-022**: Idempotency protection for support-checkout creation MUST derive from stable request
  characteristics so that a repeated identical attempt collapses rather than creating an additional
  payment session.
- **FR-023**: Throttling counts MUST be kept per service instance in process memory, introducing no
  new infrastructure dependency. The resulting multiplication of the effective allowance by the
  number of running instances MUST be documented as a known, accepted limitation.
- **FR-024**: If the throttling mechanism itself fails unexpectedly, the request MUST be refused
  rather than allowed, because a refusal cannot alter financial or purchase state whereas allowing
  it would remove the only abuse control.
- **FR-025**: The throttling refusal MUST be presented to the user in both Arabic and English,
  following the existing pattern where the backend returns a stable code and the interface maps it
  to a localised message.

#### Operational hardening (P2)

- **FR-026**: The secret-redaction safeguard MUST apply to every log record the application
  produces, including records originating from individual modules.
- **FR-027**: The redaction safeguard MUST cover sensitive content whether it appears in a record's
  message text or in its formatting arguments.
- **FR-028**: The set of accepted session-token signing methods MUST be determined by trusted
  server-side configuration or trusted key material, never by a value supplied inside the presented
  token.
- **FR-029**: A token presenting an unexpected, mismatched, or malformed signing method MUST be
  rejected as an authentication failure and MUST NOT produce an internal server error.
- **FR-030**: In production the machine-readable interface description and the interactive interface
  explorer MUST be unavailable; in local development they MUST remain available.
- **FR-031**: Diagnostic error detail MUST be withheld unless the environment is positively and
  explicitly identified as a development or test environment; an absent or unrecognised environment
  identity MUST result in diagnostics being withheld.
- **FR-032**: The availability probe MUST respond without making an outbound network request and
  without using a privileged service-level credential.
- **FR-033**: The availability probe MUST NOT be able to occupy request-handling capacity for a
  prolonged period.

#### Deferred and lowest-priority (P3)

- **FR-034**: The two shared authorisation helper routines MAY additionally be relocated, but only
  with the complete inventory of dependent tenant-isolation rules and dependent routine definitions
  established first, and only if all of them are verified to work afterwards. This requirement is
  explicitly outside the release gate and MAY be dropped.
- **FR-035**: Two helper routines that are currently runnable by unauthenticated callers because no
  explicit access restriction was applied — the storage-path parser and the category-assignment
  validator — SHOULD have their access rights tightened to the minimum required. Neither discloses
  information today; this is posture cleanup.
- **FR-036**: Third-party build-pipeline steps SHOULD resolve to immutable versions, and an
  automated dependency vulnerability audit SHOULD run as part of the pipeline.

#### Verification and release gating

- **FR-037**: A security regression suite MUST exist that fails if any relocated routine becomes
  directly reachable by an ordinary user again.
- **FR-038**: A release gate MUST require positive confirmation, recorded as evidence, that the
  target deployment environment's client-facing API exposure list excludes the internal grouping —
  because in hosted environments that setting lives outside version control and its correctness
  cannot be verified by any test running against a local environment.
- **FR-039**: The existing financial-accuracy, role-permission, tenant-isolation, file-privacy, AI
  behaviour, and purchase-verification suites MUST all continue to pass unchanged.

### Key Entities

- **Privileged internal routine**: A database routine that runs with elevated rights and is
  intended to be invoked only by the trusted backend or by internal database automation. Its
  defining characteristic for this phase is whether an ordinary client can reach it.
- **Internal routine grouping**: A named grouping of database routines that is deliberately absent
  from the published client-facing data API. Membership in it is what makes a routine
  client-unreachable.
- **Client-facing API exposure list**: The environment configuration that determines which routine
  groupings the data API publishes. This is the single load-bearing control for the primary fix,
  and in hosted environments it is administered outside version control.
- **Tenant-isolation rule**: A database-level access rule that decides which records a given user
  may read or change. These rules depend on shared authorisation helper routines and must be
  provably unaffected by this phase.
- **Throttling allowance**: The per-account budget of costly or state-changing operations within a
  fixed one-hour window, counted per service instance in process memory.
- **Environment identity**: The configuration value that positively identifies an environment as
  production, development, or test, and which governs interface-explorer availability and
  diagnostic disclosure. Its absence must select the safe behaviour.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An ordinary signed-in user attempting to invoke any of the four
  confirmed-vulnerability routines directly against the data API succeeds **zero** times out of
  four attempts.
- **SC-002**: A signed-in user cannot change any other account's stored email address by any means;
  attempts fail with a permission error and leave the record unmodified.
- **SC-003**: A signed-in user cannot determine whether an arbitrary email address belongs to a
  registered account, and cannot obtain any account's internal identifier from an address.
- **SC-004**: A signed-in user cannot determine whether any two accounts share a workspace.
- **SC-005**: A raw AI provider key appears in **zero** client-observable outputs, verified across
  API responses, direct data-API calls, browser bundles, mobile application state, and log output.
- **SC-006**: All four roles — Owner, Admin, Member, Viewer — plus non-members produce **identical**
  access decisions before and after this phase across the complete role-permission and
  tenant-isolation suites.
- **SC-007**: New-account personal-workspace creation and existing-account personal-workspace repair
  both succeed in 100% of attempts after the change.
- **SC-008**: Inviting an existing user by email resolves to the correct account in 100% of
  attempts, and never resolves to a different account.
- **SC-009**: AI extraction and AI summary complete successfully for Owner, Admin, and Member, and
  remain refused for Viewer and non-members.
- **SC-010**: Every throttled request leaves purchase state, financial totals, and provider state
  **completely unchanged**, verified by comparing state before and after the refused attempt.
- **SC-011**: A verified provider webhook delivery is never refused by throttling.
- **SC-012**: Credential-shaped and address-shaped content written by a module-level logger appears
  redacted in 100% of emitted records.
- **SC-013**: Tokens declaring an unexpected, mismatched, or malformed signing method are rejected
  as authentication failures in 100% of attempts, with **zero** internal server errors.
- **SC-014**: In a production configuration the interface description and interactive explorer are
  unavailable, and no error response contains diagnostic detail — including when the environment
  identity setting is absent entirely.
- **SC-015**: The availability probe makes **zero** outbound network requests and uses **zero**
  privileged credentials.
- **SC-016**: Each database change in this phase can be applied twice in succession with the same
  end state, and can be reversed to restore the prior state.
- **SC-017**: The financial-accuracy, file-privacy, purchase-verification, and webhook-behaviour
  suites all pass with no modifications to their assertions.
- **SC-018**: The release gate records positive documented evidence that the target environment's
  client-facing API exposure list excludes the internal grouping.
- **SC-019**: A throttled refusal renders a correct localised message in both the Arabic and the
  English interface, with no untranslated text.

## Assumptions

- **No product behaviour changes.** This phase is corrective and defensive only. No screen,
  permission, financial rule, or user-visible workflow is intended to change — the one intentional
  addition to the interface is the localised throttling message. Any other observable product
  change is a defect in this phase, not a feature.
- **The trusted backend keeps its current access model.** The backend already connects to the
  database in a mode that carries the requesting user's identity, which is what makes
  tenant-isolation rules apply. Relocated routines stay reachable by that same mode, so no
  privileged service-level credential is introduced. This is a hard constraint, not a preference.
- **The exposure fix's effectiveness depends on environment configuration.** Excluding the internal
  grouping from the published API is what makes the routines unreachable — the access-rights model
  deliberately still permits ordinary users to run them, because the tenant-isolation rules require
  that. This is why User Story 2 exists and why FR-038 is a release gate.
- **Relocating a routine preserves tenant-isolation rules automatically, but not routine
  definitions.** Access rules bind to a routine's identity; stored routine definitions resolve
  references by name at execution time. This asymmetry is the central risk of the phase and is why
  FR-015 requires proving both halves before any real change is authored.
- **The two shared authorisation helpers stay where they are for the release-blocking work.**
  Their residual exposure requires knowing a workspace's internal identifier, which no exposed
  routine reveals. Moving them carries a far larger blast radius than the risk it removes.
- **Three additional published routines were examined and found safe.** The AI-key write, AI-key
  clear, and extraction-confirm routines all derive the acting identity from the session rather
  than from a caller-supplied parameter and enforce their own role checks. They are deliberately
  left in place. Direct invocation would bypass some backend-side input shaping but grants no
  privilege the caller does not already hold.
- **Throttling is best-effort, not a correctness boundary.** It protects cost and availability.
  Correctness continues to rest on the existing authorisation checks and the purchase state
  machine, both unchanged by this phase. Per-instance counting and reset-on-restart are accepted
  consequences of avoiding a new infrastructure dependency.
- **Existing test suites are the regression baseline** and are expected to pass without having
  their assertions modified. A test that must change to accommodate this phase indicates either a
  behaviour change (a defect) or a test that was asserting on an implementation detail.
- **The audit's severity ratings are carried forward as verified.** Each finding in scope was
  re-verified against current repository code before inclusion; the audit's earlier claim that the
  identity rewrite also caused a victim lockout was checked and found incorrect, and is excluded.

## Out of Scope

- Completing, executing, or marking complete the outstanding Phase 17 manual purchase-sweep task.
- Any claim of live payment-provider testing against Stripe, Apple, or Google sandboxes.
- New product features of any kind.
- Redesigning authentication, the workspace model, or the role model.
- Any change to financial calculation rules.
- Subscriptions, premium access, paid tiers, wallets, or virtual currency.
- Refactoring unrelated to the findings in scope.
- Replacing placeholder payment-provider product identifiers, which is a separate release-readiness
  task rather than a security fix.
- Introducing a shared counter store or any other new infrastructure dependency.

## Dependencies

- The Phase 17 security audit report is the source of the findings; every finding carried into this
  spec was independently re-verified against current repository code.
- The existing tenant-isolation rules, role model, and trusted backend connection model are
  preconditions and must remain intact.
- Verifying the release gate in FR-038 requires access to the target deployment environment's API
  settings, which is an administrative capability outside the codebase.
