# Feature Specification: Receipt and Invoice Storage

**Feature Branch**: `006-receipt-invoice-storage`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "Receipt and Invoice Storage (Phase 6). Add a file upload workflow so authorized workspace members can upload receipts and invoices (images and PDFs) that are stored privately, workspace-scoped, and never publicly accessible. Each uploaded file gets a File metadata record belonging to exactly one workspace. Files may optionally be linked to an expense record. Provide file deletion behavior; file metadata may remain for history/traceability even after the binary is removed. Add a workspace-level auto-delete-after-extraction setting (stored and exposed only this phase; AI extraction is Phase 8). Files are stored permanently by default. Access is restricted to authorized workspace members and respects role permissions. Do not implement AI extraction, BYOK, or reports in this phase."

## Clarifications

### Session 2026-07-02

- Q: Can Viewers preview/download files in workspaces they belong to, or is
  file access limited to Owner/Admin/Member? → A: Viewers CAN list and
  preview/download files (read-only) in their own workspaces, consistent with
  their ability to view confirmed records; Viewers still cannot upload, link,
  or delete.
- Q: What is the file↔expense cardinality? → A: A file links to at most one
  expense; an expense may have zero or more files (one expense ↔ many files).
- Q: Who can change the workspace auto-delete-after-extraction setting? → A:
  Owner only — it is an ownership-level, data-destructive preference; Admins,
  Members, and Viewers cannot change it.
- Q: Is there a per-workspace storage quota or maximum file count in this MVP
  phase? → A: No — the only enforced limit is the 10 MB per-file size cap;
  per-workspace quotas/total-storage limits are out of scope for this phase.
- Q: On file deletion, is the file metadata soft-deleted (retained) or
  hard-deleted? → A: Soft-delete — the stored binary is removed but the
  metadata record is retained and marked deleted (with a deletion timestamp)
  for history and traceability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a receipt or invoice to a workspace (Priority: P1)

An authorized workspace member (Owner, Admin, or Member) selects an image or
PDF of a receipt or invoice and uploads it to their active workspace. The file
is stored privately and appears in the workspace's file list with its name,
type, size, and upload time. The uploader can confirm the upload succeeded.

**Why this priority**: Without upload there is no feature. This is the
foundational capability that every other story depends on, and it delivers
standalone value: users can capture and retain financial documents in one
private, workspace-scoped place even before any linking or AI extraction
exists.

**Independent Test**: Sign in as a Member of a workspace, upload a valid JPEG
and a valid PDF, and confirm both appear in that workspace's file list with
correct metadata and are not visible from any other workspace.

**Acceptance Scenarios**:

1. **Given** an authenticated Owner/Admin/Member viewing their active
   workspace, **When** they upload a supported image (PNG/JPEG/WebP) under the
   size limit, **Then** the file is stored privately, a file metadata record is
   created for that workspace, and the file appears in the workspace file list.
2. **Given** the same user, **When** they upload a supported PDF under the size
   limit, **Then** it is stored and listed the same way.
3. **Given** a user attempting to upload an unsupported type (e.g., `.exe`,
   `.docx`, `.mp4`), **When** they submit it, **Then** the upload is rejected
   with a clear message and no metadata record or stored binary is created.
4. **Given** a user attempting to upload a file larger than the size limit,
   **When** they submit it, **Then** the upload is rejected with a clear message
   stating the limit and nothing is stored.
5. **Given** a Viewer of the workspace, **When** they attempt to upload a file,
   **Then** the action is not available to them and any direct attempt is
   rejected as unauthorized.

---

### User Story 2 - View and privately access uploaded files (Priority: P1)

A workspace member opens the file list for their workspace, sees all files
uploaded to it, and can preview or download an individual file. Access is
granted only to authorized members of that workspace; files are never reachable
by anonymous users or by members of other workspaces.

**Why this priority**: Stored files that cannot be retrieved have no value, and
private access is the core privacy guarantee of the feature. This must ship
alongside upload for the feature to be usable and trustworthy.

**Independent Test**: Upload a file as a Member of Workspace A, then confirm an
authorized member of Workspace A can preview/download it while an
authenticated member of Workspace B receives an authorization error and a
signed access link expires after its validity window.

**Acceptance Scenarios**:

1. **Given** an authorized member of a workspace, **When** they open the file
   list, **Then** they see every non-deleted file belonging to that workspace
   with name, type, size, upload time, uploader, and whether it is linked to an
   expense.
2. **Given** an authorized member, **When** they choose to preview or download
   a specific file, **Then** they receive time-limited private access to the
   file content.
3. **Given** an authenticated user who is not a member of the workspace,
   **When** they attempt to list or access any file in that workspace, **Then**
   access is denied.
4. **Given** an anonymous (unauthenticated) request for a file, **When** it is
   made, **Then** access is denied and no file content is served.
5. **Given** a private access link that has passed its expiry window, **When**
   it is used, **Then** it no longer grants access.

---

### User Story 3 - Link a file to an expense (Priority: P2)

When creating or editing an expense, an authorized member can attach an
uploaded receipt/invoice file to that expense so the document backing the
expense is easy to find. The expense record shows its attached file(s), and the
file record shows the expense it supports.

**Why this priority**: Linking is the primary reason receipts are stored in an
expense tracker, but it builds on top of upload and access (P1). It delivers
clear value on its own — traceability from an expense to its source document —
without requiring AI extraction.

**Independent Test**: Upload a file, attach it to an existing expense, and
verify the expense shows the file and the file shows the linked expense; then
detach it and verify both sides reflect the removal.

**Acceptance Scenarios**:

1. **Given** an authorized member with an uploaded file and an existing expense
   in the same workspace, **When** they link the file to the expense, **Then**
   the expense lists the file and the file references the expense.
2. **Given** a file linked to an expense, **When** the member detaches it,
   **Then** the link is removed on both sides and neither record is deleted.
3. **Given** a file in Workspace A, **When** a member attempts to link it to an
   expense in Workspace B, **Then** the link is rejected because both must
   belong to the same workspace.
4. **Given** an expense with a linked file, **When** the expense is deleted,
   **Then** the file and its metadata remain in the workspace and are simply no
   longer linked.

---

### User Story 4 - Delete a file (Priority: P2)

An Owner or Admin deletes a file that is no longer needed. The stored binary is
removed from private storage, but a metadata record is retained so history and
traceability are preserved. Members and Viewers cannot delete files.

**Why this priority**: Deletion is required by the phase exit criteria and for
privacy hygiene, but it is safe to ship after upload/access/linking. Retaining
metadata after binary removal preserves the audit trail the product values.

**Independent Test**: As an Admin, delete an uploaded file and confirm the
binary is no longer retrievable while a metadata record remains marked as
deleted; as a Member, confirm the delete action is unavailable and a direct
attempt is rejected.

**Acceptance Scenarios**:

1. **Given** an Owner or Admin viewing a file, **When** they delete it, **Then**
   the stored binary is removed, the file is marked deleted, and preview/
   download no longer returns content.
2. **Given** a deleted file that had been linked to an expense, **When** the
   expense is viewed afterward, **Then** the expense still records that a file
   existed but the file is no longer retrievable.
3. **Given** a Member or Viewer, **When** they view a file, **Then** no delete
   action is offered and any direct delete attempt is rejected as unauthorized.
4. **Given** a workspace file list, **When** a file has been deleted, **Then**
   it is clearly distinguishable from active files (or removed from the active
   list) while its history remains available.

---

### User Story 5 - Configure the auto-delete-after-extraction setting (Priority: P3)

A workspace Owner opens workspace settings and sees an "auto-delete uploaded
files after successful AI extraction" toggle, off by default. They can turn it
on or off. The preference is stored and displayed. Because AI extraction does
not exist until a later phase, changing this setting has no effect on any file
in this phase — it only records the workspace's future intent.

**Why this priority**: Required by the phase exit criteria ("auto-delete
setting is available"), but it is inert this phase and depends on nothing else,
so it is the lowest priority. It readies the workspace for Phase 8 without
adding extraction behavior now.

**Independent Test**: As an Owner, toggle the setting on, reload settings and
confirm it persists as on, toggle it off and confirm it persists as off, and
confirm no file is deleted as a result of the toggle.

**Acceptance Scenarios**:

1. **Given** an Owner in workspace settings, **When** they view the auto-delete
   setting for the first time, **Then** it is shown as off (files stored
   permanently by default).
2. **Given** an Owner, **When** they enable the setting and save, **Then** the
   preference persists and is shown as enabled on reload.
3. **Given** the setting enabled, **When** any file is uploaded in this phase,
   **Then** no automatic deletion occurs because extraction is out of scope
   this phase.
4. **Given** a non-Owner (Admin, Member, or Viewer), **When** they view
   workspace settings, **Then** they cannot change the auto-delete setting.

---

### Edge Cases

- **Duplicate upload**: Uploading a file with the same name/content as an
  existing one creates a distinct file record; it is not silently merged or
  rejected as a duplicate.
- **Zero-byte or empty file**: An empty or content-less file is rejected as
  invalid.
- **Type/extension mismatch**: A file whose actual content does not match a
  supported type (e.g., an executable renamed to `.pdf`) is rejected based on
  its real content, not just its extension.
- **Interrupted upload**: A failed or interrupted upload leaves no orphan
  metadata record and no partially-stored binary that is treated as valid.
- **Access after deletion**: A private access link issued before deletion no
  longer returns content once the binary is deleted.
- **Linking a deleted file**: A file whose binary has been deleted cannot be
  newly linked to an expense.
- **Cross-workspace isolation**: Listing, previewing, downloading, linking, or
  deleting always fails when the actor and the target file are not in the same
  workspace the actor is authorized for.
- **Role change mid-session**: Authorization is evaluated per request, so a
  user demoted from Admin to Member can no longer delete even if the delete
  control was visible when their session started.

## Requirements *(mandatory)*

### Functional Requirements

**Upload**

- **FR-001**: System MUST allow Owners, Admins, and Members of a workspace to
  upload receipt/invoice files to that workspace.
- **FR-002**: System MUST accept image files (PNG, JPEG, WebP) and PDF files,
  and MUST reject all other file types.
- **FR-003**: System MUST reject any single file larger than the configured
  maximum size (default 10 MB) with a clear message stating the limit.
- **FR-004**: System MUST validate a file's real content type, not only its
  filename extension, before storing it.
- **FR-005**: System MUST reject empty/zero-byte files.
- **FR-006**: For each accepted upload, System MUST create exactly one file
  metadata record associated with exactly one workspace, capturing at minimum:
  original filename, content type, size, uploader identity, and upload
  timestamp.
- **FR-007**: System MUST store uploaded file content in private storage that
  is scoped to the owning workspace and is never publicly accessible without
  authorization.

**Private access**

- **FR-008**: System MUST allow authorized members of a workspace (Owner,
  Admin, Member, Viewer) to list the non-deleted files belonging to that
  workspace, including each file's metadata and expense-link status.
- **FR-009**: System MUST allow an authorized member to preview or download an
  individual file's content via time-limited private access.
- **FR-010**: System MUST deny all file listing, preview, and download requests
  from users who are not authorized members of the owning workspace, and from
  unauthenticated requests.
- **FR-011**: Private access grants (links/tokens) MUST expire after a bounded
  time window and MUST NOT be reusable indefinitely.

**Expense linking**

- **FR-012**: System MUST allow an authorized member to link an uploaded file
  to an expense within the same workspace, and to detach it later.
- **FR-013**: System MUST support a file being linked to at most one expense at
  a time, and an expense referencing zero or more files.
- **FR-014**: System MUST reject any attempt to link a file and an expense that
  belong to different workspaces.
- **FR-015**: When an expense is deleted, System MUST retain any previously
  linked files and their metadata; the files simply become unlinked.

**Deletion and retention**

- **FR-016**: System MUST allow only Owners and Admins to delete a file.
- **FR-017**: When a file is deleted, System MUST remove the stored binary from
  private storage and MUST retain a metadata record marked as deleted for
  history and traceability.
- **FR-018**: After deletion, System MUST NOT serve the file's content through
  any preview or download path, including previously issued access links.
- **FR-019**: System MUST store uploaded files permanently by default (no
  automatic deletion occurs in this phase).

**Auto-delete setting**

- **FR-020**: System MUST provide a workspace-level "auto-delete uploaded files
  after successful AI extraction" setting that defaults to off.
- **FR-021**: System MUST allow only the workspace Owner to change the
  auto-delete setting, and MUST persist and display its current value.
- **FR-022**: System MUST NOT perform any automatic file deletion in this phase;
  the auto-delete setting only records the workspace's preference for a future
  extraction phase.

**Authorization and isolation (cross-cutting)**

- **FR-023**: System MUST enforce every file operation (upload, list, preview,
  download, link, detach, delete, settings change) against the actor's role and
  workspace membership, evaluated per request.
- **FR-024**: System MUST prevent any file or its metadata from being accessed,
  modified, or deleted by anyone outside the owning workspace (tenant
  isolation).

### Key Entities *(include if feature involves data)*

- **File**: Represents an uploaded receipt or invoice. Belongs to exactly one
  workspace. Key attributes: original filename, content type, size, storage
  location reference, uploader identity, upload timestamp, deleted state and
  deletion timestamp, and an optional link to one expense. Metadata may persist
  after the stored binary is deleted.
- **Expense (existing)**: An existing entity from prior phases. Gains an
  optional association to zero or more files in the same workspace. No change to
  its financial behavior in this phase.
- **Workspace (existing)**: An existing entity from prior phases. Gains an
  "auto-delete after extraction" preference (default off) and is the isolation
  boundary that owns files and controls access.
- **Workspace Membership / Role (existing)**: Existing Owner/Admin/Member/
  Viewer roles from prior phases determine who may upload, access, link,
  delete, and configure the auto-delete setting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized member can upload a supported receipt/invoice and
  see it in the workspace file list in under 30 seconds for a typical file.
- **SC-002**: 100% of files are private — no file can be listed, previewed, or
  downloaded by an unauthenticated request or by a member of a different
  workspace in any test scenario.
- **SC-003**: 100% of unsupported file types and oversize files are rejected
  before any content is stored, with a clear, actionable message.
- **SC-004**: An authorized member can attach a stored file to an expense and
  navigate from the expense to its receipt (and back) without leaving the
  workspace context.
- **SC-005**: After an Owner/Admin deletes a file, the binary is unretrievable
  in 100% of subsequent access attempts, while a history record of the file
  remains visible.
- **SC-006**: The auto-delete setting persists correctly across reloads in 100%
  of toggle attempts and causes zero file deletions in this phase.
- **SC-007**: Role permissions hold in 100% of tested cases: Viewers cannot
  upload or delete; Members can upload but not delete; only Owners/Admins can
  delete; only Owners can change the auto-delete setting.

## Assumptions

- **Existing foundation reused**: Authentication, workspaces, membership/roles,
  and expenses from Phases 2–5 are reused unchanged except for the additive
  associations described here (file↔expense link, workspace auto-delete
  preference).
- **Supported types and size**: Supported types are PNG, JPEG, WebP, and PDF;
  the per-file size limit defaults to 10 MB. These concrete values are chosen so
  requirements are testable; they can be tuned in planning without changing
  scope.
- **Private access mechanism**: Files are served through time-limited private
  access (e.g., short-lived signed links) rather than public URLs; the exact
  expiry window is a planning detail (assumed on the order of minutes).
- **Delete authority**: Only Owners and Admins may delete files; Members may
  upload but not delete (including their own uploads); Viewers may neither
  upload nor delete. This follows the project permission model, where only
  Owner/Admin have "upload and delete files" and Members have upload only.
- **Viewer access**: Viewers may list and preview/download files in workspaces
  they belong to, consistent with their ability to view confirmed records. This
  is the least-determined choice and is called out explicitly; it does not grant
  Viewers any write, link, or delete ability.
- **File↔expense cardinality**: A file links to at most one expense; an expense
  may have zero or more files. Linking is optional — a file can exist without
  any expense.
- **Auto-delete is inert this phase**: The auto-delete setting is stored and
  displayed only. No AI extraction exists yet (Phase 8), so nothing consumes the
  setting and no automatic deletion happens in this phase. This is an
  intentional scope boundary, not a missing behavior.
- **Out of scope this phase**: AI extraction, BYOK/provider configuration,
  reports/summaries over files, virus/malware scanning, image thumbnailing/
  transformation, bulk/multi-file operations beyond basic upload, and
  per-workspace storage quotas / total-storage limits are out of scope. The
  only enforced upload limit is the 10 MB per-file size cap.
- **Orphan/link behavior**: Deleting an expense leaves its linked files intact
  (unlinked); deleting a file clears its link to any expense. Neither cascades
  to delete the other record's data.
