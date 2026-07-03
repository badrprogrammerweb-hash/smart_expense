# Feature Specification: BYOK AI Settings

**Feature Branch**: `007-byok-ai-settings`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "BYOK AI Settings (Phase 7). Add an AI settings area where authorized workspace members can bring their own AI provider key (BYOK) to enable optional AI features later. Support selecting an AI provider — Gemini or OpenAI — per workspace and storing exactly one active provider key at a time. Store the API key securely using Supabase Vault; the key MUST NEVER be returned to or exposed in the frontend (only non-secret metadata such as provider name, masked hint, configured status, and last-updated time may be shown). Allow replacing the stored key and removing/clearing it. All key read/write/validation happens on the backend; the frontend never receives the raw key. Configuring, replacing, or removing the BYOK key is restricted by workspace role. The app MUST remain fully usable without any BYOK configured — manual income, expense, category, file, and report workflows are unaffected whether or not a key is present. Do NOT implement AI extraction, AI calls, or any AI-powered feature in this phase; this phase only manages provider selection and secure key storage/lifecycle plus the settings UI. Provider key format validation should be lightweight (shape only), and this phase does not make live calls to the provider to verify the key."

## Clarifications

### Session 2026-07-04

- Q: Which workspace role may configure, replace, or remove the BYOK key? → A:
  Owner only — the same treatment as other workspace-level sensitive settings;
  Admins, Members, and Viewers cannot change it. A conservative default for a
  billable credential that is easier to widen later than to claw back.
- Q: What exactly is shown as the "masked hint" of the stored key? → A: The
  provider name plus only the last 4 characters of the key; no other portion of
  the key is ever exposed, and 4 trailing characters are not enough to
  reconstruct it.
- Q: Who may view the non-secret AI settings status (provider, configured
  status, masked hint, last-updated time)? → A: All authorized workspace members
  including Viewers (read-only), consistent with members' ability to view other
  workspace metadata; only the Owner may change it.
- Q: On key replacement or removal, is any record of the prior key retained? →
  A: No — the previous secret is destroyed and no prior-key history is kept. Only
  the single current active configuration is stored, with record-level who/when
  traceability (updated-by / updated-at); a general activity-feed entry is
  deferred to the Phase 9 history/activity feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure a BYOK provider and API key for a workspace (Priority: P1)

A workspace Owner opens AI settings for their active workspace, selects an AI
provider (Gemini or OpenAI), enters that provider's API key, and saves. The key
is stored securely on the backend. The settings screen then shows the workspace
as "AI configured" with the selected provider, a masked hint of the key, and
when it was last updated — but never the key itself.

**Why this priority**: This is the foundational capability of the phase and the
first exit criterion ("Authorized users can configure BYOK"). Every other story
(view status, replace, remove) depends on a key having been configured. It
delivers standalone value: a workspace becomes AI-ready for the later extraction
phase without any AI behavior existing yet.

**Independent Test**: Sign in as the Owner of a workspace, select a provider,
submit a validly-shaped key, and confirm the workspace shows "configured" with
the correct provider, a masked hint, and a last-updated time — and that the raw
key is not present anywhere in the response.

**Acceptance Scenarios**:

1. **Given** an Owner in AI settings for a workspace with no key configured,
   **When** they select a supported provider and submit a validly-shaped API
   key, **Then** the key is stored securely, the workspace becomes "AI
   configured" for that provider, and the response contains only non-secret
   metadata (provider, masked hint, configured status, last-updated time).
2. **Given** an Owner submitting a key that fails lightweight shape validation
   (e.g., empty, whitespace-only, or not matching the provider's expected
   format), **When** they save, **Then** the request is rejected with a clear
   message and nothing is stored.
3. **Given** an Owner, **When** they attempt to save a provider selection
   without providing a key, **Then** the request is rejected because a
   configured state requires both a provider and a key.
4. **Given** a workspace that already has a key configured, **When** the Owner
   configures again with a new provider and/or new key, **Then** it is treated
   as a replacement: exactly one active provider and key remain and the previous
   secret is no longer stored.
5. **Given** a validly-shaped but incorrect or already-revoked key, **When** the
   Owner saves it, **Then** it is accepted and stored this phase (no live
   provider verification occurs); correctness is only exercised in the later AI
   phase.

---

### User Story 2 - View AI settings status without ever exposing the key (Priority: P1)

Any member of the workspace can open AI settings and see whether a key is
configured, which provider is selected, a masked hint of the stored key, and
when it was last updated. The raw API key is never returned to the client under
any circumstance — not in the settings view, not in any list, and not in any
error message.

**Why this priority**: Key confidentiality is the core security guarantee of the
phase and a NON-NEGOTIABLE constitutional test item ("API keys must never be
exposed to the frontend"). It must ship alongside configuration for the feature
to be trustworthy, and it is independently testable against every response path.

**Independent Test**: With a key configured, request the AI settings status as
each role and inspect every field of every response (status view, any listing,
and forced error responses); confirm the raw key value never appears while the
masked hint and metadata do.

**Acceptance Scenarios**:

1. **Given** a workspace with a configured key, **When** any authorized member
   views AI settings, **Then** they see provider, configured status, a masked
   hint (e.g., only a few trailing characters), and last-updated time, and never
   the full key.
2. **Given** any AI settings read, write, or error response, **When** its
   contents are inspected, **Then** no field, log line, or error message
   contains the raw key or enough of it to reconstruct it.
3. **Given** a workspace with no key configured, **When** a member views AI
   settings, **Then** the status clearly shows "not configured" with no provider
   and no hint.
4. **Given** an unauthenticated request or a user who is not a member of the
   workspace, **When** they request the workspace's AI settings, **Then** access
   is denied and no configuration data is returned.

---

### User Story 3 - Replace or rotate the stored key / switch provider (Priority: P2)

A workspace Owner whose workspace already has a configured key can replace it —
either rotating to a new key for the same provider, or switching to a different
provider by supplying that provider's new key. After a successful replacement,
exactly one active provider and key remain and the previous secret is
destroyed.

**Why this priority**: Rotation and provider switching are required by the phase
goals ("Allow key replacement"). They build on configuration (P1) and matter for
security hygiene (rotating a leaked or expired key), but the workspace is already
usable once P1 ships.

**Independent Test**: Configure a key, then replace it with a different
validly-shaped key (same provider), confirm the masked hint and last-updated
time change and the old secret is gone; then switch to the other provider with a
new key and confirm the provider changes and only one key remains.

**Acceptance Scenarios**:

1. **Given** a configured workspace, **When** the Owner submits a new
   validly-shaped key for the same provider, **Then** the stored key is replaced,
   the masked hint and last-updated time update, and the prior key is no longer
   retrievable.
2. **Given** a configured workspace, **When** the Owner selects the other
   supported provider and submits a new key for it, **Then** the provider
   switches, the new key is stored, and the previously stored key/provider are
   replaced so that exactly one active configuration remains.
3. **Given** a replacement attempt with a key that fails shape validation,
   **When** the Owner saves, **Then** the replacement is rejected and the
   existing configuration is left unchanged.
4. **Given** a successful replacement, **When** the change completes, **Then**
   the record reflects who replaced the key and when (updated-by / updated-at)
   without storing the secret, and the secret appears in no log or error output.

---

### User Story 4 - Remove / clear the stored key (Priority: P2)

A workspace Owner removes the workspace's AI key. The stored secret is destroyed,
the workspace returns to "not configured," and any non-secret metadata reflects
that no API key is present. Removal never affects any manual financial data.

**Why this priority**: Removal is required by the phase goals ("removal") and is
important for privacy hygiene, but it is safe to ship after configuration and
replacement exist.

**Independent Test**: With a key configured, remove it as the Owner and confirm
the status becomes "not configured" and the secret is unrecoverable; then
confirm a non-Owner cannot remove it.

**Acceptance Scenarios**:

1. **Given** a configured workspace, **When** the Owner removes the key, **Then**
   the stored secret is destroyed, the workspace shows "not configured," and no
   provider or masked hint remains.
2. **Given** a workspace with no key configured, **When** the Owner triggers
   removal, **Then** the operation is a safe no-op with a clear message and no
   error state.
3. **Given** a successful removal, **When** it completes, **Then** the workspace
   is left in a clean not-configured state and the secret appears in no log or
   error output. (A general activity-feed entry for removal is deferred to the
   Phase 9 history/activity feature.)
4. **Given** the key has been removed, **When** anyone views AI settings
   afterward, **Then** the raw key is not recoverable through any path.

---

### User Story 5 - Use the app fully without any BYOK configured (Priority: P2)

A user works in a workspace that has no AI key configured. They can still add
income, add expenses, manage categories, upload and access files, and view
reports exactly as before. The absence (or presence) of a BYOK key does not
change, block, or degrade any manual workflow.

**Why this priority**: The product is manual-first and AI-optional by
constitution, and "App works without BYOK" is an explicit exit criterion. This
guarantee must be verified so the AI settings surface never becomes a dependency
for core budgeting.

**Independent Test**: In a workspace with no key configured, complete a full
manual flow (create income, create an expense, create a category, upload a file,
open a report); then configure a key and repeat the same flow; confirm both runs
succeed identically and neither depends on the key.

**Acceptance Scenarios**:

1. **Given** a workspace with no AI key configured, **When** a user performs any
   manual income, expense, category, file, or report action, **Then** it
   succeeds unchanged and no AI configuration is required.
2. **Given** a workspace with an AI key configured, **When** a user performs the
   same manual actions, **Then** they behave identically — no AI processing is
   triggered in this phase.
3. **Given** either state (configured or not), **When** the dashboard and
   reports are viewed, **Then** financial totals and remaining balance are
   unaffected by BYOK configuration.

---

### Edge Cases

- **Configuring over an existing key**: Saving a configuration when one already
  exists is treated as a replacement (one path), not a duplicate or an error;
  only one active provider+key is ever stored per workspace.
- **Provider without a key / key without a provider**: Neither partial state is
  storable; a configured state always has both a provider and a key.
- **Empty or whitespace-only key**: Rejected by shape validation; nothing is
  stored and no existing configuration is disturbed.
- **Malformed key for the selected provider**: A key that does not match the
  selected provider's expected shape is rejected with a clear message.
- **Valid-shape but wrong/revoked key**: Accepted and stored this phase; no live
  call is made to verify it. Real verification is deferred to the AI phase when
  the key is first used.
- **Remove when nothing is configured**: Safe no-op with a clear message; not an
  error.
- **Concurrent changes by two authorized users**: The result is a single active
  configuration (last successful write wins); the system never ends up with two
  stored keys.
- **Cross-workspace isolation**: Reading or changing AI settings always fails
  when the actor is not an authorized member of the target workspace; one
  workspace's key is never visible or mutable from another.
- **Role change mid-session**: Authorization is evaluated per request, so a user
  demoted from Owner can no longer configure/replace/remove even if the control
  was visible when their session started.
- **Secret in logs/errors**: The raw key never appears in logs, error messages,
  history events, or any diagnostic output.

## Requirements *(mandatory)*

### Functional Requirements

**Provider and key configuration**

- **FR-001**: System MUST let an authorized user select an AI provider for a
  workspace from a fixed set of exactly two supported providers: Gemini and
  OpenAI.
- **FR-002**: System MUST store at most one active AI provider and one active
  API key per workspace at any time.
- **FR-003**: System MUST treat a "configured" state as requiring both a
  selected provider and a stored key together; System MUST reject any attempt to
  reach a configured state with a provider but no key, or a key but no provider.
- **FR-004**: System MUST perform lightweight, shape-only validation of a
  submitted API key appropriate to the selected provider (e.g., non-empty,
  expected prefix/length/character-set) and MUST reject keys that fail this
  validation with a clear message, storing nothing.
- **FR-005**: System MUST NOT make any live call to the AI provider to verify the
  key in this phase; a validly-shaped key is accepted and stored without
  correctness verification (verification is deferred to the AI extraction phase).

**Confidentiality and no frontend exposure**

- **FR-006**: System MUST store the API key securely on the backend such that it
  is encrypted at rest and is never persisted in plaintext application data.
- **FR-007**: System MUST NEVER return the raw API key to any client in any
  response, including settings reads, listings, write confirmations, and error
  responses.
- **FR-008**: System MUST expose only non-secret configuration metadata to
  clients: selected provider, configured status, a masked hint consisting of the
  provider name plus at most the last 4 characters of the key (never any other
  portion, and never enough to reconstruct it), last-updated timestamp, and who
  last updated it.
- **FR-009**: System MUST NOT write the raw API key (or any reconstructable
  portion of it) to logs, error messages, history/activity records, or any
  diagnostic output.
- **FR-010**: All reading, writing, and validation of the API key MUST occur on
  the backend; the frontend MUST only ever handle the key transiently at input
  time and MUST never receive it back.

**Replace, rotate, and switch provider**

- **FR-011**: System MUST allow an authorized user to replace the stored key with
  a new validly-shaped key for the same provider, updating the masked hint and
  last-updated timestamp.
- **FR-012**: System MUST allow an authorized user to switch the workspace to the
  other supported provider by supplying a new key for that provider, replacing
  the previous provider and key so exactly one active configuration remains.
- **FR-013**: On any successful replacement or provider switch, System MUST
  destroy the previously stored secret so it is no longer retrievable, and MUST
  NOT retain any prior-key history — only the single current active
  configuration is kept (with the record-level who/when traceability of FR-024).
- **FR-014**: System MUST reject a replacement whose new key fails shape
  validation and MUST leave the existing configuration unchanged.

**Remove / clear**

- **FR-015**: System MUST allow an authorized user to remove the workspace's AI
  key, destroying the stored secret and returning the workspace to a "not
  configured" state with no provider and no masked hint.
- **FR-016**: System MUST treat removal on a workspace with no configured key as
  a safe no-op (clear message, not an error).

**Manual-first / AI-optional guarantee**

- **FR-017**: System MUST keep all manual workflows (income, expense, category,
  file upload/access, and reports) fully functional whether or not a BYOK key is
  configured; BYOK configuration MUST NOT be a precondition for any manual
  action.
- **FR-018**: System MUST NOT trigger any AI extraction, AI call, or AI-powered
  behavior in this phase; configuring a key only stores it for future use.
- **FR-019**: BYOK configuration state MUST NOT affect financial totals, the
  remaining-balance calculation, dashboard data, or reports.

**Authorization and isolation (cross-cutting)**

- **FR-020**: System MUST restrict configuring, replacing, and removing the BYOK
  key to the workspace Owner only; Admins, Members, and Viewers MUST NOT be able
  to change it.
- **FR-021**: System MUST allow all authorized workspace members to view the
  non-secret AI settings status (provider, configured status, masked hint,
  last-updated time), consistent with their ability to view other workspace
  metadata.
- **FR-022**: System MUST evaluate authorization for every AI settings operation
  per request against the actor's current role and workspace membership.
- **FR-023**: System MUST prevent any AI provider configuration or its metadata
  from being read or modified by anyone outside the owning workspace (tenant
  isolation), and MUST deny unauthenticated requests.

**Traceability (cross-cutting)**

- **FR-024**: System MUST capture, on the AI settings record, who last
  configured or replaced the key and when (updated-by and updated-at) and which
  provider is active — without storing the secret or any reconstructable portion
  of it. A dedicated entry in a general activity/history feed for configure/
  replace/remove is deferred to the Phase 9 history/activity feature (which does
  not exist yet); this phase provides record-level traceability only and MUST NOT
  write the secret to any log, error, or diagnostic output.

### Key Entities *(include if feature involves data)*

- **AI Provider Configuration (BYOK)**: A workspace-scoped record describing the
  workspace's AI settings. Key attributes: owning workspace, selected provider
  (Gemini or OpenAI), configured status, masked hint of the stored key,
  reference to the securely stored secret (never the secret value itself),
  identity of who last updated it, and last-updated timestamp. At most one active
  record exists per workspace.
- **Stored API Key (secret)**: The raw provider API key. Held only in secure
  server-side secret storage, encrypted at rest, and never returned to any
  client. Managed exclusively through the configuration lifecycle (configure /
  replace / remove).
- **Workspace (existing)**: An existing entity from prior phases. Gains an
  optional AI provider configuration and is the isolation boundary that owns the
  configuration and controls access.
- **Workspace Membership / Role (existing)**: Existing Owner/Admin/Member/Viewer
  roles determine who may configure/replace/remove the key (Owner only) versus
  view the non-secret status (all members).
- **Activity / History (Phase 9, not yet built)**: A general activity/history
  feed does not exist yet — it is Phase 9 scope. This phase provides only
  record-level traceability via the configuration's updated-by / updated-at
  fields; surfacing BYOK configure/replace/remove in an activity feed is deferred
  to Phase 9. No secret is ever recorded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A workspace Owner can select a provider, enter a key, and see the
  workspace shown as "AI configured" in under 1 minute.
- **SC-002**: The raw API key never appears in any client-visible output —
  across 100% of AI settings read, write-confirmation, listing, and error
  responses in testing, the number of occurrences of the raw key is zero.
- **SC-003**: 100% of attempts to configure, replace, or remove the BYOK key by a
  non-Owner (Admin, Member, or Viewer) are rejected.
- **SC-004**: Manual workflows (income, expense, category, file, report) succeed
  in 100% of test runs whether or not a key is configured, confirming BYOK is not
  a dependency of any manual action.
- **SC-005**: After removal, the workspace shows "not configured" and the prior
  secret is unrecoverable through any path in 100% of subsequent reads.
- **SC-006**: After any replacement or provider switch, exactly one active
  provider and key remain and the prior secret is unrecoverable in 100% of
  tests.
- **SC-007**: Cross-workspace isolation holds in 100% of tested cases — a member
  of one workspace can never read or change another workspace's AI configuration
  or status.
- **SC-008**: The AI settings record captures who configured/replaced the key
  and when for 100% of configure/replace operations, and the raw secret appears
  in zero log lines, error messages, or diagnostic outputs across 100% of
  configure/replace/remove operations in testing.

## Assumptions

- **Existing foundation reused**: Authentication, workspaces, membership/roles,
  income, expenses, categories, files, and reports from Phases 2–6 are reused
  unchanged; this phase only adds the workspace-scoped AI provider configuration
  and its lifecycle.
- **BYOK is workspace-scoped**: Provider selection and the stored key belong to
  the workspace (not to an individual user), so one team workspace has one active
  AI configuration shared by its members. This matches the "per workspace"
  framing in the feature description.
- **Owner-only management**: Configuring, replacing, and removing the BYOK key is
  restricted to the workspace Owner (confirmed in Clarifications) — structurally
  the same treatment as other workspace-level sensitive settings (e.g., the
  auto-delete setting), and a conservative default for a billable credential that
  is easier to widen later than to claw back. All members (including Viewers) may
  still view the non-secret status.
- **Supported providers**: Exactly two providers are supported this phase —
  Gemini and OpenAI. Adding other providers is out of scope.
- **One active key at a time**: A workspace stores at most one provider and one
  key. There is no history of prior keys and no multiple-key management;
  replacing or switching destroys the previous secret (confirmed in
  Clarifications).
- **Masked hint**: The masked hint is the provider name plus at most the last 4
  characters of the key (confirmed in Clarifications), shown purely to help a
  user recognize which key is stored. Four trailing characters never reveal
  enough to reconstruct the key.
- **Shape-only validation, deferred verification**: Key validation this phase is
  lightweight and format-based only. A syntactically valid but wrong or revoked
  key is accepted and stored; the system does not call the provider to verify it.
  Real verification happens later when the key is first used for AI extraction
  (Phase 8). This is an intentional scope boundary, not a missing behavior.
- **No AI behavior this phase**: No AI extraction, AI calls, category
  suggestions, summaries, or any other AI-powered feature is implemented here.
  This phase delivers only provider selection, secure key storage/lifecycle, and
  the settings UI, readying the workspace for the later AI phase.
- **No general activity/history feed yet**: No activity/history/audit table
  exists in the codebase (it is Phase 9 scope). This phase therefore records
  configure/replace traceability only at the record level (updated-by /
  updated-at on the AI settings record) and does not build an activity feed. The
  never-log-the-secret guarantee is independent of this and still applies. This
  is an intentional scope boundary, not a missing behavior.
- **Out of scope this phase**: AI extraction and any AI provider calls; usage
  metering, quotas, or cost tracking; per-user (as opposed to per-workspace)
  keys; more than two providers; storing multiple or historical keys; and live
  key verification are all out of scope.
