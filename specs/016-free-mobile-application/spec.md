# Feature Specification: Free Mobile Application

**Feature Branch**: `016-free-mobile-application`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: "Phase 16 — Free Mobile Application. Package or build the approved mobile experience for Android and iOS. Reuse the existing backend and Supabase authentication. Support core financial, file upload, AI review, report, and settings flows. Complete mobile security, accessibility, and store-readiness testing. Keep the application free to use. Exit criteria: Core web features are available on mobile; Arabic RTL and English LTR work correctly; Financial calculations remain backend-authoritative; Mobile uploads and AI review are reliable; No paid feature tier is introduced."

## Overview

Smart Expense - AI shipped its MVP (Phases 1–10), then added Arabic/English
localization with per-workspace base currency (Phase 12), hierarchical
categories (Phase 13), the approved design system across every screen and
viewport (Phase 14), and an installable, mobile-ready Progressive Web App with
financially safe offline behaviour (Phase 15).

Phase 16 turns that validated, installable web experience into **free native
applications distributed through the Google Play Store and the Apple App
Store**. The applications reuse the existing responsive web frontend, the
authoritative FastAPI backend, and Supabase authentication rather than
reimplementing any financial or business logic natively. A user downloads the
app from their platform's official store at no cost, signs in with the same
Supabase-backed account, and completes the same core workflows — viewing
remaining balance, adding income and expenses, uploading receipts, reviewing AI
extractions, reading reports, and managing settings — from a store-installed
application.

The defining constraints of this phase come straight from the project
constitution. The backend remains the **sole authority** for financial truth
(Principle IX) and no path may produce incorrect totals (Principle X). Mobile
delivery **MUST reuse** the authoritative backend, Supabase security model,
workspace isolation, and financial-calculation rules; any mobile-client
technology is approved only through this specification and its plan (Technology
Constraints). The product **MUST remain fully free** — no paid feature tier, no
mandatory subscription, and no in-app purchase in this phase (Principle XIII;
optional product-support purchases are deferred to Phase 17).

This is a **client-packaging phase**, not a frontend-only phase and not a native
rewrite. It honestly adds native application shells for Android and iOS, secure
on-device session storage, native deep-link / OAuth-redirect handling, and
store-listing assets. It changes **no** financial-calculation logic, database
schema, role-permission rule, or financial API contract.

## Clarifications

### Session 2026-07-24

All clarifications for this phase were resolved with recommended, MVP-safe
defaults that maximise reuse of the existing web experience and backend and
preserve the constitution's financial-accuracy, privacy, and free-product
guarantees.

- Q: How are the Android and iOS applications built — a native rewrite, a
  cross-platform native UI framework, or a wrapper around the existing web
  experience? → A: A thin native shell that packages the existing responsive
  web / PWA frontend for each platform, reusing the FastAPI backend and Supabase
  unchanged. Financial and business logic is never reimplemented client-side.
  This reuses the Phase 15 validated base experience and satisfies the
  constitution's "mobile delivery MUST reuse the authoritative backend" rule at
  the lowest scope and risk.
- Q: How does a user sign in inside the packaged app, given Supabase auth
  currently runs in a browser context? → A: The app reuses Supabase
  authentication. Email/password sign-in works directly; provider (OAuth)
  sign-in uses the platform's secure in-app browser / authentication session and
  returns to the app through a registered deep link. The authenticated session
  is stored in the platform's secure storage (keychain / keystore), never in
  plain on-device storage.
- Q: Does this phase introduce any in-app purchase, payment, or support-purchase
  flow? → A: No. The application is completely free with no paid tier, no
  subscription, and no in-app purchase. Optional product-support purchases and
  all store-billing integration are deferred to Phase 17.
- Q: Are push notifications part of this phase? → A: No. Notification
  permissions, push messaging, and a notification centre are out of scope and
  deferred, consistent with Phase 15.
- Q: Does the app enforce a minimum supported app version by calling the
  backend? → A: No new backend endpoint is added. The applications rely on the
  official store update mechanisms for keeping users current; no client-side
  version-gating contract is introduced.
- Q: Which store distribution model is used? → A: Free public distribution on
  the Google Play Store and the Apple App Store, with a store-managed staged /
  test track used before public release. No paid, region-locked, or
  enterprise-only distribution.
- Q: Does the packaged app bundle the web experience within the native package,
  or load it purely from a remote URL? → A: The native shell bundles the built
  web frontend assets locally and reuses the Phase 15 PWA, rather than being a
  pure remote-URL web viewer. Local bundling is what makes the offline shell,
  branded launch, and store minimum-functionality review achievable; the app
  still talks to the same remote backend for all data.
- Q: Which sign-in methods does the app support? → A: Exactly the methods
  already enabled on the web (email/password plus any provider already
  configured there). This phase introduces no new authentication providers; it
  only adds the native deep-link return path for provider sign-in.
- Q: What are the minimum supported OS versions? → A: A modern MVP-safe baseline
  — recent iOS and Android major versions covering the large majority of active
  devices (target iOS 15+ and Android 8 / API 26+), with the exact floors
  confirmed against current store and toolchain requirements at implementation
  time.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install the free app from the official store and sign in (Priority: P1)

A user searches their platform's official app store (Google Play on Android,
App Store on iOS), finds Smart Expense - AI, and installs it for free with no
payment step and no bundled trial. They open the app, are presented with the
familiar sign-in experience, and authenticate with the same Supabase-backed
account they use on the web — by email/password or by a supported provider. On
success they land in their selected workspace, in their chosen interface
language and reading direction, exactly as on the web. Their session persists
across app restarts until they sign out or the session expires.

**Why this priority**: Free installation and working authentication are the
headline exit criteria: without a store-installed app a user can sign into,
none of the other mobile capabilities are reachable, and the "free" and "reuse
Supabase authentication" goals are unmet.

**Independent Test**: Install the app from a store test track on a real Android
and iOS device, confirm no payment or paywall appears, sign in by email/password
and by a supported provider, confirm the session lands in the correct workspace,
restart the app and confirm the session persists, then sign out and confirm
return to sign-in.

**Acceptance Scenarios**:

1. **Given** the app's store listing, **When** a user installs it, **Then**
   installation completes at no cost with no paywall, trial gate, or payment
   step of any kind.
2. **Given** a fresh install, **When** the user opens the app, **Then** they see
   the sign-in experience in the correct interface language and reading
   direction and can authenticate with their existing Supabase account.
3. **Given** a supported provider (OAuth) sign-in, **When** the user completes
   authentication in the platform's secure authentication session, **Then** they
   are returned to the app through the registered deep link and land signed in.
4. **Given** a successful sign-in, **When** the app restarts, **Then** the
   authenticated session is restored from secure device storage without
   re-entering credentials, until sign-out or session expiry.
5. **Given** a signed-in user, **When** they sign out, **Then** the session and
   any cached workspace content are cleared from the device and the app returns
   to sign-in.

---

### User Story 2 - Core financial workflows work and stay backend-authoritative (Priority: P1)

A user completes the core financial workflow inside the app: they view the
dashboard with remaining balance, total income, total expenses, and the current
period; add an expense; add income when their role permits; browse and filter
income and expense history; manage categories; and open reports. Every total
and every permission decision comes from the backend — the app displays what the
backend returns and never computes or overrides financial truth locally. What
the user sees in the app for a given workspace and period equals what they see
on the web for the same workspace and period.

**Why this priority**: "Core web features are available on mobile" and
"Financial calculations remain backend-authoritative" are named exit criteria
and the core reason the product exists. This is independently valuable even
before file capture and AI review are validated on device.

**Independent Test**: Signed in on a device, complete each core task (view
dashboard, add expense, add income when permitted, filter history, manage
categories, open reports, change settings), and confirm every total matches the
web for the same workspace and period, and that role restrictions (e.g. a
Viewer cannot create records) are enforced identically to the web.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the dashboard loads, **Then** remaining
   balance, total income, total expenses, current period, top categories,
   recent expenses, and pending review count are shown using backend-provided
   values.
2. **Given** a permitted role, **When** the user adds or edits an expense or
   income record, **Then** the record is created or updated through the existing
   backend and the displayed totals update to the backend's recalculated values.
3. **Given** a Viewer or otherwise restricted role, **When** the user attempts a
   disallowed action, **Then** it is refused with the same permission behaviour
   as the web, and no action is approved locally on the device.
4. **Given** the same workspace and period, **When** the user compares the app
   and the web, **Then** remaining balance, income total, and expense total are
   identical with zero discrepancy.
5. **Given** reports, **When** the user opens them in the app, **Then** report
   totals equal the dashboard totals for the same workspace and period, reusing
   the backend's confirmed-only calculations.

---

### User Story 3 - Receipt capture, upload, and AI review are reliable on device (Priority: P1)

A user on a phone opens the receipt/invoice flow and can either capture a new
photo with the device camera or choose an existing image or PDF from the device.
They preview the file, can replace or remove it, and confirm the upload; progress
is shown and success or a safe, understandable failure is reported, with retry
producing exactly one stored file. When a BYOK AI key is configured, they start
extraction, review the extracted result, and confirm or discard it; a confirmed
result becomes an expense, and unconfirmed results never affect totals. On
devices where camera capture is unavailable, file selection still works with no
dead control.

**Why this priority**: "Mobile uploads and AI review are reliable" is a named
exit criterion, and camera-based receipt capture is one of the strongest reasons
to install a native app. It is independently valuable and testable.

**Independent Test**: On a real device, capture a receipt with the camera and
also pick an existing file, preview and upload each, verify exactly one stored
file per confirmed upload (including after an induced failure + retry), then with
a BYOK key run extraction, review, confirm, and verify the confirmed result
becomes an expense while a discarded result affects no totals.

**Acceptance Scenarios**:

1. **Given** a phone with a camera, **When** the user opens the upload flow,
   **Then** they can choose between capturing a new photo and selecting an
   existing image or PDF, and both paths reach the existing upload.
2. **Given** a captured or selected file, **When** the selection completes,
   **Then** a preview with file name and size is shown and the user can replace
   or remove it before confirming.
3. **Given** an upload in progress, **When** the user waits, **Then** progress
   is shown and duplicate submission of the same file is prevented; a failure is
   explained safely (no internal identifiers, storage tokens, or stack traces)
   and retry yields exactly one stored file.
4. **Given** a configured BYOK AI key, **When** the user starts extraction and
   reviews the result, **Then** they can confirm or discard it; a confirmed
   result becomes an expense and a discarded or failed result affects no
   financial totals.
5. **Given** existing file-type and file-size validation, **When** a captured or
   selected file violates a rule, **Then** the reason is explained before any
   upload begins, unchanged from the web rules.
6. **Given** a device without camera capture support, **When** the flow renders,
   **Then** file selection still works and no non-functional capture control is
   shown.

---

### User Story 4 - The app protects sessions, keys, and workspace isolation on device (Priority: P1)

A user signs in, works in Workspace A, switches to Workspace B, then signs out —
possibly handing the device to someone else or signing in as a different user.
At no point does one workspace's or user's data appear inside another's. Session
tokens are held in the platform's secure storage, never in plain files, and no
AI provider API key, access token, vault value, or internal identifier is ever
readable on the device or exposed to the app's client layer. Signing out clears
cached workspace content. A session that expired while the device was offline
returns the user to sign-in on reconnect without exposing the expired session's
data.

**Why this priority**: A native app introduces new on-device storage of session
material — the one genuinely new security surface of this phase. The
constitution requires workspace isolation and forbids exposing keys or tokens;
a failure here is a security regression, not a cosmetic one.

**Independent Test**: Inspect on-device storage and confirm it holds no API key,
vault value, or internal identifier and that session tokens live only in secure
storage; populate Workspace A data, switch to Workspace B and confirm no
Workspace A data appears; sign out and confirm cached content is cleared; sign
in as a different user and confirm none of the previous user's data appears
online or offline.

**Acceptance Scenarios**:

1. **Given** a signed-in session, **When** on-device storage is inspected,
   **Then** the session token resides only in the platform secure store and no
   AI provider API key, access token, vault value, or internal database
   identifier is present anywhere on the device.
2. **Given** cached data for Workspace A, **When** the user switches to
   Workspace B, **Then** no Workspace A record, total, file, or summary is shown
   in Workspace B, including while offline.
3. **Given** a signed-in session, **When** the user signs out, **Then** cached
   workspace content is removed and is not recoverable by relaunching the app or
   navigating back.
4. **Given** a different user signs in on the same device, **When** they use the
   app, **Then** they see only their own authorised workspaces and none of the
   previous user's data.
5. **Given** a session that expired while offline, **When** connectivity
   returns, **Then** the app returns the user to sign-in without exposing cached
   workspace data from the expired session.

---

### User Story 5 - The app works in Arabic RTL and English LTR and is accessible (Priority: P2)

A user runs the app in Arabic with a right-to-left layout or in English with a
left-to-right layout, and every core screen mirrors correctly, including native
chrome such as the status bar, back gesture direction, and deep-link return.
Text scales with the platform's accessibility font settings, screen-reader
labels are present and meaningful in the active language, touch targets are
comfortable, colour contrast meets accepted accessibility guidance, and content
respects device safe areas (notches, home indicators) in portrait and landscape.

**Why this priority**: "Arabic RTL and English LTR work correctly" is a named
exit criterion and accessibility is required for store approval, but this
refines the already-delivered responsive/localised layouts rather than adding a
new capability, so it sequences after install, financial correctness, capture,
and security.

**Independent Test**: Run every core task in the app in Arabic RTL and English
LTR on a real device with a screen reader enabled and enlarged system font, and
confirm correct mirroring, readable scaled text, meaningful spoken labels,
comfortable targets, adequate contrast, and safe-area respect in portrait and
landscape.

**Acceptance Scenarios**:

1. **Given** the Arabic interface, **When** any core screen and native chrome
   render, **Then** layout, navigation, and deep-link return mirror correctly
   for RTL; the English interface behaves equivalently for LTR.
2. **Given** enlarged platform font settings, **When** screens render, **Then**
   text scales without truncation or overlap that hides content or actions.
3. **Given** a screen reader is enabled, **When** the user navigates, **Then**
   interactive elements expose meaningful labels and roles in the active
   language.
4. **Given** a device with a notch or home indicator, **When** any screen
   renders in portrait or landscape, **Then** interactive content is not
   obscured or clipped by system inset areas.
5. **Given** touch interaction, **When** controls render, **Then** touch targets
   meet the platform's minimum comfortable size and colour contrast meets
   accepted accessibility guidance.

---

### User Story 6 - The apps pass store review and are documented for release (Priority: P2)

A release manager prepares both store submissions and finds everything a
reviewer requires: accurate store listings and metadata in both languages,
truthful data-safety / privacy declarations reflecting what the app actually
collects and stores, a privacy policy, a demonstrable account/sign-in path for
reviewers, and evidence that the app provides genuine native functionality
(camera capture, secure storage, installable native shell) rather than being a
bare website wrapper. The submission declares the app as free with no in-app
purchases, and the release process (accounts, signing, versioning, staged
rollout) is documented and repeatable.

**Why this priority**: Store readiness is an explicit phase goal and the gate to
actually shipping, but it depends on the functional stories above being built
first, so it sequences after them and alongside accessibility.

**Independent Test**: Review both submissions against current Google Play and
Apple App Store requirements, confirm listings/metadata/data-safety/privacy
declarations are complete and truthful in both languages, confirm the free /
no-IAP declaration, confirm reviewer sign-in guidance, and confirm the app
demonstrates native functionality sufficient to pass minimum-functionality
review.

**Acceptance Scenarios**:

1. **Given** each store submission, **When** it is reviewed, **Then** listing
   text, screenshots, and metadata are complete and truthful in both Arabic and
   English and declare the app free with no in-app purchases.
2. **Given** the privacy and data-safety declarations, **When** they are
   reviewed, **Then** they accurately reflect the data the app collects, stores
   on device, and transmits, and a privacy policy is linked.
3. **Given** an app-store reviewer, **When** they follow the provided
   instructions, **Then** they can create or use a sign-in path to exercise core
   functionality.
4. **Given** the minimum-functionality review criteria, **When** the app is
   evaluated, **Then** it demonstrates native capabilities (camera capture,
   secure on-device storage, installable native shell) beyond a bare web
   wrapper.
5. **Given** the release documentation, **When** a maintainer follows it,
   **Then** developer-account setup, signing, version numbering, and staged
   rollout are reproducible without undocumented steps.

---

### Edge Cases

- A user on a store test/staged track must be able to install and exercise the
  full free experience without any payment, and public release must remain free.
- Provider (OAuth) sign-in that is cancelled or fails in the platform
  authentication session must return the user to sign-in cleanly with no partial
  session and no crash.
- A deep-link return (from auth or elsewhere) that arrives when the app is
  cold-started, backgrounded, or already signed in must resolve to the correct
  screen without duplicating sessions or losing the deep-link target.
- A session that expires or is revoked server-side while the app is open must
  surface as a return to sign-in on the next protected action, never as stale
  authorised-looking data.
- Losing connectivity inside the app must reuse the Phase 15 read-only offline
  behaviour: a shell with a clear offline indicator, no offline financial
  writes, and no duplicate records on reconnect.
- Camera or file-access permission denied by the OS must be explained with
  guidance to enable it, and file selection must remain usable where camera is
  unavailable.
- A very large full-resolution photo must be handled by the existing file-size
  validation with a clear message, not a silent failure.
- Switching interface language or device orientation mid-task must not lose
  in-progress form input and must re-mirror native chrome correctly.
- An OS-level back gesture on the root screen must not silently discard an
  unsaved form without the same confirmation behaviour as the web.
- A device with an outdated app version must continue to function against the
  unchanged backend or be updated through the store's normal update mechanism —
  no custom backend version-gate is introduced.
- Store rejection for insufficient native functionality (minimum-functionality
  review) must be mitigated by the app's genuine native integrations, not worked
  around by adding features outside constitution scope.

## Requirements *(mandatory)*

### Functional Requirements

#### Packaging, distribution, and free access

- **FR-001**: The project MUST produce installable native applications for
  Android and iOS that package and reuse the existing responsive web / PWA
  frontend, without reimplementing financial or business logic client-side. The
  native shell MUST bundle the built web frontend assets locally (reusing the
  Phase 15 PWA) rather than being a pure remote-URL web viewer, while still using
  the same remote backend for all data.
- **FR-002**: The applications MUST be distributable through the Google Play
  Store and the Apple App Store as free downloads, using a store-managed
  staged/test track before public release.
- **FR-003**: The applications MUST introduce no paid feature tier, no mandatory
  subscription, and no in-app purchase; all core functionality MUST remain free,
  and support-purchase / billing flows are deferred to Phase 17.
- **FR-004**: The applications MUST present a correct, non-placeholder
  application identity per platform — name, icon, and store listing — consistent
  with the approved design system, in both Arabic and English.
- **FR-005**: The applications MUST rely on the platforms' official store update
  mechanisms to keep users current and MUST NOT introduce a backend
  version-gating endpoint or contract.

#### Authentication and session

- **FR-006**: The applications MUST authenticate users with the existing
  Supabase authentication, supporting exactly the sign-in methods already
  enabled on the web (email/password plus any provider already configured), and
  MUST NOT add a parallel or reimplemented auth system or introduce a new
  authentication provider.
- **FR-007**: Provider (OAuth) sign-in MUST use the platform's secure in-app
  authentication session/browser and MUST return to the application through a
  registered deep link, landing the user signed in.
- **FR-008**: The authenticated session MUST be stored in the platform's secure
  storage (keychain / keystore) and MUST persist across app restarts until
  sign-out or session expiry; it MUST NOT be stored in plain, world-readable
  device storage.
- **FR-009**: Sign-out MUST clear the stored session and cached workspace
  content from the device such that it is not recoverable by relaunching the app.
- **FR-010**: A session that expired or was revoked (including while offline)
  MUST return the user to sign-in on the next protected action or reconnect,
  without exposing the expired session's workspace data.

#### Core financial, reports, and settings flows

- **FR-011**: The applications MUST make the core web workflows available on
  mobile — dashboard/remaining balance, add/edit/delete income and expenses
  (per role), income and expense history with filtering, category management,
  reports, and settings — reusing the existing backend endpoints.
- **FR-012**: All financial totals and remaining-balance values displayed in the
  applications MUST come from the backend; the applications MUST NOT compute,
  cache-as-authoritative, or override financial truth locally.
- **FR-013**: Report totals shown in the applications MUST equal the dashboard
  totals for the same workspace and period, reusing the backend's confirmed-only
  calculations.
- **FR-014**: Role and permission decisions MUST remain backend-authoritative;
  the applications MUST NOT approve, cache, or infer a permission outcome
  locally, including while offline.
- **FR-015**: For a given workspace and period, the financial values shown in
  the applications MUST match those shown on the web with zero discrepancy.

#### Mobile capture, upload, and AI review

- **FR-016**: On device, the receipt/invoice flow MUST offer both capturing a
  new photo with the device camera and selecting an existing image or PDF, both
  reaching the existing upload path.
- **FR-017**: The flow MUST show a preview of the captured/selected file with
  name and size and MUST allow replacing or removing it before confirmation.
- **FR-018**: Upload progress MUST be shown, duplicate submission of the same
  file MUST be prevented, failures MUST be explained safely (no internal
  identifiers, storage tokens, or stack traces), and retry MUST result in
  exactly one stored file.
- **FR-019**: Existing file-type and file-size validation rules MUST apply
  unchanged to captured photos and selected files, with the reason explained
  before any upload begins.
- **FR-020**: Where camera capture is unsupported or its permission is denied,
  the flow MUST fall back to file selection with a clear explanation and no
  non-functional control.
- **FR-021**: When a BYOK AI key is configured, the applications MUST let the
  user start extraction, review the result, and confirm or discard it; a
  confirmed result MUST become an expense and failed or discarded results MUST
  NOT affect financial totals — reusing the existing extraction states and
  backend behaviour.

#### On-device security, privacy, and isolation

- **FR-022**: On-device storage MUST NOT contain AI provider API keys, access
  tokens beyond the securely stored session, vault values, or internal database
  identifiers, and MUST NOT expose any such secret to the application client
  layer.
- **FR-023**: Cached workspace data MUST be scoped to a single user and a single
  workspace and MUST be discarded on workspace switch, so one workspace's data
  is never displayed within another, including while offline.
- **FR-024**: A different user signing in on the same device MUST see only their
  own authorised workspaces and never the previous user's cached data.
- **FR-025**: Receipt and invoice file content MUST NOT be retained on the
  device beyond what the active session requires and MUST NOT be made publicly
  accessible from the device.
- **FR-026**: The applications MUST reuse the Phase 15 read-only offline model —
  a rendered shell with a clear offline indicator, no offline financial writes,
  no queued/replayed mutations, and no duplicate records on reconnect.

#### Localization, accessibility, and mobile interaction

- **FR-027**: The applications MUST render correctly in Arabic RTL and English
  LTR across every core screen, including native chrome (status bar, back
  gesture direction, deep-link return), reusing existing translation-key
  conventions.
- **FR-028**: The applications MUST respect the platform's accessibility settings
  — dynamic/enlarged font sizes without truncating content or actions — and MUST
  expose meaningful screen-reader labels and roles in the active language.
- **FR-029**: Layouts MUST respect device safe-area insets (notches, rounded
  corners, home indicators) in portrait and landscape, and touch targets and
  colour contrast MUST meet accepted accessibility guidance.
- **FR-030**: Changing interface language or device orientation mid-task MUST
  NOT lose in-progress form input, and native chrome MUST re-mirror correctly.
- **FR-031**: All core mobile tasks MUST be completable on a phone in both
  languages, reusing the Phase 14/15 mobile navigation and touch patterns.

#### Store readiness and documentation

- **FR-032**: The phase MUST produce truthful store listings and metadata in
  both Arabic and English, accurate privacy and data-safety declarations
  reflecting what the app collects/stores/transmits, and a linked privacy policy.
- **FR-033**: The applications MUST demonstrate genuine native functionality
  (camera capture, secure on-device storage, locally bundled installable native
  shell) sufficient to satisfy store minimum-functionality review, without
  adding features outside constitution scope.
- **FR-034**: The phase MUST provide reviewer sign-in guidance enabling a store
  reviewer to exercise core functionality.
- **FR-035**: The phase MUST document a reproducible release process — developer
  accounts, signing, version numbering, and staged rollout — for both platforms.

#### Preservation and scope boundaries

- **FR-036**: This phase MUST NOT change financial-calculation logic,
  confirmed-only totals behaviour, database schema, role permissions,
  authentication rules, AI provider behaviour, file storage rules, history
  append-only behaviour, or workspace-isolation enforcement.
- **FR-037**: This phase MUST NOT add or change any financial API contract
  (endpoints, request/response shapes) to support mobile; native artefacts and
  additive auth-redirect / deep-link configuration are the only new
  client-integration surface permitted.
- **FR-038**: This phase MUST NOT introduce out-of-scope capabilities: in-app
  purchases, payments, or product-support purchases (Phase 17); push
  notifications; background sync of financial data; offline financial writes; or
  any monetization that restricts the free core product.
- **FR-039**: The applications MUST reuse the Phase 14 visual language and
  standardized components and MUST NOT introduce a competing visual system.

#### Testing and verification

- **FR-040**: Automated and documented manual coverage MUST verify: free
  installation with no paywall; email/password and provider sign-in with
  deep-link return; session persistence and secure storage; sign-out and cache
  clearing; core financial workflows matching backend/web values; mobile
  capture/upload and AI review; on-device secret/isolation checks; RTL/LTR and
  accessibility behaviour; and offline read-only behaviour on real Android and
  iOS devices or emulators.
- **FR-041**: Existing automated suites MUST stay behaviour-green: all
  behavioural, user-flow, financial-accuracy, role-permission, and
  RTL/LTR-direction assertions MUST continue to pass, and the entire backend
  suite MUST be re-run unmodified.
- **FR-042**: The phase MUST NOT introduce a significant regression in the
  responsiveness or load behaviour of the shared web experience relative to the
  pre-phase baseline (soft guardrail; no absolute performance target).

### Key Entities *(include if feature involves data)*

- **Mobile application package**: A per-platform (Android, iOS) installable
  application that wraps and reuses the existing web frontend; carries its own
  application identity (name, icon, version) and native integration surface
  (secure storage, camera, deep links).
- **Secure session store**: The platform keychain/keystore location holding the
  authenticated Supabase session, isolated from plain device storage and cleared
  on sign-out.
- **Deep-link / redirect registration**: The registered app link(s) used to
  return the user to the app after a provider authentication session; additive
  configuration, not a financial API contract.
- **Store listing & compliance record**: The per-platform store metadata,
  privacy/data-safety declarations, privacy policy link, reviewer guidance, and
  free/no-IAP declaration required for submission.
- **Release process record**: The documented, reproducible steps for developer
  accounts, signing, versioning, and staged rollout on both platforms.
- **Note**: This phase introduces **no new persisted server-side data entities**;
  existing domain entities (income, expense, category, file, extraction,
  workspace, member, settings, history) and their contracts are unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can install the app for free from a store test track on
  both Android and iOS with zero payment, paywall, or trial gate, and launch it
  to a working sign-in.
- **SC-002**: A user can sign in with the existing Supabase account by
  email/password and by a supported provider, with the provider flow returning
  through the deep link, in 100% of tested attempts on both platforms.
- **SC-003**: The authenticated session persists across app restarts and is
  found only in secure platform storage; inspection of on-device storage reveals
  zero AI provider API keys, vault values, or internal database identifiers.
- **SC-004**: For every tested workspace and period, remaining balance, income
  total, and expense total shown in the app equal the backend/web values with
  zero discrepancy, and report totals equal dashboard totals.
- **SC-005**: 100% of core mobile tasks (view balance, add expense, add income
  when permitted, filter history, manage categories, upload receipt, review
  extraction, switch workspace, open settings) are completable on a phone in
  both Arabic RTL and English LTR.
- **SC-006**: A user can capture a receipt with the camera or select a file,
  preview and upload it, and see it attached to the correct workspace; an
  induced failure followed by retry yields exactly one stored file.
- **SC-007**: With a BYOK key, a confirmed extraction becomes an expense and
  discarded or failed extractions affect zero totals, matching backend
  behaviour.
- **SC-008**: After a workspace switch, sign-out, or a different user signing in,
  zero records, totals, files, or summaries from the prior workspace or user are
  displayed anywhere, online or offline.
- **SC-009**: Offline behaviour matches Phase 15: the shell renders with an
  offline indicator, no offline financial write is queued or replayed, and each
  attempted submission around an interruption resolves to exactly zero or exactly
  one persisted record.
- **SC-010**: The app satisfies accessibility checks — enlarged font sizes
  without content loss, meaningful screen-reader labels in the active language,
  compliant touch-target size and contrast, and safe-area respect in both
  orientations.
- **SC-011**: Both store submissions include complete, truthful listings and
  metadata in both languages, accurate privacy/data-safety declarations, a
  privacy policy, reviewer sign-in guidance, and a free/no-IAP declaration, and
  demonstrate native functionality sufficient for minimum-functionality review.
- **SC-012**: No backend endpoint, database schema, financial-calculation
  result, or role-permission outcome changes as a result of this phase (verified
  by the unmodified backend suite passing).
- **SC-013**: Existing automated suites remain behaviour-green and new
  automated/manual coverage for install, auth, financial correctness, capture,
  security/isolation, accessibility, and offline behaviour passes on both
  platforms.
- **SC-014**: The release process is documented and reproducible such that a
  maintainer can prepare a submission for either platform without undocumented
  steps.

## Assumptions

- **Builds on Phase 15**: The installable PWA, financially safe read-only offline
  model, mobile navigation, camera/file capture affordances, and on-device
  isolation constraints delivered in Phase 15 are present and are the base that
  Phase 16 packages — extended in place, not replaced.
- **Wrapper, not rewrite**: The applications wrap and reuse the existing web
  frontend through a thin native shell per platform, bundling the built web
  assets locally rather than acting as a pure remote-URL viewer. No native
  reimplementation of financial or business logic, and no separate native UI
  codebase, is introduced. The concrete packaging technology is selected in the
  plan.
- **Reuse existing auth methods**: The app supports exactly the sign-in methods
  already enabled on the web; no new authentication provider is introduced. Only
  the native deep-link return path for provider sign-in is added.
- **Modern OS baseline**: The apps target a modern MVP-safe OS floor (target iOS
  15+ and Android 8 / API 26+), with exact minimums confirmed against current
  store and toolchain requirements during implementation.
- **Backend unchanged for finance**: No financial endpoint, request/response
  shape, database migration, RLS policy, or storage policy changes. Only additive
  authentication-redirect / deep-link configuration is permitted, and it is not a
  financial API contract.
- **Auth reuses Supabase**: Sign-in reuses Supabase authentication; provider
  sign-in uses the platform secure authentication session with a registered deep
  link; sessions live in platform secure storage.
- **Free and no IAP**: The complete product is free on both stores. No paid tier,
  subscription, or in-app purchase is introduced; product-support purchases and
  all billing are deferred to Phase 17.
- **No push notifications**: Notification permissions, push messaging, and a
  notification centre are out of scope and deferred, consistent with Phase 15.
- **No custom version-gate**: The stores' own update mechanisms keep users
  current; no backend version-checking endpoint is added.
- **Developer accounts are an organizational dependency**: Publishing requires an
  Apple Developer Program membership and a Google Play developer account. These
  are organizational prerequisites, not a paid product tier and not part of the
  user-facing free experience.
- **Store review is a gating risk, not a scope expander**: Passing Apple's
  minimum-functionality review and Google Play policy is achieved through the
  app's genuine native integrations (camera, secure storage, installable shell),
  not by adding features outside the constitution.
- **Both locales are current-state**: Every screen ships in Arabic and English
  with correct RTL/LTR behaviour using existing translation-key conventions.
- **Store policies are verified at implementation time**: Exact store
  requirements, review guidelines, data-safety form fields, and account/signing
  steps are verified against current store documentation during implementation,
  since they change independently of this spec.
- **Testing devices available**: At least one real (or emulated) Android and one
  iOS device are available for install, auth, capture, and store-readiness
  verification, since store installation and native auth cannot be fully
  automated.
- **Performance guardrail**: Held to a relative "no significant regression"
  standard rather than an absolute budget, since the phase adds a native shell
  around the existing web experience.
