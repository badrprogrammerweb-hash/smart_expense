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

- [ ] T017 [P] [US1] Native smoke test: free install + standalone launch in `apps/mobile/e2e/install-launch.spec.*`
- [ ] T018 [P] [US1] Native test: email/password and provider sign-in with deep-link return (cold-start, backgrounded, already-signed-in) in `apps/mobile/e2e/auth-deeplink.spec.*`
- [ ] T019 [P] [US1] Native test: session persistence across restart + sign-out clearing in `apps/mobile/e2e/session.spec.*`

### Implementation for User Story 1

- [ ] T020 [US1] Configure app identity — name (both locales), icons, splash, standalone display — in `apps/mobile/capacitor.config.ts` and native projects per contracts/native-shell-packaging.md
- [ ] T021 [US1] Implement standalone launch into the correct locale/direction that resumes a valid secure session (FR-004, FR-008)
- [ ] T022 [US1] Implement email/password sign-in in the native context reusing the existing Supabase client (FR-006)
- [ ] T023 [US1] Implement provider (OAuth) sign-in via the platform secure browser session + deep-link return using `apps/mobile/src/native/deep-link.ts` (contracts/auth-deeplink.md)
- [ ] T024 [US1] Persist the session in the secure store and restore on launch via `apps/web/lib/auth/session-store.ts` + `apps/mobile/src/native/secure-session.ts` (contracts/on-device-security.md)
- [ ] T025 [US1] Implement sign-out clearing of the secure session and the in-memory cache (FR-009)
- [ ] T026 [US1] Handle expired/revoked session → return to sign-in without exposing cached workspace data (FR-010)
- [ ] T027 [US1] Verify no paywall / IAP / trial gate at install; app declares free (FR-003, contracts/store-readiness.md)

**Checkpoint**: The free app installs, signs in both ways, and holds a secure session — MVP reachable.

---

## Phase 4: User Story 2 - Core financial workflows stay backend-authoritative (Priority: P1)

**Goal**: Dashboard, income/expense CRUD (per role), history/filtering,
categories, reports, and settings work in the app, with all totals and
permissions coming from the backend and matching the web.

**Independent Test**: Complete each core task on device; confirm totals equal the
web for the same workspace/period and role restrictions match the web.

### Tests for User Story 2

- [ ] T028 [P] [US2] Native/e2e test: dashboard + report totals equal backend/web values for the same workspace/period in `apps/mobile/e2e/finance-parity.spec.*`
- [ ] T029 [P] [US2] Native/e2e test: role restriction (Viewer cannot mutate; same behaviour as web) in `apps/mobile/e2e/roles.spec.*`

### Implementation for User Story 2

- [ ] T030 [US2] Verify the dashboard renders backend-provided remaining balance, income/expense totals, period, top categories, recent expenses, and pending-review count in the native shell (FR-011, FR-012)
- [ ] T031 [US2] Verify income/expense create/edit/delete per role against the existing endpoints, with no local financial logic (FR-011, FR-012, FR-014)
- [ ] T032 [US2] Verify income/expense history and filtering on device (FR-011)
- [ ] T033 [US2] Verify category management on device (FR-011)
- [ ] T034 [US2] Verify report totals equal dashboard totals for the same workspace/period, reusing backend confirmed-only calculations (FR-013)
- [ ] T035 [US2] Verify settings flows on device and confirm no permission/financial decision is made or cached locally (FR-014, FR-015)

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

- [ ] T036 [P] [US3] Native test: camera capture + file pick → preview → upload → induced-failure retry yields exactly one stored file in `apps/mobile/e2e/capture-upload.spec.*`
- [ ] T037 [P] [US3] Native/e2e test: extraction confirm → expense; discard/failed → zero totals in `apps/mobile/e2e/ai-review.spec.*`

### Implementation for User Story 3

- [ ] T038 [US3] Integrate native camera capture into `apps/web/components/files/FileUpload.tsx` via the capability shim, falling back to the existing web capture (Phase 15) when native is unavailable (FR-016, FR-020)
- [ ] T039 [US3] Ensure preview with file name/size and replace/remove before confirmation (reuse Phase 15 behaviour) (FR-017)
- [ ] T040 [US3] Ensure upload progress, duplicate-submission prevention, safe failure messaging, and retry-yields-one-file (FR-018)
- [ ] T041 [US3] Reuse Phase 6 file-type/file-size validation (10 MB; PNG/JPEG/WebP/PDF) unchanged, explaining rejection before upload; camera-absent fallback shows no dead control (FR-019, FR-020)
- [ ] T042 [US3] Reuse Phase 8 extraction review: start/confirm/discard; confirmed → expense; failed/discarded → no totals impact (FR-021)

**Checkpoint**: Mobile capture, upload, and AI review are reliable and safe.

---

## Phase 6: User Story 4 - Sessions, keys, and workspace isolation are protected on device (Priority: P1)

**Goal**: Session tokens live only in secure storage; no secrets on device;
cache is per-user/per-workspace and cleared on switch/sign-out/expiry; the
Phase 15 read-only offline model is preserved.

**Independent Test**: Inspect device storage for secrets; switch workspace, sign
out, and sign in as a second user to confirm isolation; verify offline safety.

### Tests for User Story 4

- [ ] T043 [P] [US4] Native test: device-storage inspection — session in secure store only; zero API keys, tokens, vault values, internal ids, persisted records, or receipt contents in `apps/mobile/e2e/secure-storage.spec.*`
- [ ] T044 [P] [US4] Native/e2e test: workspace-switch purge + sign-out clearing + second-user isolation + expired-session-on-reconnect in `apps/mobile/e2e/isolation.spec.*`

### Implementation for User Story 4

- [ ] T045 [US4] Enforce secure-store-only session and remove default WebView localStorage token persistence when native (contracts/on-device-security.md, FR-008, FR-022)
- [ ] T046 [US4] Scope the in-memory cache per user/workspace and purge prior-workspace data on switch (FR-023)
- [ ] T047 [US4] Ensure sign-out and session expiry clear all cached content, not recoverable on relaunch; second user sees only their own data (FR-009, FR-024)
- [ ] T048 [US4] Ensure no AI provider key, vault value, or internal id is retained or exposed, and receipt content is not persisted or made public from the device (FR-022, FR-025)
- [ ] T049 [US4] Preserve the Phase 15 read-only offline model in the native shell — no offline writes, no queue/replay, no auto-retry; post-reconnect totals equal backend values (FR-026, contracts/on-device-security.md)

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

- [ ] T050 [P] [US5] Native/e2e test: RTL/LTR incl. native chrome + safe areas in portrait/landscape, both locales, in `apps/mobile/e2e/rtl-ltr.spec.*`

### Implementation for User Story 5

- [ ] T051 [US5] Verify Arabic RTL / English LTR across all core screens and native chrome (status bar, back gesture direction, deep-link return) (FR-027)
- [ ] T052 [US5] Support platform dynamic/enlarged font sizes without truncation or overlap hiding content/actions (FR-028)
- [ ] T053 [US5] Ensure meaningful screen-reader labels and roles in the active language (FR-028)
- [ ] T054 [US5] Respect safe-area insets in portrait and landscape; touch targets and colour contrast meet accepted accessibility guidance (FR-029)
- [ ] T055 [US5] Preserve in-progress form input across language/orientation changes; re-mirror native chrome (FR-030)

**Checkpoint**: Both directions and accessibility criteria pass on device.

---

## Phase 8: User Story 6 - Store review readiness and release documentation (Priority: P2)

**Goal**: Complete, truthful store submissions in both languages with accurate
privacy/data-safety declarations, reviewer guidance, minimum-functionality
evidence, and a reproducible release runbook.

**Independent Test**: Review both submissions against current store requirements;
confirm completeness, truthfulness, free/no-IAP, and reproducibility.

### Implementation for User Story 6

- [ ] T056 [P] [US6] Write `docs/mobile/store-listing.en.md` — English title/description/screenshots/category/content rating and free/no-IAP declaration (contracts/store-readiness.md, FR-032)
- [ ] T057 [P] [US6] Write `docs/mobile/store-listing.ar.md` — Arabic store listing/metadata (FR-032)
- [ ] T058 [P] [US6] Write `docs/mobile/privacy-data-safety.md` — privacy-policy link + data-safety / privacy-nutrition mapping reflecting secure-session-only storage and existing-backend transmission (FR-032)
- [ ] T059 [P] [US6] Write `docs/mobile/reviewer-guide.md` — reviewer sign-in path to exercise core functionality (FR-034)
- [ ] T060 [P] [US6] Write `docs/mobile/release-runbook.md` — developer accounts, signing/key management, version numbering, staged rollout for both platforms (FR-035)
- [ ] T061 [US6] Assemble Apple Guideline 4.2 / Google Play minimum-functionality evidence (camera capture, secure storage, locally bundled shell) per contracts/store-readiness.md (FR-033)
- [ ] T062 [US6] Verify current store requirements and data-safety form fields against live store documentation at implementation time and reconcile the docs above (research.md R-008, Assumptions)

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
