# Feature Specification: Progressive Web App and Mobile Readiness

**Feature Branch**: `015-pwa-mobile-readiness`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Phase 15 — Progressive Web App and Mobile Readiness. Make the responsive Next.js web application installable as a PWA (manifest, application icons, mobile launch/splash experience). Improve mobile navigation and touch interactions on the refreshed design system. Support receipt capture and upload from mobile devices using the web file picker and camera capture. Define safe offline and reconnect behavior that never creates incorrect financial totals or duplicate records. Prepare the frontend and API contracts (as readiness documentation, not new endpoints) for future app-store packaging in Phase 16. Frontend-only phase: preserve existing APIs, permissions, financial rules, database schema, workspace isolation, and business logic. On-device caches must respect workspace isolation and be cleared on logout and workspace switch. Out of scope: native app packaging (Phase 16), push notifications, payments/product-support purchases (Phase 17), offline financial writes."

## Overview

Smart Expense - AI shipped its MVP (Phases 1–10), then added Arabic/English
localization with per-workspace base currency (Phase 12), hierarchical
categories (Phase 13), and the approved design system across every screen in
both directions and all viewports (Phase 14).

Phase 15 makes that already-responsive web application **installable and
genuinely usable as a mobile app-like experience**: an installable Progressive
Web App with icons, a manifest, and a branded launch experience; mobile
navigation and touch interactions tuned for one-handed phone use; receipt
capture straight from a phone camera or file picker; and clearly defined,
**financially safe** offline and reconnect behavior.

It is a **frontend-only readiness phase**. No API contract, database schema,
permission rule, or financial-calculation behavior changes. Preparing for
future app-store packaging (Phase 16) means producing **readiness
documentation and frontend constraints**, not new endpoints or native code.

The defining constraint of this phase is financial safety: the project
constitution makes the backend the sole authority for financial truth
(Principle IX) and forbids any path that could produce incorrect totals
(Principle X). Phase 15 therefore treats offline as a **read-only, clearly
signalled degraded mode** — never a write queue.

## Clarifications

### Session 2026-07-23

All clarifications for this phase were resolved with recommended, MVP-safe
defaults that keep the phase frontend-only and preserve the constitution's
financial-accuracy and privacy guarantees.

- Q: What exactly is cached on the device for offline use — the application
  shell only, or also workspace financial data? → A: The application shell and
  static assets are cached persistently. Workspace financial data is **never
  written to persistent on-device storage**; offline reads are served only from
  the in-memory client data cache of the *current* session for the *current*
  workspace. When there is nothing in memory (cold launch while offline, after
  a workspace switch, or after sign-out), the screen shows an offline state
  rather than stale data. This makes workspace/user isolation and sign-out
  clearing structurally true rather than something that must be scrubbed.
- Q: How is "offline" determined — the browser's connectivity signal alone? →
  A: Both. The browser's online/offline signal plus actual backend
  reachability (a failed or timed-out request marks the connection degraded),
  with debouncing so brief flapping does not thrash the interface. A captive
  portal or unreachable backend therefore surfaces as degraded, not as online
  with empty data.
- Q: How are duplicate records prevented when a submission is interrupted,
  given no idempotency key may be added to the API? → A: Mutating requests are
  **never automatically retried** by the client. An interrupted submission is
  reported as an indeterminate outcome, the client refreshes the relevant list
  from the backend on reconnect, and the user retries manually only after the
  refreshed list shows the record is absent. No client-generated request
  identifier or backend contract change is introduced.
- Q: What is the mobile primary-navigation pattern on phones? → A: A
  direction-aware bottom navigation bar for the top-level destinations, with
  the remaining destinations behind a "more" entry that reuses the existing
  Phase 14 mobile drawer. This satisfies one-handed reachability without
  discarding the drawer already shipped.
- Q: Where does the install affordance live? → A: A dismissible in-page banner
  or card shown contextually (not a modal, not blocking the primary task),
  suppressed once installed, unsupported, or dismissed in the session, plus a
  permanent entry in Settings so a user who dismissed it can still install.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The application installs and launches like an app (Priority: P1)

A user browsing Smart Expense - AI on a supported mobile browser (or desktop
browser) is offered the option to install the application to their home screen
or app list. After installing, they launch it from the home-screen icon: it
opens in a standalone window with no browser address bar, shows a branded
launch appearance in the approved theme colour while it starts, and lands them
in the same signed-in workspace they were using. The installed application uses
the correct application name, short name, and icon, and renders in the user's
selected language and reading direction.

**Why this priority**: Installability is the phase's headline exit criterion.
Without it, none of the other mobile-readiness work is reachable from a home
screen, and Phase 16 (app-store packaging) has no validated base experience.

**Independent Test**: On a supported mobile browser, install the application
from the browser or from the in-app install affordance, launch it from the home
screen, and confirm standalone display, branded launch appearance, correct
name/icon, correct language direction, and a working signed-in session.

**Acceptance Scenarios**:

1. **Given** a supported mobile browser on a secure origin, **When** the user
   visits the application, **Then** the browser recognises it as installable
   and the application presents a discoverable, dismissible install affordance
   that does not obstruct the primary task.
2. **Given** the user installs the application, **When** they launch it from
   the home screen or app list, **Then** it opens in a standalone window
   without browser navigation chrome and shows a branded launch appearance
   using the approved colours and icon.
3. **Given** the installed application launches, **When** the interface
   renders, **Then** the application name, short name, and description are
   understandable to the user's language audience, and the layout uses the
   correct reading direction (Arabic RTL / English LTR).
4. **Given** an already-installed application, **When** the user revisits the
   site in a browser tab, **Then** the install affordance is not shown again as
   if uninstalled.
5. **Given** the user dismisses the install affordance, **When** they continue
   using the application, **Then** it is not re-shown repeatedly within the
   same session and can still be reached from settings.

---

### User Story 2 - Offline and reconnect behaviour is safe and never corrupts financial data (Priority: P1)

A user loses connectivity while using the installed application. Instead of a
broken browser error page, they see the application shell with a clear,
persistent offline indicator explaining what they can and cannot do.
Previously viewed workspace data may still be readable, clearly marked as
cached with the time it was last updated. Every action that creates, edits, or
deletes a financial record — or uploads a file, or starts an AI extraction — is
unavailable while offline and explains why, rather than appearing to succeed.
When connectivity returns, the indicator clears, data refreshes, and the user
can act again. No total is ever wrong and no record is ever duplicated as a
result of going offline, reconnecting, or retrying.

**Why this priority**: This is the phase exit criterion with the highest risk.
Financial accuracy is non-negotiable in the project constitution, and an
ill-defined offline write path is the single way this phase could break it.
Defining offline as read-only removes that risk entirely.

**Independent Test**: Disconnect the network mid-session, confirm the shell
still renders with an offline indicator and staleness labelling, attempt each
mutating action and confirm it is blocked with an explanation, then reconnect
and confirm recovery, refreshed data, and unchanged totals.

**Acceptance Scenarios**:

1. **Given** connectivity is lost, **When** the user navigates within the
   installed application, **Then** the application shell renders (rather than a
   browser network-error page) and a clear, persistent offline indicator is
   shown in the selected language.
2. **Given** the user is offline, **When** workspace data loaded earlier in the
   session is displayed, **Then** it is explicitly labelled as cached with an
   indication of when it was last updated and is never presented as freshly
   confirmed data; where no in-session data exists, an offline state is shown
   instead of stale data.
3. **Given** the user is offline, **When** they attempt to create, edit, or
   delete income or an expense, upload a receipt, trigger an AI extraction, or
   confirm/discard an extraction, **Then** the action is unavailable and an
   explanatory message is shown; no local record, draft, or queued write is
   created.
4. **Given** connectivity returns, **When** the application detects it,
   **Then** the offline indicator clears, data is refreshed from the backend,
   and mutating actions become available again without a manual full reload.
5. **Given** a user goes offline mid-submission of a record, **When**
   connectivity returns, **Then** exactly zero or exactly one record exists for
   that submission — never two — and the user is told clearly whether it
   succeeded.
6. **Given** any offline period, **When** the user returns online and views the
   dashboard and reports, **Then** totals equal the backend's authoritative
   values for the same workspace and period.

---

### User Story 3 - Receipts can be captured and uploaded from a phone (Priority: P1)

A user on a phone opens the receipt upload flow and is offered both taking a
photo with the device camera and choosing an existing image or PDF from the
device. After capturing or choosing, they see a preview of what they are about
to upload, can replace or remove it, and can confirm the upload. Progress is
shown while uploading; success is confirmed; failure is explained with a safe
retry that does not create duplicate files. On devices where camera capture is
unavailable, file selection still works and no dead control is shown.

**Why this priority**: Receipt capture from mobile is a named phase exit
criterion and is the single most valuable reason for a user to install the
application on a phone. It is independently valuable even without the offline
work.

**Independent Test**: On a mobile viewport and device, open the upload flow,
use both camera capture and file selection, preview and confirm, verify the
uploaded file appears against the correct workspace, and verify retry after an
induced failure produces exactly one file.

**Acceptance Scenarios**:

1. **Given** a phone with a camera, **When** the user opens the receipt upload
   flow, **Then** they can choose between capturing a new photo and selecting
   an existing image or PDF from the device.
2. **Given** the user captures or selects a file, **When** the selection
   completes, **Then** a preview is shown with the file name and size and the
   user can replace or remove it before confirming the upload.
3. **Given** an upload is in progress, **When** the user waits, **Then**
   progress is shown with a descriptive label and the confirm control is
   disabled so the same file cannot be submitted twice.
4. **Given** an upload fails, **When** the failure is surfaced, **Then** the
   message is understandable and safe (no internal identifiers or storage
   tokens), and retrying results in exactly one stored file, not duplicates.
5. **Given** a device or browser without camera capture support, **When** the
   upload flow renders, **Then** file selection still works and no
   non-functional capture control is presented.
6. **Given** an unsupported file type or an oversized file is chosen, **When**
   the user attempts to continue, **Then** the existing validation rules apply
   unchanged and the reason is explained before any upload begins.

---

### User Story 4 - On-device data never leaks across workspaces, users, or sessions (Priority: P1)

A user signs in, works in Workspace A, switches to Workspace B, then signs out
— possibly handing the device to someone else, or signing in as a different
user. At no point does data cached on the device for one workspace or user
appear inside another. Signing out removes cached workspace content from the
device. Nothing sensitive — API keys, access tokens, vault values, or receipt
file contents — is retained on the device beyond what the active session
requires.

**Why this priority**: Caching data on the device is the one genuinely new
privacy risk this phase introduces. The constitution requires workspace
isolation and forbids exposing keys or tokens; failing here would be a security
regression, not a cosmetic one.

**Independent Test**: Populate cached data in Workspace A, switch to Workspace
B and confirm no Workspace A data is displayed, sign out and confirm cached
workspace content is cleared, then sign in as a different user and confirm no
prior user's data appears anywhere including offline views.

**Acceptance Scenarios**:

1. **Given** cached data exists for Workspace A, **When** the user switches to
   Workspace B, **Then** no Workspace A record, total, file, or summary is
   displayed in Workspace B, including while offline.
2. **Given** a signed-in session with cached data, **When** the user signs out,
   **Then** cached workspace content is removed from the device and is not
   recoverable by navigating back or relaunching the installed application.
3. **Given** a different user signs in on the same device, **When** they use
   the application online or offline, **Then** they see only their own
   authorised workspaces and none of the previous user's data.
4. **Given** any on-device storage used by the application, **When** it is
   inspected, **Then** it contains no AI provider API key, access token, vault
   value, or internal database identifier.
5. **Given** an updated version of the application is deployed, **When** the
   user relaunches, **Then** they receive the updated application rather than
   being pinned to a stale cached version, and incompatible cached content is
   discarded.

---

### User Story 5 - Mobile navigation and touch interactions feel native-quality (Priority: P2)

A user completes the core tasks on a phone — viewing remaining balance, adding
an expense, adding income when permitted, uploading a receipt, reviewing an
extraction, switching workspace, filtering records, and opening settings. The
primary navigation is reachable with one thumb, the active destination is
always obvious, and navigation mirrors correctly in Arabic RTL and English LTR.
Content respects device safe areas (notches, home indicators) in both portrait
and landscape. Touch targets are comfortable, dialogs and sheets dismiss
predictably, and the on-screen keyboard does not hide the field being edited or
the primary submit action.

**Why this priority**: Core workflows being usable on small screens is an exit
criterion, but it refines the responsive layouts already delivered in Phase 14
rather than introducing a new capability, so it sequences after installability,
safety, capture, and isolation.

**Independent Test**: Complete every core task on a phone viewport in both
languages, in portrait and landscape, and confirm one-handed reachability,
correct mirroring, safe-area respect, comfortable touch targets, predictable
dismissal, and unobstructed input while the keyboard is open.

**Acceptance Scenarios**:

1. **Given** a phone viewport, **When** any workspace screen renders, **Then**
   a bottom navigation bar presents the top-level destinations within
   one-handed reach, clearly indicates the active destination, and exposes the
   remaining destinations through a "more" entry.
2. **Given** the Arabic interface on a phone, **When** navigation, sheets,
   drawers, and dialogs render, **Then** they are mirrored for RTL and open and
   dismiss from the direction-correct side; the English interface behaves
   equivalently for LTR.
3. **Given** a device with a notch, rounded corners, or a home indicator,
   **When** any screen renders in portrait or landscape, **Then** interactive
   content is not obscured or clipped by system inset areas.
4. **Given** the on-screen keyboard opens on a form, **When** the user focuses
   a field, **Then** the focused field and the primary submit action remain
   visible and reachable.
5. **Given** touch interaction, **When** controls render, **Then** touch
   targets are at least 44×44px with adequate spacing, and taps do not trigger
   unintended adjacent controls.
6. **Given** a dialog, sheet, or drawer is open on a phone, **When** the user
   uses the device back gesture or the dismiss control, **Then** it closes
   predictably without unexpectedly navigating away from the underlying screen.

---

### User Story 6 - The frontend and contracts are documented as ready for app-store packaging (Priority: P3)

A developer preparing Phase 16 (the free Android and iOS applications) opens
the Phase 15 readiness documentation and finds what a packaged client will
need: the confirmed installability characteristics, the icon and asset
inventory, the authentication and session behaviour a packaged shell must
preserve, the workspace-isolation and financial-authority rules that must not
be reimplemented client-side, the file-upload and camera constraints, and the
explicit list of behaviours deferred to Phase 16. No new endpoint, contract
change, or native code is introduced by this phase.

**Why this priority**: This is a documentation deliverable that de-risks the
next phase. It is valuable but blocks nothing in Phase 15, so it sequences
last.

**Independent Test**: Review the readiness documentation against the Phase 16
goals in the implementation plan and confirm every listed Phase 16 prerequisite
is either documented as satisfied or explicitly listed as deferred, with no API
or schema change proposed.

**Acceptance Scenarios**:

1. **Given** the readiness documentation, **When** it is reviewed, **Then** it
   records the verified installability characteristics, asset inventory, and
   supported-platform findings from this phase.
2. **Given** the readiness documentation, **When** a Phase 16 developer reads
   it, **Then** it states the authentication, workspace-isolation, and
   backend-financial-authority rules a packaged client must preserve without
   reimplementing them.
3. **Given** the readiness documentation, **When** it is reviewed against this
   phase's changes, **Then** it introduces no new API endpoint,
   request/response shape, database change, or native packaging artefact.

---

### Edge Cases

- A browser or platform that does not support installation must degrade to the
  normal responsive web experience with no broken or dead install control.
- A platform that offers no programmatic install prompt (installation is a
  manual browser-menu action) must show instructional guidance rather than a
  control that appears to install but does nothing.
- A user who installs, uninstalls, and reinstalls must not see stale cached
  content from the previous installation.
- Connectivity that is present but unusable (captive portal, request timeouts,
  server errors) must be treated as degraded rather than silently reported as
  online with empty data.
- Rapid connectivity flapping must not produce repeated visual state changes,
  refetch storms, or duplicated requests.
- Launching the installed application while already offline (no in-session data
  yet) must render the shell with an offline state rather than a broken page or
  stale data from a previous session.
- A session that expires while the device was offline must, on reconnect,
  return the user to sign-in without exposing cached workspace data belonging
  to the expired session.
- A camera capture the user cancels must leave the form unchanged with no
  partial file staged.
- A very large photo captured at full device resolution must be handled by the
  existing file-size validation rules with a clear message, not a silent
  failure.
- Switching interface language while installed must update the interface and
  direction without requiring reinstallation.
- Changing device orientation mid-task must not lose in-progress form input.
- Deploying a new version while a user has the application open must not leave
  a mix of old and new cached assets that breaks a screen.
- An unauthorised or permission-restricted action attempted while offline must
  still surface the same permission explanation once online, and must never be
  approved locally.

## Requirements *(mandatory)*

### Functional Requirements

#### Installability and launch experience

- **FR-001**: The application MUST be installable on supported mobile and
  desktop browsers, declaring a valid application identity that includes name,
  short name, description, start destination, display mode, orientation
  handling, and theme/background colours consistent with the approved design
  system.
- **FR-002**: The application MUST provide a complete application icon set
  covering the sizes required by supported platforms, including a maskable
  variant, and MUST NOT ship placeholder or distorted icons.
- **FR-003**: The installed application MUST launch in a standalone window
  without browser navigation chrome and MUST show a branded launch appearance
  using the approved theme colours while it starts.
- **FR-004**: The installed application MUST launch into a destination that
  respects the user's selected interface language and reading direction and
  resumes the existing authenticated session where one is valid.
- **FR-005**: The application MUST present the install affordance as a
  dismissible in-page banner or card shown contextually — never a modal or
  blocking overlay — MUST NOT show it when the application is already
  installed or installation is unsupported, MUST NOT re-show it after dismissal
  within the same session, and MUST provide a permanent install entry in
  settings so a user who dismissed the banner can still install.
- **FR-006**: Application identity text presented at install time (name, short
  name, description) MUST be understandable to both Arabic and English users.
- **FR-006a**: Because some platforms expose no programmatic install prompt,
  the install affordance MUST adapt per platform: where the browser offers a
  prompt, the affordance MUST trigger it; where installation is manual, the
  affordance MUST instead give clear, translated instructions for adding the
  application to the home screen; where installation is unsupported, no
  affordance MUST be shown.

#### Offline and reconnect behaviour

- **FR-007**: When connectivity is lost, the application MUST render its own
  shell and a clear, persistent, translated offline indicator rather than a
  browser network-error page.
- **FR-008**: While offline, workspace data already loaded in the current
  session for the current workspace MAY be displayed read-only and MUST be
  explicitly labelled as cached with an indication of when it was last updated.
  Workspace financial data MUST NOT be written to persistent on-device storage;
  when no in-session data is available (cold launch while offline, after a
  workspace switch, or after sign-out), the screen MUST show an offline state
  rather than stale data.
- **FR-009**: While offline, the application MUST disable and explain — rather
  than accept — every action that would create, edit, or delete a financial
  record, upload or delete a file, start an AI extraction, or confirm or
  discard an extraction.
- **FR-010**: The application MUST NOT queue, store, or replay financial
  mutations, file uploads, or extraction actions created while offline; no
  offline write path may exist.
- **FR-011**: On reconnection, the application MUST clear the offline
  indicator, refresh workspace data from the backend, and restore mutating
  actions without requiring a manual full reload.
- **FR-012**: Mutating requests MUST NEVER be retried automatically by the
  application. A submission interrupted by connectivity loss MUST be reported
  as an indeterminate outcome, MUST cause the relevant list to be refreshed
  from the backend on reconnect, and MUST direct the user to retry manually
  only after the refreshed data confirms the record is absent — so each
  attempted submission resolves to exactly zero or exactly one persisted
  record.
- **FR-013**: Cached data MUST NEVER be used to compute or display a financial
  total as if it were authoritative; totals shown after reconnection MUST match
  the backend's authoritative values for the same workspace and period.
- **FR-014**: Connectivity state MUST be derived from both the browser's
  online/offline signal and actual backend reachability, so that connectivity
  which is present but unusable (timeouts, server errors, captive portals) is
  surfaced as a degraded or failed state rather than as successful empty data.
- **FR-015**: Connectivity-state changes MUST be debounced so that rapid
  flapping does not cause repeated visual state thrashing, refetch storms, or
  duplicated in-flight requests.

#### Mobile capture and upload

- **FR-016**: On mobile devices, the receipt/invoice upload flow MUST offer
  both capturing a new photo with the device camera and selecting an existing
  image or PDF from the device.
- **FR-017**: The upload flow MUST show a preview of the captured or selected
  file with its name and size and MUST allow replacing or removing it before
  confirmation.
- **FR-018**: Upload progress MUST be shown with a descriptive label, and the
  confirm control MUST prevent duplicate submission of the same file.
- **FR-019**: Upload failures MUST be explained understandably and safely (no
  internal identifiers, storage tokens, or stack traces), and retrying MUST
  result in exactly one stored file.
- **FR-020**: Where camera capture is unsupported, the flow MUST fall back to
  file selection with no non-functional control presented.
- **FR-021**: Existing file-type and file-size validation rules MUST apply
  unchanged to captured photos, with the reason explained before any upload
  begins.
- **FR-022**: A cancelled capture MUST leave the form unchanged with no partial
  file staged.

#### On-device data privacy and isolation

- **FR-023**: Cached workspace data MUST be scoped to a single user and a
  single workspace, and MUST be discarded on workspace switch so that data from
  one workspace is never displayed within another, including while offline.
- **FR-024**: Signing out MUST remove cached workspace content such that it is
  not recoverable by navigating back or relaunching the installed application;
  because workspace financial data is never persisted to device storage
  (FR-008), only the application shell and static assets survive sign-out.
- **FR-025**: A different user signing in on the same device MUST see only
  their own authorised workspaces and never the previous user's cached data.
- **FR-026**: On-device storage MUST NOT contain AI provider API keys, access
  tokens, vault values, or internal database identifiers.
- **FR-027**: Receipt and invoice file content MUST NOT be retained on the
  device beyond what the active session requires, and MUST NOT be made publicly
  accessible from the device.
- **FR-028**: A newly deployed version MUST be picked up on relaunch rather
  than pinning the user to a stale cached version, and incompatible cached
  content MUST be discarded on version change.
- **FR-029**: A session that expired while offline MUST, on reconnect, return
  the user to sign-in without exposing cached workspace data from the expired
  session.

#### Mobile navigation and touch interaction

- **FR-030**: Primary navigation on phone viewports MUST be a direction-aware
  bottom navigation bar carrying the top-level destinations, reachable
  one-handed without stretching to the top of the screen and clearly indicating
  the active destination; the remaining destinations MUST be reachable from a
  "more" entry that reuses the existing mobile drawer.
- **FR-031**: Mobile navigation, drawers, sheets, and dialogs MUST mirror
  correctly for Arabic RTL and English LTR, opening and dismissing from the
  direction-correct side.
- **FR-032**: Layouts MUST respect device safe-area insets (notches, rounded
  corners, home indicators) in portrait and landscape so interactive content is
  never obscured or clipped.
- **FR-033**: When the on-screen keyboard is open, the focused field and the
  primary submit action MUST remain visible and reachable.
- **FR-034**: Touch targets MUST be at least 44×44px with adequate spacing, and
  adjacent controls MUST NOT be triggered by an intended tap.
- **FR-035**: Dialogs, sheets, and drawers MUST dismiss predictably on a device
  back gesture or dismiss control without unexpectedly navigating away from the
  underlying screen.
- **FR-036**: Changing device orientation mid-task MUST NOT lose in-progress
  form input.
- **FR-037**: All core mobile tasks — view remaining balance, add expense, add
  income when permitted, upload a receipt, review an extraction, switch
  workspace, filter records, open settings — MUST be completable on a phone
  viewport in both languages.

#### Preservation and scope boundaries

- **FR-038**: This phase MUST NOT change API contracts, database schema,
  financial calculation rules, confirmed-only totals behaviour, role
  permissions, authentication behaviour, AI provider behaviour, file storage
  rules, history append-only behaviour, or workspace isolation enforcement.
- **FR-039**: Permission decisions MUST remain backend-authoritative; the
  application MUST NOT approve, cache, or infer a permission outcome locally,
  including while offline.
- **FR-040**: This phase MUST NOT introduce out-of-scope capabilities: native
  application packaging or store submission (Phase 16), push notifications,
  background sync of financial data, offline financial writes, payments or
  product-support purchases (Phase 17), dark mode, global search, or data
  export.
- **FR-041**: The visual language, tokens, and standardized components
  delivered in Phase 14 MUST be reused; this phase MUST NOT introduce a
  competing visual system, and any new interface element MUST use the existing
  design system and translation-key conventions in both languages.
- **FR-042**: The phase MUST produce app-store packaging readiness
  documentation recording verified installability characteristics, the asset
  inventory, the authentication/isolation/financial-authority rules a packaged
  client must preserve, mobile capture and upload constraints, and the
  behaviours explicitly deferred to Phase 16 — introducing no new endpoint,
  contract change, or native artefact.

#### Testing and verification

- **FR-043**: Automated coverage MUST verify installability metadata validity,
  offline shell rendering and mutating-action blocking, reconnect recovery,
  cache clearing on sign-out and workspace switch, mobile capture/upload
  affordances, and mobile navigation and touch behaviour on a mobile viewport
  in both locales.
- **FR-044**: Existing automated suites MUST stay behaviour-green: all
  behavioural, user-flow, financial-accuracy, role-permission, and
  RTL/LTR-direction assertions MUST continue to pass, and the entire backend
  suite MUST be re-run unmodified. Presentation-coupled assertions and
  screenshot baselines MAY be updated to match refreshed markup.
- **FR-045**: The phase MUST NOT introduce a significant regression in initial
  page load or interaction responsiveness relative to the pre-phase baseline
  (soft guardrail; no absolute performance target).

### Key Entities *(include if feature involves data)*

- **Application identity**: The installable application's declared name, short
  name, description, icons, start destination, display mode, orientation
  handling, and theme/background colours.
- **Application icon set**: The complete inventory of icon assets (including a
  maskable variant) required by supported platforms.
- **Connectivity state**: The application's understanding of whether the
  backend is reachable — online, offline, or degraded — which drives the
  offline indicator, staleness labelling, and availability of mutating actions.
- **Cached workspace view**: Read-only workspace data loaded earlier in the
  current session, held only in the in-memory client data cache (never written
  to persistent device storage), scoped to one user and one workspace, labelled
  with its last-updated time, and discarded on sign-out, workspace switch, and
  version change.
- **Capture source**: The user's choice between device camera capture and
  device file selection when adding a receipt or invoice.
- **Packaging readiness record**: The documented findings and constraints that
  Phase 16 must satisfy or preserve.
- **Note**: This phase introduces **no new persisted server-side data
  entities**; existing domain entities (income, expense, category, file,
  extraction, workspace, member, settings, history) are unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The application passes installability validation on supported
  mobile and desktop browsers, and a user can install it and launch it from the
  home screen in a standalone window with the correct icon, name, and branded
  launch appearance in both languages.
- **SC-002**: 100% of mutating actions (income/expense create-edit-delete, file
  upload/delete, extraction start/confirm/discard) are unavailable with an
  explanation while offline, and zero offline writes are queued, stored, or
  replayed.
- **SC-003**: Across repeated offline/reconnect cycles — including interruption
  mid-submission — the number of persisted records for each attempted
  submission is always exactly zero or exactly one, never more.
- **SC-004**: After any offline period, dashboard and report totals equal the
  backend's authoritative values for the same workspace and period, with zero
  discrepancies.
- **SC-005**: On a mobile device, a user can capture a receipt with the camera
  or select a file, preview it, upload it successfully, and see it attached to
  the correct workspace; an induced failure followed by retry yields exactly
  one stored file.
- **SC-006**: 100% of core mobile tasks (view balance, add expense, add income
  when permitted, upload receipt, review extraction, switch workspace, filter
  records, open settings) are completable on a phone viewport in both Arabic
  RTL and English LTR.
- **SC-007**: On phone viewports, primary navigation is one-hand reachable, the
  active destination is always indicated, and all touch targets measure at
  least 44×44px with no content obscured by device safe areas in portrait or
  landscape.
- **SC-008**: After a workspace switch, a sign-out, or a different user signing
  in, zero records, totals, files, or summaries from the prior workspace or
  user are displayed anywhere in the application, online or offline.
- **SC-009**: Inspection of persistent on-device storage reveals zero financial
  records, zero receipt file contents, and zero AI provider API keys, access
  tokens, vault values, or internal database identifiers.
- **SC-010**: A newly deployed version is picked up on relaunch in 100% of
  tested cases, with no screen left broken by mixed old and new cached assets.
- **SC-011**: No backend endpoint, database schema, financial-calculation
  result, or role-permission outcome changes as a result of this phase
  (verified by the unmodified backend suite passing).
- **SC-012**: Existing automated suites remain behaviour-green and new
  automated coverage for installability metadata, offline/reconnect behaviour,
  cache isolation, mobile capture, and mobile navigation passes in both
  locales.
- **SC-013**: The app-store packaging readiness documentation addresses every
  Phase 16 prerequisite as either satisfied or explicitly deferred, and
  proposes zero API or schema changes.
- **SC-014**: Initial page load and interaction responsiveness show no
  significant regression relative to the pre-phase baseline on the reviewed key
  screens.

## Assumptions

- **Builds on Phase 14**: The approved design system, standardized components,
  responsive layouts, mobile navigation drawer, and both-locale coverage
  delivered in Phase 14 are present and are extended in place, not replaced.
- **Offline is read-only**: Offline support means a rendered shell plus
  read-only views of data already loaded in the current session. Offline
  creation, editing, deletion, upload, or extraction is deliberately excluded
  because the constitution makes the backend the sole authority for financial
  truth and forbids any path that could produce incorrect totals or duplicate
  records.
- **No persisted financial data on device**: Only the application shell and
  static assets are cached persistently. Financial records, totals, and file
  contents are never written to persistent device storage, which makes
  workspace isolation and sign-out clearing structurally true rather than a
  scrubbing routine that could miss data.
- **No idempotency contract**: Because mutating requests are never retried
  automatically, duplicate prevention needs no request identifier and therefore
  no API contract change — keeping this phase frontend-only.
- **Frontend-only**: No backend endpoint, request/response shape, database
  migration, RLS policy, or storage policy changes. If a requirement appears to
  need new backend behaviour, that is a signal to re-scope rather than to add
  backend work in this phase.
- **Capture uses the web platform**: Receipt capture uses the browser's
  standard file-selection and camera-capture affordances. No native camera
  integration, custom camera interface, or client-side image processing
  pipeline is introduced.
- **No push notifications**: Notification permissions, push messaging, and a
  notification centre are out of scope and deferred.
- **Light mode only**: No dark theme is introduced, consistent with Phase 14.
- **Both locales are current-state**: Every new interface element ships in both
  Arabic and English using existing translation-key conventions, with correct
  RTL/LTR behaviour.
- **Existing validation reused**: File-type and file-size rules established in
  Phase 6 apply unchanged to mobile captures.
- **Testing environments**: The existing end-to-end setup already includes a
  mobile Arabic RTL device profile (added in Phase 14) and is reused for mobile
  verification; at least one supported mobile device or emulator is available
  for manual installation verification, since installation prompts cannot be
  fully automated.
- **Packaging readiness is documentation**: "Prepare the frontend and API
  contracts for future app-store packaging" is satisfied by written readiness
  documentation and preserved frontend constraints. No native project, store
  listing, signing configuration, or contract change is produced in this phase.
- **Serving requirements**: Installation requires the application to be served
  over a secure origin; local verification uses a secure-context-equivalent
  environment.
- **Install prompts are platform-dependent**: Only some platforms expose a
  programmatic install prompt. Where none exists, "installable" means the
  application meets the platform's installability requirements and the user is
  guided through the manual add-to-home-screen action. Automated tests
  therefore verify installability *metadata and affordance behaviour*; the
  actual installed launch is confirmed by a documented manual sweep.
- **Offline reads are session-scoped**: Because financial data is never
  persisted to the device, offline reading is best-effort within a live session
  only and does not survive relaunching the application.
- **Performance guardrail**: Held to a relative "no significant regression"
  standard rather than an absolute budget, since this phase adds no backend
  work and only modest frontend assets.
