# Feature Specification: AI Extraction and Review

**Feature Branch**: `008-ai-extraction-review`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "AI Extraction and Review (Phase 8). Add an extraction job workflow so authorized workspace members can trigger AI-based extraction of structured data (amount, currency, date, vendor/merchant, category suggestion) from an already-uploaded receipt or invoice file, using the workspace's configured BYOK provider (Gemini or OpenAI) from Phase 7. Extraction results are stored as a pending/draft record — never as a confirmed expense and never affecting totals, reports, or remaining balance until a user reviews and confirms them. Build a review screen showing the extracted fields alongside the source file so the user can correct any field before confirming. Confirming creates/links a real expense record; discarding removes the draft without creating one. Handle provider errors (invalid/revoked key, rate limit, timeout, unparseable file, malformed provider response) safely, without exposing the API key or other secrets, and without deleting the source file on failure. Respect the workspace's existing auto-delete-after-extraction setting from Phase 6. Do not implement AI extraction when BYOK is not configured, OCR fallback without AI, bulk/batch extraction, editing a confirmed expense's link back to its extraction record, or AI-generated spending summaries (Phase 9)."

## Clarifications

### Session 2026-07-04

- Q: Can a Member confirm or discard an extraction that a different Member
  triggered, or only one they personally triggered? → A: Owners and Admins may
  confirm/discard any extraction in the workspace; a Member may confirm or
  discard only an extraction they personally triggered. This mirrors the
  existing Phase 3 rule that Members may edit/delete only the expense records
  they personally created.
- Q: Can Viewers see a pending/draft extraction's fields and status (read-only),
  or is extraction data hidden from them entirely until confirmed? → A: Viewers
  CAN view an extraction's status and draft fields read-only, including on the
  review screen, but cannot trigger, edit, confirm, discard, or retry. This
  matches the Phase 6 precedent of Viewers having read-only access to files.
- Q: Which timing does the existing Phase 6 "auto-delete after extraction"
  setting implement — delete only after the user confirms, or delete
  immediately once extraction succeeds (before review)? → A: Delete only after
  a successful extraction AND user confirmation — the constitution's stated
  default behavior. The single boolean already shipped in Phase 6 is reused
  as-is; no second "delete immediately" variant is added this phase.
- Q: Can an extraction stay "processing" indefinitely if the provider never
  responds, or must it eventually time out? → A: It MUST time out — if the
  provider call does not complete within a bounded period, the system marks
  the extraction "failed" with a timeout message so the file is never stuck
  and can be retried. The exact duration is a planning detail, not a product
  requirement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trigger AI extraction on an uploaded receipt or invoice (Priority: P1)

An authorized workspace member (Owner, Admin, or Member) with AI configured
(Phase 7 BYOK) selects an already-uploaded file and triggers AI extraction. The
system calls the workspace's configured provider, and the file's extraction
status updates from "processing" to either "ready for review" (with draft
structured data) or "failed" (with a clear, safe reason).

**Why this priority**: Without triggering extraction there is no feature. This
is the entry point every other story depends on, and it delivers standalone
value: a member can see the app attempt to read a receipt automatically instead
of typing every field by hand.

**Independent Test**: With BYOK configured, upload a receipt image, trigger
extraction, and confirm the file's status becomes "ready for review" with
draft fields populated (or "failed" with a safe message if the provider call
does not succeed), without any expense or total being affected either way.

**Acceptance Scenarios**:

1. **Given** an authorized member in a workspace with BYOK configured and an
   uploaded file with no active extraction, **When** they trigger extraction,
   **Then** the system calls the configured provider and the file shows a
   "processing" status.
2. **Given** a processing extraction that succeeds, **When** the provider
   returns structured data, **Then** a draft extraction record is created with
   whatever fields could be read (amount, currency, date, vendor, suggested
   category), the status becomes "ready for review," and no expense or total is
   affected.
3. **Given** a workspace with no BYOK key configured, **When** a member
   attempts to trigger extraction, **Then** the action is rejected with a clear
   message directing them to configure AI settings first, and no provider call
   is made.
4. **Given** a Viewer, **When** they attempt to trigger extraction, **Then**
   the action is unavailable to them and any direct attempt is rejected as
   unauthorized.
5. **Given** a file that already has an in-progress (processing) or completed-
   but-unreviewed (ready for review) extraction, **When** a member attempts to
   trigger a new extraction on the same file, **Then** the new attempt is
   rejected until the existing one is confirmed, discarded, or has failed.

---

### User Story 2 - Review, correct, and confirm an extraction into an expense (Priority: P1)

A workspace member opens a "ready for review" extraction and sees the draft
fields (amount, currency, date, vendor/merchant, suggested category) next to
the source file. They correct any field that is wrong or missing, then
confirm. Confirming creates a real expense record from the (possibly
corrected) fields, links it to the source file and the extraction, and the new
expense immediately affects totals and reports.

**Why this priority**: This is the core value proposition and a direct exit
criterion ("Results require user confirmation," "Confirmed results affect
totals"). Extraction without a trustworthy review-and-confirm step would
violate the manual-first, AI-optional principle, so it ships alongside
triggering as the other half of the P1 slice.

**Independent Test**: Produce a "ready for review" extraction, edit one
field on the review screen, confirm it, and verify a new expense exists with
the edited values, the dashboard/report totals reflect it, and the extraction
is marked confirmed and linked to the new expense.

**Acceptance Scenarios**:

1. **Given** a "ready for review" extraction, **When** an authorized member
   opens the review screen, **Then** they see every extracted field alongside
   a preview of the source file, with fields the provider could not determine
   shown clearly as empty/needs-input rather than guessed.
2. **Given** the review screen, **When** the member edits any field (amount,
   currency, date, vendor/merchant, category), **Then** the edited values are
   what get used if they confirm.
3. **Given** a review with a valid amount and date (after any edits),
   **When** the member confirms, **Then** a new expense record is created in
   the same workspace using the reviewed values, the extraction is marked
   "confirmed" and linked to the new expense, and the source file remains
   linked to the resulting expense.
4. **Given** a review where the amount is missing, zero, or negative, or the
   date is missing or invalid, **When** the member attempts to confirm,
   **Then** confirmation is rejected with a clear message and no expense is
   created, consistent with the existing expense validation rules.
5. **Given** a confirmed extraction, **When** anyone views reports or the
   dashboard afterward, **Then** the resulting expense is included in totals
   exactly like a manually entered expense, and the extraction itself never
   appears as a separate total.
6. **Given** an unconfirmed ("ready for review," "processing," or "failed")
   extraction, **When** totals or reports are computed, **Then** it is
   entirely excluded from every total and report figure.
7. **Given** a Viewer, **When** they open the review screen, **Then** they see
   the same draft fields and file preview read-only, with no edit, confirm,
   or discard controls available.
8. **Given** a Member who did not trigger a particular extraction, **When**
   they attempt to confirm it, **Then** the attempt is rejected because only
   the triggering Member (or an Owner/Admin) may confirm it; they may still
   view it read-only.

---

### User Story 3 - Discard an extraction without creating an expense (Priority: P2)

A workspace member decides a "ready for review" or "failed" extraction is not
useful (for example, the file was not actually a receipt, or the draft is too
inaccurate to fix) and discards it. The draft is removed from the review
queue, no expense is created, and the source file is unaffected and remains
available (including for re-triggering extraction later).

**Why this priority**: Confirmation (P1) needs a safe "no" counterpart so
low-quality drafts do not pile up or force a bad confirmation, but the
workspace is usable without it since P1 already guarantees drafts never
affect totals on their own.

**Independent Test**: Produce a "ready for review" extraction, discard it, and
confirm no expense was created, the file still exists and is unlinked, and the
member can trigger a new extraction on the same file afterward.

**Acceptance Scenarios**:

1. **Given** a "ready for review" extraction, **When** an authorized member
   discards it, **Then** no expense is created, the extraction is marked
   discarded, and it no longer appears in the pending-review list.
2. **Given** a "failed" extraction, **When** an authorized member discards it,
   **Then** it is removed from the pending/failed list the same way.
3. **Given** a discarded extraction, **When** the member views the source
   file afterward, **Then** the file still exists, is not linked to any
   expense, and a new extraction can be triggered on it.
4. **Given** a Viewer, **When** they attempt to discard an extraction,
   **Then** the action is unavailable to them and any direct attempt is
   rejected as unauthorized.
5. **Given** a Member who did not trigger a particular extraction, **When**
   they attempt to discard it, **Then** the attempt is rejected; only the
   triggering Member or an Owner/Admin may discard it.

---

### User Story 4 - Safe handling of provider and extraction errors (Priority: P2)

While extraction is running, the provider call can fail in several ways: the
stored key is invalid or revoked, the provider rate-limits or times out, the
file cannot be parsed (e.g., unreadable image, corrupt PDF), or the provider
returns a response the system cannot understand. In every case, the extraction
is marked "failed" with a clear, safe, user-facing message; no secret is ever
exposed; the source file and file list are unaffected; and the member can
retry.

**Why this priority**: This directly protects the "manual-first, AI-optional"
and privacy/security principles and is required for the feature to be
trustworthy in production, but it is a safety net around the P1 happy path
rather than the primary flow itself.

**Independent Test**: Force each error condition (invalid key, simulated
timeout/rate limit, an unparseable file, a malformed provider response) and
confirm each produces a "failed" status with a safe, non-secret message, the
file is retained and unchanged, and a subsequent retry is possible.

**Acceptance Scenarios**:

1. **Given** a workspace whose stored key is invalid or has been revoked by
   the provider, **When** extraction is triggered, **Then** the extraction
   fails with a message indicating the AI key needs attention, and the raw key
   or provider error internals are never shown to the user or written to logs.
2. **Given** the provider rate-limits or times out, **When** extraction is
   triggered, **Then** the extraction fails with a message indicating the
   provider is temporarily unavailable, and the member can retry later.
3. **Given** a file the provider cannot parse (unreadable image, corrupt or
   password-protected PDF), **When** extraction is triggered, **Then** the
   extraction fails with a message indicating the file could not be read, and
   the file itself is left exactly as it was.
4. **Given** a provider response that does not match the expected structured
   format, **When** it is received, **Then** the system treats it as a failure
   rather than guessing at partial or malformed data, and no partially-formed
   draft is created.
5. **Given** any failed extraction, **When** it occurs, **Then** the source
   file is never deleted or modified as a result of the failure, regardless of
   the workspace's auto-delete setting.
6. **Given** a failed extraction, **When** an authorized member retries, **Then**
   a new extraction attempt can be triggered on the same file and the prior
   failed attempt is retained for history rather than silently overwritten.

---

### User Story 5 - Auto-delete the source file after a confirmed extraction (Priority: P3)

A workspace has the Phase 6 "auto-delete uploaded files after successful AI
extraction" setting enabled. When a member confirms an extraction into an
expense, the source file's binary is deleted from private storage right after
confirmation succeeds; the expense, the extraction record, and the file's
metadata (including that it once existed and was linked) are retained.

**Why this priority**: Required to make the Phase 6 setting meaningful
("Respect auto-delete settings") and to close the loop between the two prior
phases, but it only matters after triggering, review, and confirmation already
work, and most workspaces will leave the default (off).

**Independent Test**: Enable the auto-delete setting, run an extraction to a
successful confirmation, and confirm the file's binary is no longer
retrievable afterward while the expense and file metadata (marked deleted)
remain intact; repeat with the setting off and confirm the file binary is
retained.

**Acceptance Scenarios**:

1. **Given** a workspace with auto-delete enabled, **When** a member confirms
   an extraction into an expense, **Then** the source file's binary is deleted
   from storage immediately after the expense is created, and the file's
   metadata is retained and marked deleted for traceability.
2. **Given** a workspace with auto-delete disabled (the default), **When** a
   member confirms an extraction, **Then** the source file's binary is
   retained unchanged.
3. **Given** auto-delete enabled, **When** an extraction fails or is
   discarded rather than confirmed, **Then** the source file is never deleted
   as a result (deletion only ever follows a successful confirmation).
4. **Given** an extraction confirmed under auto-delete, **When** the
   resulting expense is viewed afterward, **Then** it still shows that a
   receipt/invoice backed it, even though the file binary is gone.

---

### Edge Cases

- **BYOK removed between trigger and completion**: If the workspace's AI key
  is removed (Phase 7) while an extraction is still processing, the in-flight
  attempt is allowed to finish (succeed or fail) but no new extraction may be
  triggered until BYOK is reconfigured.
- **File deleted before extraction completes**: Triggering extraction on a
  file that has since been deleted, or a file being deleted while extraction
  is processing, results in a failed extraction; no draft is created from a
  file whose binary is gone.
- **Partial provider data**: A provider response missing some fields (e.g., no
  date found) still produces a "ready for review" draft with those fields
  blank, not a failure — missing-field validation happens at confirm time, not
  at extraction time.
- **Confirming with a non-SAR currency hint**: If the provider detects a
  non-SAR currency, the draft shows it as extracted, but the resulting expense
  still uses the single-currency (SAR) amount field; no automatic currency
  conversion occurs, and the member must correct the amount if needed.
- **Suggested category not in workspace**: If the provider suggests a category
  that does not exist in the workspace's active category list, the suggestion
  is shown as text but the review screen requires picking from the workspace's
  actual categories (or leaving it uncategorized) to confirm.
- **Cross-workspace isolation**: Triggering, viewing, confirming, or
  discarding an extraction always fails when the actor and the target file/
  extraction are not in the same workspace the actor is authorized for.
- **Role change mid-review**: Authorization is evaluated per request, so a
  user demoted to Viewer between opening the review screen and confirming can
  no longer confirm or discard even if the controls were visible when the
  screen loaded.
- **Re-extraction after discard or failure**: A file with a discarded or
  failed extraction can have a new extraction triggered on it; each attempt is
  a separate, retained history record.
- **Duplicate confirmation attempts**: Confirming the same "ready for review"
  extraction twice (e.g., a double-submit) results in exactly one expense
  being created, not two.
- **Member acting on another Member's extraction**: A Member who did not
  trigger a given extraction cannot confirm or discard it (only view it,
  same as a Viewer's read access); only Owners/Admins or the Member who
  triggered it may confirm or discard.
- **Stuck processing state**: An extraction that has been "processing" longer
  than the system's bounded timeout is automatically marked "failed" with a
  timeout message rather than remaining processing indefinitely, so the file
  is never permanently blocked from re-extraction.
- **Re-extracting an already-linked file**: A file already linked to an
  expense (from a prior confirmed extraction or a manual link) cannot have a
  new extraction triggered on it, because a file may be linked to at most one
  expense at a time (Phase 6); it must be detached first.

## Requirements *(mandatory)*

### Functional Requirements

**Triggering extraction**

- **FR-001**: System MUST allow Owners, Admins, and Members of a workspace to
  trigger AI extraction on an existing, non-deleted file belonging to that
  workspace.
- **FR-002**: System MUST reject a trigger attempt when the workspace has no
  BYOK provider/key configured (Phase 7), with a clear message directing the
  user to AI settings, and MUST NOT call any provider.
- **FR-003**: System MUST reject a trigger attempt when the target file
  already has an extraction in a non-terminal state (processing) or in a
  completed-but-unreviewed state (ready for review); the existing extraction
  must be confirmed, discarded, or have failed before a new one can start.
- **FR-003a**: System MUST reject a trigger attempt when the target file is
  already linked to an expense (whether from a prior confirmed extraction or
  a manual Phase 6 link), consistent with the existing rule that a file may
  be linked to at most one expense at a time; the file must first be
  unlinked/detached before a new extraction can be triggered on it.
- **FR-004**: System MUST call the workspace's configured AI provider using
  the workspace's stored key to request structured data (amount, currency,
  transaction date, vendor/merchant, category suggestion) from the file's
  content, without ever exposing the raw key outside the backend.
- **FR-005**: System MUST NOT allow Viewers to trigger extraction.
- **FR-006**: System MUST NOT allow an extraction to remain "processing"
  indefinitely; if the provider call does not complete within a bounded
  timeout, System MUST mark it "failed" with a timeout message so the file is
  never permanently stuck and can be retried.

**Draft storage and non-effect on totals**

- **FR-007**: System MUST store a successful extraction's output as a
  reviewable draft record with a status distinct from "confirmed," and MUST
  NOT create an expense record automatically from it.
- **FR-008**: System MUST exclude every extraction record that is not in the
  "confirmed" state (processing, ready for review, failed, or discarded) from
  all financial totals, remaining-balance calculations, dashboards, and
  reports.
- **FR-009**: System MUST persist whichever fields the provider could
  determine and MUST leave fields it could not determine empty/unset on the
  draft, rather than fabricating values.

**Review and confirmation**

- **FR-010**: System MUST allow any authorized workspace member, including
  Viewers, to view an extraction's status and (once available) draft fields
  read-only, together with access to the source file, regardless of the
  extraction's status (processing, ready for review, failed, confirmed, or
  discarded).
- **FR-011**: System MUST allow an Owner or Admin to edit any extraction's
  draft fields before confirming, and MUST allow a Member to edit only an
  extraction they personally triggered — the same own-record rule as
  confirming and discarding (FR-013, FR-017); Viewers MUST NOT edit.
- **FR-012**: System MUST validate the (possibly edited) fields at confirm
  time using the same rules as manual expense creation (a positive amount and
  a valid date are required; category and merchant are optional), and MUST
  reject confirmation with a clear message if validation fails, creating no
  expense.
- **FR-013**: System MUST allow an Owner or Admin to confirm any extraction in
  their workspace, and MUST allow a Member to confirm only an extraction they
  personally triggered; a Member MUST NOT confirm an extraction triggered by
  another member.
- **FR-014**: On successful confirmation, System MUST create exactly one new
  expense record in the same workspace using the reviewed values, link that
  expense to the source file, mark the extraction "confirmed," and link the
  extraction to the created expense.
- **FR-015**: System MUST ensure a given "ready for review" extraction can be
  confirmed at most once, so duplicate or concurrent confirmation attempts
  produce exactly one expense.
- **FR-016**: System MUST NOT allow Viewers to confirm an extraction.

**Discarding**

- **FR-017**: System MUST allow an Owner or Admin to discard any "ready for
  review" or "failed" extraction in their workspace, and MUST allow a Member
  to discard only an extraction they personally triggered; a Member MUST NOT
  discard an extraction triggered by another member. Discarding creates no
  expense and leaves the source file unaffected and unlinked.
- **FR-018**: System MUST NOT allow Viewers to discard an extraction.

**Error handling**

- **FR-019**: System MUST mark an extraction "failed" with a clear, user-safe
  message (not the raw provider error) when the provider call fails for any
  reason, including but not limited to: invalid/revoked key, rate limiting,
  timeout, an unparseable file, or a provider response that does not match the
  expected structured format.
- **FR-020**: System MUST NOT expose the API key, raw provider error
  payloads, or other internal diagnostic details to the client or to logs in
  any extraction response, whether successful or failed.
- **FR-021**: System MUST NOT delete, modify, or otherwise alter the source
  file as a result of a failed extraction, regardless of the workspace's
  auto-delete setting.
- **FR-022**: System MUST allow any Owner, Admin, or Member (the same actor set
  as FR-001, with no additional ownership restriction) to retry extraction on
  a file whose most recent extraction failed, creating a new extraction
  attempt while retaining the prior failed attempt for history. Retrying is
  functionally a fresh trigger (FR-001, FR-003) on a file that is no longer
  blocked by a failed attempt; the own-record restriction in FR-013/FR-017
  applies only to confirming or discarding an *existing* extraction, not to
  starting a new one.

**Auto-delete integration (Phase 6)**

- **FR-023**: When the workspace's auto-delete-after-extraction setting is
  enabled, System MUST delete the source file's binary only after a successful
  confirmation (never after extraction completes but before confirmation, and
  never after a failure or a discard), and MUST retain the file's metadata
  marked deleted for traceability.
- **FR-024**: When the workspace's auto-delete-after-extraction setting is
  disabled (the default), System MUST retain the source file unchanged
  regardless of extraction outcome.

**Authorization and isolation (cross-cutting)**

- **FR-025**: System MUST enforce every extraction operation (trigger, view
  draft, edit, confirm, discard, retry) against the actor's role, workspace
  membership, and (for Members) whether they personally triggered the
  extraction, evaluated per request.
- **FR-026**: System MUST prevent any extraction record, its draft data, or
  its source file from being triggered, viewed, edited, confirmed, or
  discarded by anyone outside the owning workspace (tenant isolation).

### Key Entities *(include if feature involves data)*

- **AI Extraction**: Represents one attempt to extract structured data from a
  file. Belongs to exactly one workspace and references exactly one source
  file. Key attributes: status (processing, ready for review, failed,
  confirmed, discarded), provider used, draft fields (amount, currency,
  transaction date, vendor/merchant, suggested category), a safe failure
  reason (when failed), who triggered it and when, who confirmed or discarded
  it and when, and — once confirmed — a reference to the resulting expense. A
  file may have multiple extraction attempts over time (e.g., after a failure
  or a discard), but at most one may be active (processing or ready for
  review) at a time.
- **Expense (existing)**: An existing entity from Phase 3, unchanged in shape.
  An expense created via confirmation is traceable back to the AI extraction
  that produced it through the extraction's own reference to the expense (see
  AI Extraction, above) — the expense record itself gains no new field — and
  behaves identically to a manually created expense for every calculation,
  report, and permission purpose once created.
- **File (existing)**: An existing entity from Phase 6. Gains a reflection of
  its current/most recent extraction status and, when auto-delete applies, is
  subject to binary deletion strictly after a successful confirmation.
- **AI Provider Configuration (existing)**: An existing entity from Phase 7.
  Consumed read-only by this phase to determine whether extraction is
  available for a workspace and which provider/key to use; this phase never
  creates, edits, or removes it.
- **Workspace Membership / Role (existing)**: Existing Owner/Admin/Member/
  Viewer roles determine access. Owners and Admins may trigger, view, edit,
  confirm, discard, and retry any extraction in their workspace. Members may
  trigger and retry, and may edit, confirm, or discard only extractions they
  personally triggered. Viewers may view any extraction read-only but may not
  trigger, edit, confirm, discard, or retry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized member can trigger extraction on an uploaded
  receipt and see either a populated "ready for review" draft or a clear
  failure message without needing to leave the file's context.
- **SC-002**: 100% of unconfirmed extractions (processing, ready for review,
  failed, discarded) are excluded from financial totals, remaining balance,
  dashboard figures, and reports in every tested scenario.
- **SC-003**: 100% of confirmed extractions produce exactly one expense that
  is included in totals and reports identically to a manually entered expense.
- **SC-004**: A member can review a draft, correct at least one field, and
  confirm it into an expense in under 2 minutes for a typical receipt.
- **SC-005**: 100% of simulated provider failure conditions (invalid key, rate
  limit/timeout, unparseable file, malformed response) result in a "failed"
  status with a safe message and zero occurrences of the raw API key or raw
  provider error content in any client-visible output or log.
- **SC-006**: 100% of failed or discarded extractions leave the source file
  byte-for-byte unchanged; 100% of confirmed extractions in workspaces with
  auto-delete enabled result in the source file binary being removed.
- **SC-007**: Role permissions hold in 100% of tested cases: Viewers cannot
  trigger, edit, confirm, or discard extractions (but can view them
  read-only); a Member cannot confirm or discard another member's extraction;
  workspaces without BYOK configured cannot trigger extraction at all.
- **SC-008**: Cross-workspace isolation holds in 100% of tested cases — a
  member of one workspace can never trigger, view, confirm, or discard another
  workspace's extraction.

## Assumptions

- **Existing foundation reused**: Authentication, workspaces, membership/
  roles, income/expense/category records (Phase 3), file storage (Phase 6),
  and BYOK provider configuration (Phase 7) are reused unchanged; this phase
  only adds the extraction job, its draft data, and the review/confirm/discard
  workflow.
- **Manual trigger, not automatic**: Extraction is only started when a member
  explicitly triggers it on a specific file; it does not run automatically on
  upload. This avoids surprise provider calls/costs and keeps the workflow
  predictable, matching the constitution's "AI is a convenience layer" intent.
- **One active extraction per file**: At most one extraction may be
  processing or awaiting review for a given file at a time; a file may
  accumulate multiple historical (failed/discarded/confirmed) extraction
  records over time. This prevents duplicate expenses and confusing
  concurrent drafts while still allowing retries.
- **Same actor set as upload/expense creation, with own-record limits for
  Members**: Trigger, confirm, and discard are available to Owner/Admin/Member
  (the same roles that can upload files per Phase 6 and create expenses per
  Phase 3); Owners/Admins may act on any extraction, Members may confirm/
  discard only extractions they personally triggered (confirmed in
  Clarifications, mirroring the Phase 3 Member-owns-their-expense rule), and
  Viewers have read-only access to view any extraction but cannot act on it
  (confirmed in Clarifications, matching the Phase 6 Viewer file-read
  precedent).
- **Confirm follows existing expense validation**: A confirmed extraction is
  validated exactly like a manually created expense (positive amount, valid
  date required; category and merchant optional) — no new validation rules
  are introduced.
- **Single-currency MVP**: The product does not perform currency conversion
  (per the constitution's exclusion of complex multi-currency support). A
  detected non-SAR currency is shown as extracted metadata only; the
  resulting expense amount is a plain SAR-denominated value that the member
  confirms or corrects manually.
- **Auto-delete timing matches the conservative constitutional default**: The
  existing Phase 6 "auto-delete after extraction" setting is implemented as
  "delete only after successful extraction AND user confirmation" — the
  constitution's stated default behavior (confirmed in Clarifications) — using
  the single boolean already shipped in Phase 6 rather than introducing a
  second, more aggressive "delete immediately after extraction" variant.
  Failed or discarded extractions never trigger deletion.
- **Bounded processing timeout**: A "processing" extraction must eventually
  time out and be marked "failed" rather than staying processing forever
  (confirmed in Clarifications); the exact duration is a planning detail.
- **Category suggestion is advisory**: An AI-suggested category is shown as
  text but confirming an expense still requires selecting from the
  workspace's real (non-archived) category list or leaving it uncategorized;
  the system does not create new categories on the user's behalf from a
  suggestion.
- **No background job infrastructure implied**: This spec describes
  extraction as a triggered action with a visible status (processing →
  ready for review/failed); whether it is implemented synchronously or via a
  background worker is a planning/implementation detail, not a product
  requirement.
- **Out of scope this phase**: Automatic extraction on upload; OCR fallback
  without an AI provider; bulk/batch extraction across multiple files;
  editing a confirmed expense's link back to its extraction record;
  AI-generated spending summaries or analysis (Phase 9); currency conversion;
  and creating new categories automatically from AI suggestions.
