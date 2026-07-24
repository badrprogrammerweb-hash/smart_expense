# Quickstart: Free Mobile Application

A validation/run guide for the Phase 16 native apps. It proves the packaged apps
reuse the existing backend, keep financial truth backend-authoritative, and meet
the phase's security, capture, localization, and store-readiness criteria.
Implementation detail lives in `tasks.md`; this is a run/verify guide.

## Prerequisites

- Phase 15 baseline present: installable PWA, manifest, service worker, icons,
  read-only offline model, camera/file capture, and the
  `docs/mobile/app-store-readiness.md` reuse record.
- The existing web build (`apps/web`) builds successfully and the backend
  (`apps/api`) runs with Supabase configured (existing dev setup).
- Native toolchains available for the platform under test: Android SDK/Gradle
  (Android) and Xcode (iOS/macOS). At least one Android and one iOS device or
  emulator/simulator.
- The Capacitor project under `apps/mobile/` with the local web-bundle build step
  and native plugin wiring (produced by the tasks).

## Build & run (per platform)

1. Produce the local web bundle from `apps/web` and copy it into the Capacitor
   `webDir` (see `apps/mobile/scripts/build-web-bundle.*`).
2. Sync Capacitor and open the platform project (Android Studio / Xcode).
3. Run on a device/emulator against the existing remote backend + Supabase.
4. Confirm the app launches full-screen into the correct locale/direction and
   presents sign-in.

## Validation scenarios (map to spec Success Criteria)

### 1. Free install & sign-in (US1 → SC-001, SC-002, SC-003)

- Install from a store **test track** on Android and iOS: no payment, paywall, or
  trial gate appears.
- Sign in by email/password → lands in the correct workspace.
- Sign in by the already-enabled provider → secure session opens, returns via the
  deep link, lands signed in (test cold-start, backgrounded, already-signed-in).
- Restart the app → session restored from secure storage without re-entering
  credentials. Sign out → returns to sign-in and clears cached content.

### 2. Backend-authoritative finances (US2 → SC-004, SC-005)

- View dashboard; add an expense; add income where role permits; filter history;
  manage categories; open reports; change settings.
- For each tested workspace/period, remaining balance, income total, and expense
  total in the app **equal** the web values; report totals equal dashboard
  totals. Zero discrepancy.
- A Viewer/restricted role is refused disallowed actions exactly as on the web.

### 3. Capture, upload & AI review (US3 → SC-006, SC-007)

- Capture a receipt with the camera and also pick an existing image/PDF; preview,
  replace/remove, confirm.
- Existing validation (10 MB; PNG/JPEG/WebP/PDF) applies; oversized/invalid files
  are explained before upload.
- Induce an upload failure, retry → exactly **one** stored file.
- With a BYOK key: start extraction, review, confirm → becomes an expense;
  discard/failed → affects **zero** totals.
- On a device without camera capture: file selection still works, no dead control.

### 4. On-device security & isolation (US4 → SC-003, SC-008, SC-009)

- Inspect Keychain/Keystore + app sandbox: session in secure store; **zero** API
  keys, vault values, internal identifiers, persisted financial records, or
  receipt contents.
- Populate Workspace A → switch to B: no A data shown (incl. offline).
- Sign out → cached content gone on relaunch. Second user signs in → no prior
  user's data.
- Session expired while offline → on reconnect returns to sign-in, no stale data.

### 5. Offline safety (reused Phase 15 model → SC-009)

- Disable network mid-session: shell renders with an offline indicator; every
  mutating action is blocked with an explanation; nothing is queued.
- Reconnect: indicator clears, data refreshes, totals equal backend values; each
  interrupted submission resolved to exactly zero or one persisted record.

### 6. Localization & accessibility (US5 → SC-005, SC-010)

- Run all core tasks in Arabic RTL and English LTR, incl. native chrome (status
  bar, back gesture, deep-link return) mirrored correctly.
- Enlarge system font: no truncation/overlap hiding content or actions.
- Enable a screen reader: interactive elements expose meaningful labels/roles in
  the active language. Safe areas respected in portrait and landscape; touch
  targets and contrast meet guidance.

### 7. Store readiness (US6 → SC-011, SC-014)

- Review both submissions against current store requirements: listings/metadata
  complete and truthful in both languages; free/no-IAP declared; privacy &
  data-safety declarations accurate; reviewer sign-in guidance present.
- Confirm the app demonstrates native functionality (camera, secure storage,
  local shell) for minimum-functionality review.
- A maintainer reproduces a submission from `docs/mobile/release-runbook.md`
  without undocumented steps.

## Regression gate (SC-012, SC-013)

- Run the existing web suites unchanged: `pnpm/npm --filter web test` (Vitest) and
  `npm --filter web test:e2e` (Playwright), including both-locale mobile projects.
  All behavioural, financial, permission, and RTL/LTR assertions stay green.
- Re-run the full backend suite unmodified: `pytest` in `apps/api`. No `apps/api`
  or `supabase` diff.
- Run the native smoke/e2e layer on at least one Android and one iOS
  device/emulator.

## Manual sweep record (device-bound criteria)

Record results (device, OS version, locale, pass/fail, notes) for what cannot be
automated: real store test-track install and launch, physical camera capture,
provider sign-in + deep-link return on a real device, screen-reader labels,
touch ergonomics / safe-area rendering, and a store-review dry run. This mirrors
the Phase 14/15 manual-sweep pattern and is a required deliverable.
