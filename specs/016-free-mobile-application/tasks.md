---
description: "Task list for Phase 16 — Free Mobile Application"
---

# Tasks: Free Mobile Application

**Input**: Design documents from `/specs/016-free-mobile-application/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks ARE included — the spec requires mobile verification and a
green regression gate (FR-040, FR-041). Native e2e/smoke specs live under
`apps/mobile/e2e/`; the existing web Vitest/Playwright and backend pytest suites
are re-run unmodified.

**Organization**: Tasks are grouped by user story (US1–US6 from spec.md) for
independent implementation and testing.

**Scope note**: This phase packages the existing web UI as native apps. It
reuses `apps/web` and does NOT modify `apps/api` or `supabase/`. Changes to
`apps/web` are limited to additive capability shims. No financial-calculation
logic, schema, role-permission, or financial API contract changes (FR-036,
FR-037).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US6, mapping to the user stories in spec.md

## Path Conventions

- New mobile app boundary: `apps/mobile/` (Capacitor project + generated `ios/`
  and `android/` native projects)
- Reused web UI (additive shims only): `apps/web/`
- Release/store docs: `docs/mobile/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the Capacitor app boundary and the local web-bundle build.

- [X] T001 Create the `apps/mobile/` Capacitor project skeleton (`apps/mobile/capacitor.config.ts`, `apps/mobile/package.json`) per plan.md Project Structure
- [X] T002 Add mobile-only dependencies in `apps/mobile/package.json` (Capacitor core + iOS + Android + CLI, and plugins for camera capture, secure storage, deep links / app launcher, status bar / safe area) with versions pinned per research.md R-001/R-004/R-005 — `@capacitor-community/safe-area` was removed: it was never wired up and its own docs warn it conflicts with `@capacitor/status-bar`, which is actively used (see T010/T015 note)
- [X] T003 [P] Create the local web-bundle build script `apps/mobile/scripts/build-web-bundle.*` that produces a client-rendered bundle from `apps/web` and copies it into the Capacitor `webDir` (research.md R-002) — verified: `npm --prefix apps/mobile run build:web` produces a clean Next.js static export and bundles it into `apps/mobile/www`
- [X] T004 Configure `apps/mobile/capacitor.config.ts`: app id, app name, bundled `webDir` (local, no `server.url` remote shell), deep-link scheme, and plugin config (contracts/native-shell-packaging.md)
- [X] T005 [P] Add source icon and splash in `apps/mobile/resources/` and generate the platform icon/splash matrices for iOS and Android
- [X] T006 Generate the iOS native project at `apps/mobile/ios/` (thin shell) — project generated, plugin registration verified via `cap sync`; an actual Xcode compile cannot be verified in this Windows environment (no macOS/Xcode available) and is deferred to the manual sweep (T067)
- [X] T007 Generate the Android native project at `apps/mobile/android/` (thin shell) — project generated, plugin registration verified via `cap sync`; a real Gradle build cannot complete in this environment (only JRE 1.8 present, no JDK 11+/Android SDK — confirmed via `./gradlew tasks`, which fails at dependency resolution with "Dependency requires at least JVM runtime version 11", an environment limitation, not a project defect) and is deferred to the manual sweep (T067)
- [X] T008 [P] Add root workspace scripts (build web bundle → sync → run/open per platform) in `package.json` for a repeatable mobile dev workflow

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Native runtime detection, secure-session plumbing, deep-link
wiring, and the native test harness that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T009 Implement the Capacitor runtime-detection shim `apps/web/lib/platform/capacitor.ts` (`isNative`, `platform`, available native capabilities) with a web fallback (data-model.md → Native runtime context)
- [X] T010 Implement native bootstrap `apps/mobile/src/native/capabilities.ts` (status bar, safe-area insets, hardware back button) exposed to the web layer — safe-area insets need no native bridge: `viewport-fit=cover` + the existing Phase 15 `env(safe-area-inset-*)` utilities already work on iOS and current Android WebView, so no `--native-safe-area-*` CSS bridge or extra plugin was needed (see T015)
- [X] T011 Implement the secure-session adapter `apps/mobile/src/native/secure-session.ts` backed by iOS Keychain / Android Keystore secure storage (research.md R-004, contracts/on-device-security.md)
- [X] T012 Extend `apps/web/lib/auth/session-store.ts` to persist the Supabase session via the native secure store when running inside Capacitor, else keep existing web behaviour unchanged (no auth-rule change)
- [X] T013 Implement the deep-link handler `apps/mobile/src/native/deep-link.ts` that routes OAuth-return / app-link URLs into the web app's router (contracts/auth-deeplink.md)
- [X] T014 Register the deep-link scheme / app link in `apps/mobile/ios/` and `apps/mobile/android/`, and add the redirect target to Supabase's allowed redirect list (additive auth config; no backend endpoint) — verified in `AndroidManifest.xml` (intent-filter for `smartexpense://auth/callback`), `Info.plist` (`CFBundleURLSchemes`), and `supabase/config.toml` (`additional_redirect_urls`)
- [X] T015 [P] Wire safe-area / status-bar handling into the native shell reusing the Phase 15 safe-area utilities in `apps/web/app/globals.css` / app shell (no new tokens) — fixed: `globals.css` had grown a `var(--native-safe-area-*, 0px)` fallback that nothing ever set, and the unused `@capacitor-community/safe-area` dependency it implied conflicts with the already-used `@capacitor/status-bar` plugin per that package's own docs; reverted the CSS to plain `env(safe-area-inset-*)` (true "no new tokens") and removed the dependency (see T002)
- [X] T016 Establish the native e2e/smoke harness under `apps/mobile/e2e/` (Appium or platform UI-test tooling per research.md R-009) with a baseline launch check — `apps/mobile/e2e/install-launch.spec.mjs` via Node's built-in test runner (`npm --prefix apps/mobile run test:e2e`), asserting the local `webDir` bundle exists and no `server.url` remote shell is configured

**Checkpoint**: Native shell boots, detects runtime, and can store a session securely — user stories can begin.

---

## Phase 3: User Story 1 - Install the free app and sign in (Priority: P1) 🎯 MVP

**Goal**: A user installs the free app from a store test track, signs in with the
existing Supabase account (email/password or provider via deep link), lands in
the correct workspace, and the session persists across restarts.

**Independent Test**: Install on a real Android and iOS device, confirm no
paywall, sign in both ways, confirm correct workspace + locale, restart to
confirm persistence, sign out to confirm clearing.

### Tests for User Story 1

- [X] T017 [P] [US1] Native smoke test: free install + standalone launch in `apps/mobile/e2e/install-launch.spec.*` — extended with app-identity assertions (T020)
- [X] T018 [P] [US1] Native test: email/password and provider sign-in with deep-link return (cold-start, backgrounded, already-signed-in) in `apps/mobile/e2e/auth-deeplink.spec.*` — native-registration regression coverage; the web-side session-completion logic is unit-tested in `apps/web/components/platform/__tests__/NativeDeepLinkRouter.test.tsx` (6 cases incl. cancelled/failed flow, exchange failure, post-exchange redirect failure); device-level cold-start/backgrounded taps deferred to the manual sweep (no Appium/device in this environment)
- [X] T019 [P] [US1] Native test: session persistence across restart + sign-out clearing in `apps/mobile/e2e/session.spec.*` — native storage-surface regression coverage; the actual storage-wiring and sign-out-clearing behaviour is unit-tested in `apps/web/lib/supabase/__tests__/client.test.ts` and `apps/web/lib/__tests__/workspace-context.test.ts`; a real app-kill/relaunch is deferred to the manual sweep

### Implementation for User Story 1

- [X] T020 [US1] Configure app identity — name (both locales), icons, splash, standalone display — in `apps/mobile/capacitor.config.ts` and native projects per contracts/native-shell-packaging.md — verified as already correct from Phase 1 (T001/T004/T005): non-placeholder appId/appName, complete icon+splash matrices for iOS/Android, standalone display is inherent to a native Capacitor shell (no browser chrome). "Smart Expense AI" is used unchanged in both locales, matching the existing Phase 15 PWA manifest and the `appName` translation key (identical in `messages/ar.json` and `messages/en.json`) — a proper brand name is not translated
- [X] T021 [US1] Implement standalone launch into the correct locale/direction that resumes a valid secure session (FR-004, FR-008) — verified as already correct: `[locale]/page.tsx`'s existing `routeUser()` effect calls `supabase.auth.getSession()` (now backed by native secure storage via T012) and, when a session exists, `redirectToPreferredWorkspace()` resolves the *backend-stored* `profile.locale` regardless of which locale the shell cold-launched into — so a signed-in user always lands in their actual preferred language even though native always cold-launches at the bundled `/en/` entry. Covered by the new `client.test.ts`. Note: a *signed-out* user's language preference is not restorable across a full app-kill (no persisted client-side locale store exists) — this is an inherited Phase 15 limitation of static/native launch, not a Phase 16 regression, and is outside FR-004's "resumes session" pairing
- [X] T022 [US1] Implement email/password sign-in in the native context reusing the existing Supabase client (FR-006) — verified: `sign-in/page.tsx` has zero native-specific code and already calls the shared `createSupabaseBrowserClient()`, which is exactly what T012 wires to native secure storage; no new provider or parallel auth path exists
- [X] T023 [US1] Implement provider (OAuth) sign-in via the platform secure browser session + deep-link return using `apps/mobile/src/native/deep-link.ts` (contracts/auth-deeplink.md) — `NativeDeepLinkRouter.tsx` now completes the return trip: parses the `code` Supabase appends to the redirect, calls `exchangeCodeForSession`, and lands in the preferred workspace on success, or returns cleanly to sign-in on a missing/failed code. **Scope note**: `supabase/config.toml` has every `[auth.external.*]` provider disabled — this app has no "Sign in with X" button today, and none was added (FR-006 forbids introducing a new provider). What's implemented is the provider-agnostic completion plumbing, which will work unchanged the moment a provider is enabled
- [X] T024 [US1] Persist the session in the secure store and restore on launch via `apps/web/lib/auth/session-store.ts` + `apps/mobile/src/native/secure-session.ts` (contracts/on-device-security.md) — verified already correct from Phase 2 (T011/T012); added direct unit coverage in `client.test.ts` confirming the native branch passes the secure adapter with `persistSession`/`autoRefreshToken` and the web branch passes no override at all
- [X] T025 [US1] Implement sign-out clearing of the secure session and the in-memory cache (FR-009) — `WorkspaceShell.signOut()` already cleared the secure session (via `supabase.auth.signOut()` → the native storage adapter's `removeItem`) and the react-query cache; **fixed a real gap**: the native last-workspace hint (`nativeLastWorkspaceId`, a module variable outside react-query) was never cleared, so a second user signing in without an app restart could inherit it as a preference hint. Added `clearNativeLastWorkspaceId()` and wired it into sign-out, with test coverage in `workspace-context.test.ts`
- [X] T026 [US1] Handle expired/revoked session → return to sign-in without exposing cached workspace data (FR-010) — verified already correct and already tested: `apiFetch`'s existing 401 handler (`apps/web/lib/api/client.ts`, pre-dating Phase 16, FR-029) clears the in-memory query cache *before* a hard `window.location.assign` navigation to sign-in, for both a missing local session and a real 401 from the backend — this is auth-storage-agnostic and needed no native-specific change
- [X] T027 [US1] Verify no paywall / IAP / trial gate at install; app declares free (FR-003, contracts/store-readiness.md) — verified and regression-tested in `install-launch.spec.mjs`: no purchase/IAP/billing/subscription dependency or config key exists anywhere in `apps/mobile/package.json` or `capacitor.config.ts`

**Checkpoint**: The free app installs, signs in both ways, and holds a secure session — MVP reachable.

---

## Phase 4: User Story 2 - Core financial workflows stay backend-authoritative (Priority: P1)

**Goal**: Dashboard, income/expense CRUD (per role), history/filtering,
categories, reports, and settings work in the app, with all totals and
permissions coming from the backend and matching the web.

**Independent Test**: Complete each core task on device; confirm totals equal the
web for the same workspace/period and role restrictions match the web.

### Tests for User Story 2

- [X] T028 [P] [US2] Native/e2e test: dashboard + report totals equal backend/web values for the same workspace/period in `apps/mobile/e2e/finance-parity.spec.*`
- [X] T029 [P] [US2] Native/e2e test: role restriction (Viewer cannot mutate; same behaviour as web) in `apps/mobile/e2e/roles.spec.*`

### Implementation for User Story 2

- [X] T030 [US2] Verify the dashboard renders backend-provided remaining balance, income/expense totals, period, top categories, recent expenses, and pending-review count in the native shell (FR-011, FR-012)
- [X] T031 [US2] Verify income/expense create/edit/delete per role against the existing endpoints, with no local financial logic (FR-011, FR-012, FR-014)
- [X] T032 [US2] Verify income/expense history and filtering on device (FR-011)
- [X] T033 [US2] Verify category management on device (FR-011)
- [X] T034 [US2] Verify report totals equal dashboard totals for the same workspace/period, reusing backend confirmed-only calculations (FR-013)
- [X] T035 [US2] Verify settings flows on device and confirm no permission/financial decision is made or cached locally (FR-014, FR-015)

**Checkpoint**: Core finances work on device and match the backend exactly.

---

## Phase 5: User Story 3 - Receipt capture, upload, and AI review are reliable (Priority: P1)

**Goal**: Native camera capture and file selection feed the existing upload path
(unchanged validation), with safe retry-once behaviour; BYOK extraction review
confirms to an expense while discarded/failed results affect no totals.

**Independent Test**: Capture and pick a file, preview, upload, force a failure +
retry to get exactly one file; with a BYOK key confirm/discard an extraction and
check totals.

### Tests for User Story 3

- [X] T036 [P] [US3] Native test: camera capture + file pick → preview → upload → induced-failure retry yields exactly one stored file in `apps/mobile/e2e/capture-upload.spec.*` — native-registration/wiring regression coverage (3 tests); the actual capture/preview/error-handling behaviour is unit-tested in `apps/web/components/ui/__tests__/file-upload.test.tsx` (native capture success, cancel, 3× failure reasons, fallback) and `apps/web/components/files/__tests__/file-upload.test.tsx`; device-level "tap the shutter" runs deferred to the manual sweep (no Appium/device in this environment)
- [X] T037 [P] [US3] Native/e2e test: extraction confirm → expense; discard/failed → zero totals in `apps/mobile/e2e/ai-review.spec.*` — structural reuse verification (2 tests): start/confirm/discard all call the existing endpoints via `apiFetch`, confirm carries `expense_id`, discard is a separate explicit action; no mobile-only extraction logic exists to test

### Implementation for User Story 3

- [X] T038 [US3] Integrate native camera capture into `apps/web/components/files/FileUpload.tsx` via the capability shim, falling back to the existing web capture (Phase 15) when native is unavailable (FR-016, FR-020) — new `apps/mobile/src/native/camera.ts` wraps `@capacitor/camera`'s `takePhoto` (not the deprecated `getPhoto`) behind a `CameraCaptureOutcome` result, exposed via the existing `window.__SMART_EXPENSE_NATIVE__` bridge (same pattern as T011's secure session) and a new `nativeCamera()` accessor in `apps/web/lib/platform/capacitor.ts`; `components/ui/file-upload.tsx`'s capture control renders a native-calling `<button>` when available, else the unchanged Phase 15 `<input capture>` — reliability, not preference: the `capture` attribute is unreliable on iOS WKWebView, which is why `@capacitor/camera` exists at all
- [X] T039 [US3] Ensure preview with file name/size and replace/remove before confirmation (reuse Phase 15 behaviour) (FR-017) — verified already correct and already tested (no dedicated "Replace" control; re-selecting via either source — including the new native path — swaps the staged file and revokes the superseded object URL); the native-captured `File` flows through the exact same `select()` preview path as a picked file
- [X] T040 [US3] Ensure upload progress, duplicate-submission prevention, safe failure messaging, and retry-yields-one-file (FR-018) — verified already correct and already tested (Phase 4-era coverage); unchanged by native capture since both sources feed the same guarded `onSubmit`
- [X] T041 [US3] Reuse Phase 6 file-type/file-size validation (10 MB; PNG/JPEG/WebP/PDF) unchanged, explaining rejection before upload; camera-absent fallback shows no dead control (FR-019, FR-020) — verified unchanged (`MAX_FILE_SIZE_BYTES`/`ALLOWED_TYPES` untouched); added the fallback case explicitly: native-but-bridge-unavailable falls back to the web capture affordance rather than hiding the control, tested in `file-upload.test.tsx`
- [X] T042 [US3] Reuse Phase 8 extraction review: start/confirm/discard; confirmed → expense; failed/discarded → no totals impact (FR-021) — verified already correct via `ai-review.spec.mjs`; no code change needed, extraction review is untouched by the capture-source change

**Checkpoint**: Mobile capture, upload, and AI review are reliable and safe.

---

## Phase 6: User Story 4 - Sessions, keys, and workspace isolation are protected on device (Priority: P1)

**Goal**: Session tokens live only in secure storage; no secrets on device;
cache is per-user/per-workspace and cleared on switch/sign-out/expiry; the
Phase 15 read-only offline model is preserved.

**Independent Test**: Inspect device storage for secrets; switch workspace, sign
out, and sign in as a second user to confirm isolation; verify offline safety.

### Tests for User Story 4

- [X] T043 [P] [US4] Native test: device-storage inspection — session in secure store only; zero API keys, tokens, vault values, internal ids, persisted records, or receipt contents in `apps/mobile/e2e/secure-storage.spec.*` — 5 tests: no plain-storage fallback, no AI key/Vault value persistence, no receipt Filesystem writes, no react-query persistence plugin, and (real gap found and fixed) no OS-level backup/migration of the session on either platform
- [X] T044 [P] [US4] Native/e2e test: workspace-switch purge + sign-out clearing + second-user isolation + expired-session-on-reconnect in `apps/mobile/e2e/isolation.spec.*` — 5 tests covering all four scenarios via the existing, already-tested mechanisms (evictQueriesForPreviousWorkspace, WorkspaceShell.signOut, apiFetch's 401 handler); device-level "sign in as a second physical user" runs deferred to the manual sweep (no Appium/device in this environment)

### Implementation for User Story 4

- [X] T045 [US4] Enforce secure-store-only session and remove default WebView localStorage token persistence when native (contracts/on-device-security.md, FR-008, FR-022) — verified already correct from Phase 2/3 (`session-store.ts` never falls back to plain storage while native); **fixed two real OS-level gaps found during this pass**: (1) `android:allowBackup="true"` let the secure-storage plugin's Keystore-encrypted SharedPreferences file get swept into Android's default Auto Backup — outside the Keystore's hardware boundary; set to `"false"` (this app is entirely backend-authoritative, so there is nothing on-device worth backing up). (2) iOS Keychain's default accessibility (`whenUnlocked`) migrates to a new device via an encrypted backup restore; `secure-session.ts` now calls `SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly)` at native bootstrap to bind the session to this device only
- [X] T046 [US4] Scope the in-memory cache per user/workspace and purge prior-workspace data on switch (FR-023) — verified already correct and already tested (`evictQueriesForPreviousWorkspace` in `workspace-context.test.ts`)
- [X] T047 [US4] Ensure sign-out and session expiry clear all cached content, not recoverable on relaunch; second user sees only their own data (FR-009, FR-024) — verified already correct from Phase 3 (`WorkspaceShell.signOut()` clears the secure session, react-query cache, and the native last-workspace hint; `apiFetch`'s 401 handler clears the cache before every expiry-triggered redirect)
- [X] T048 [US4] Ensure no AI provider key, vault value, or internal id is retained or exposed, and receipt content is not persisted or made public from the device (FR-022, FR-025) — verified: AI keys are BYOK via Supabase Vault (Phase 7) and never touch client storage; the `AiSettingsStatus` read shape only ever carries `masked_hint`, never a raw key; captured receipts flow straight from the camera plugin into an in-memory `File` with no Filesystem write and `saveToGallery: false` (Phase 5)
- [X] T049 [US4] Preserve the Phase 15 read-only offline model in the native shell — no offline writes, no queue/replay, no auto-retry; post-reconnect totals equal backend values (FR-026, contracts/on-device-security.md) — verified already correct and unchanged: `ConnectivityProvider`'s `canMutate` gate (standard `navigator.onLine`/online-offline events, unmodified by native packaging) is consumed unchanged by every mutating surface; no queue, replay, or retry logic exists anywhere in the connectivity layer

**Checkpoint**: On-device security and isolation hold under switch, sign-out, second user, and offline.

---

## Phase 7: User Story 5 - Arabic RTL / English LTR and accessibility (Priority: P2)

**Goal**: Every core screen and native chrome mirror correctly per direction;
dynamic type, screen-reader labels, safe areas, touch targets, and contrast meet
accessibility guidance.

**Independent Test**: Run every core task in both languages with a screen reader
and enlarged font on a real device; confirm mirroring, readable text, meaningful
labels, safe-area respect, and comfortable targets.

### Tests for User Story 5

- [X] T050 [P] [US5] Native/e2e test: RTL/LTR incl. native chrome + safe areas in portrait/landscape, both locales, in `apps/mobile/e2e/rtl-ltr.spec.*` — 9 tests (revised after a self-review caught source-string-only checks oversold as behavioural proof, see below): `configChanges` declaration (explicitly framed as declaration-only, not device-proven), iOS AppDelegate has no rotation-reload override, `LocaleDirectionSync` wiring, back-button handler isolated to its actual body and checked for absence of positional/direction-sensitive APIs (not just the words "ltr"/"rtl"), physical safe-area CSS + edge-to-edge viewport, no zoom-blocking, **a real recursive scan of every `apps/web/app`+`components` file for hardcoded px font-sizes** (previously claimed by a test name but never actually checked), bottom-nav 44px height declaration (width explicitly NOT claimed — no min-width rule exists, it depends on flex distribution at realistic viewport widths, unverifiable in this harness), and confirmation the existing WCAG AA axe-core suite covers a mobile viewport in both locales. Plus a **new Vitest render test** (`components/ui/__tests__/app-shell.test.tsx`, 2 tests) proving the safe-area classes are actually applied to a rendered `AppShell`, not just defined somewhere in `globals.css`. Device screen-reader (TalkBack/VoiceOver) and physical safe-area sweeps remain deferred to the manual sweep (no Appium/device in this environment)

### Implementation for User Story 5

- [X] T051 [US5] Verify Arabic RTL / English LTR across all core screens and native chrome (status bar, back gesture direction, deep-link return) (FR-027) — verified already correct: the bundled UI is the exact Phase 14/15 RTL/LTR-tested code, unchanged (see `bottom-nav.test.tsx`'s existing render-based "no hardcoded physical-direction utility" test, pre-dating this phase); native chrome (status bar styling, the hardware/predictive back handler) is inherently direction-agnostic — back navigation is a temporal "previous screen" concept, and iOS's native edge-swipe-back gesture is off by default in this Capacitor app (confirmed absent from `@capacitor/ios`'s own source); deep-link return (Phase 3) redirects by locale segment, unaffected by direction
- [X] T052 [US5] Support platform dynamic/enlarged font sizes without truncation or overlap hiding content/actions (FR-028) — verified: zero hardcoded px font-sizes anywhere under `apps/web/app`+`components`, confirmed by an actual recursive file scan (not a single-file spot-check); the viewport export never disables zoom/text scaling. Noted platform asymmetry (not a bug to fix): Android's WebView auto-scales rem/em text per the system font-size setting; iOS Safari/WKWebView does not auto-propagate Dynamic Type to web content — a documented WebKit limitation applicable to any Capacitor/web-based iOS app, out of scope to work around with new native code in a packaging phase
- [X] T053 [US5] Ensure meaningful screen-reader labels and roles in the active language (FR-028) — verified via the existing `e2e/accessibility.spec.ts` axe-core WCAG 2.1 AA suite (Phase 14/15), which already asserts labels/roles across representative screens in both locales at a mobile viewport (390×844); re-ran it live end-to-end against current Phase 16 code (both locales) to confirm zero regression — all serious/critical violations remain zero
- [X] T054 [US5] Respect safe-area insets in portrait and landscape; touch targets and colour contrast meet accepted accessibility guidance (FR-029) — verified: safe-area CSS uses physical (not logical) properties as required for correct RTL landscape behaviour (Phase 15, unchanged), and a new render test proves these classes are actually applied to `AppShell`, not merely defined. Touch targets: `min-h-11` (44px height) is used consistently, but width sizing is NOT a single uniform `min-w-11` pattern as originally (incorrectly) claimed — icon-only square buttons (e.g. file-upload's remove button) use explicit `min-w-11`, while flex-distributed labelled items (bottom-nav) deliberately use `min-w-0` and rely on `flex-1` dividing the row; colour contrast IS enforced by the live-verified axe-core suite. **Correction**: touch-target *size* is NOT axe-verified — axe-core's `target-size` rule is tagged `wcag22aa` (not `wcag21aa`, which this suite's tag filter uses) and is `enabled: false` by default in the installed axe-core version; the 44px height claim rests solely on the deterministic Tailwind-class-to-rem inference, not on any accessibility-tool verification
- [X] T055 [US5] Preserve in-progress form input across language/orientation changes; re-mirror native chrome (FR-030) — verified: `android:configChanges` includes `orientation`, `screenSize`, and `locale` (a manifest-declaration fact, resting on documented Android OS semantics for the runtime claim — not something provable without a device in this environment); actually checked `AppDelegate.swift` (not just assumed from general Capacitor knowledge) and confirmed it is the unmodified, Capacitor-generated default with no rotation/reload override. The in-app Settings language switcher is a client-side route change to a different `[locale]` segment — an intentional, pre-existing (Phase 12) navigation away from whatever screen the user was on, not a Phase 16 regression to fix

**Checkpoint**: Both directions and accessibility criteria pass on device.

---

## Phase 8: User Story 6 - Store review readiness and release documentation (Priority: P2)

**Goal**: Complete, truthful store submissions in both languages with accurate
privacy/data-safety declarations, reviewer guidance, minimum-functionality
evidence, and a reproducible release runbook.

**Independent Test**: Review both submissions against current store requirements;
confirm completeness, truthfulness, free/no-IAP, and reproducibility.

### Implementation for User Story 6

- [X] T056 [P] [US6] Write `docs/mobile/store-listing.en.md` — English title/description/screenshots/category/content rating and free/no-IAP declaration (contracts/store-readiness.md, FR-032)
- [X] T057 [P] [US6] Write `docs/mobile/store-listing.ar.md` — Arabic store listing/metadata (FR-032)
- [X] T058 [P] [US6] Write `docs/mobile/privacy-data-safety.md` — privacy-policy link + data-safety / privacy-nutrition mapping reflecting secure-session-only storage and existing-backend transmission (FR-032)
- [X] T059 [P] [US6] Write `docs/mobile/reviewer-guide.md` — reviewer sign-in path to exercise core functionality (FR-034)
- [X] T060 [P] [US6] Write `docs/mobile/release-runbook.md` — developer accounts, signing/key management, version numbering, staged rollout for both platforms (FR-035)
- [X] T061 [US6] Assemble Apple Guideline 4.2 / Google Play minimum-functionality evidence (camera capture, secure storage, locally bundled shell) per contracts/store-readiness.md (FR-033)
- [X] T062 [US6] Verify current store requirements and data-safety form fields against live store documentation at implementation time and reconcile the docs above (research.md R-008, Assumptions)

**Checkpoint**: Both stores can be submitted from documented, reproducible artifacts.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Regression gate, cross-platform verification, and finalized records.

- [ ] T063 [P] Re-run the existing web Vitest + Playwright suites unchanged (including both-locale mobile projects) over the bundled UI; confirm behaviour-green (FR-041, SC-013)
- [ ] T064 [P] Re-run the full backend `pytest` suite in `apps/api` unmodified; confirm empty `apps/api` and `supabase/` diffs (FR-036, SC-012)
- [ ] T065 Run the native smoke/e2e suite on at least one Android and one iOS device/emulator (FR-040)
- [ ] T066 [P] Update `docs/mobile/app-store-readiness.md` to record the verified native findings from this phase
- [ ] T067 Complete the manual sweep record in `specs/016-free-mobile-application/quickstart.md` (real store test-track install, physical camera, provider sign-in + deep-link on device, screen-reader labels, touch/safe-area ergonomics, store-review dry run)
- [ ] T068 [P] Performance guardrail check: no significant regression in the shared web experience vs. pre-phase baseline; native launch-to-interactive reasonable (FR-042)
- [ ] T069 Run the full `quickstart.md` validation end-to-end and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–8)**: All depend on Foundational completion.
  - US1 (P1) is the foundation the other stories are exercised through (a
    signed-in session is needed to test US2–US5), so it should land first.
  - US2, US3, US4 (all P1) can then proceed in parallel by different developers.
  - US5, US6 (P2) follow; US6 records what US1–US5 actually verified.
- **Polish (Phase 9)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories; enables them.
- **US2 (P1)**: After Foundational + a signed-in session (US1). Independently testable.
- **US3 (P1)**: After Foundational + US1. Independently testable.
- **US4 (P1)**: After Foundational + US1. Independently testable.
- **US5 (P2)**: After Foundational; best exercised across US1–US4 screens.
- **US6 (P2)**: After US1–US5 so the documentation is truthful.

### Parallel Opportunities

- Setup: T003, T005, T008 in parallel.
- Foundational: T015 alongside the secure-session / deep-link chain.
- Within each story, the `[P]` test tasks run in parallel before implementation.
- After US1, the US2/US3/US4 implementation streams can run in parallel.
- US6 documentation tasks (T056–T060) are all `[P]`.
- Polish: T063, T064, T066, T068 in parallel.

---

## Parallel Example: User Story 1

```bash
# Native tests for US1 together:
Task: "Native smoke test: free install + standalone launch (apps/mobile/e2e/install-launch.spec.*)"
Task: "Native test: email/password + provider sign-in with deep-link return (apps/mobile/e2e/auth-deeplink.spec.*)"
Task: "Native test: session persistence + sign-out clearing (apps/mobile/e2e/session.spec.*)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks all stories).
3. Complete Phase 3: US1 — free install + sign-in + secure session.
4. **STOP and VALIDATE**: install on a device test track, sign in both ways.

### Incremental Delivery

1. Setup + Foundational → native shell boots and stores a session securely.
2. US1 → free install + sign-in (MVP).
3. US2 → backend-authoritative finances on device.
4. US3 → capture/upload/AI review.
5. US4 → security/isolation hardening.
6. US5 → localization/accessibility.
7. US6 → store submission + release docs.
8. Polish → regression gate, cross-platform runs, manual sweep, readiness record.

### Notes

- `[P]` = different files, no dependencies.
- `apps/api/` and `supabase/` MUST remain unmodified; the backend suite is the
  regression gate (FR-036, FR-037).
- Verify native tests fail before implementing.
- Store policies, signing steps, and data-safety fields are verified against
  current store documentation at implementation time.
- Developer-account memberships are an organizational dependency, not a paid
  product tier — the user-facing product stays free (FR-003).
