---

description: "Task list for Phase 15 — Progressive Web App and Mobile Readiness"
---

# Tasks: Progressive Web App and Mobile Readiness

**Input**: Design documents from `/specs/015-pwa-mobile-readiness/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks ARE included — FR-043 and FR-044 explicitly require automated coverage for installability metadata, offline behaviour, cache isolation, mobile capture, and mobile navigation, plus keeping existing suites behaviour-green.

**Organization**: Tasks are grouped by user story so each can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Exact file paths are included in every task

## Path Conventions

Existing monolith. **This phase touches `apps/web/` only**, plus one new
document under `docs/mobile/`. `apps/api/` and `supabase/` are frozen and the
backend suite is re-run unmodified as a regression gate.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new directories and capture the pre-phase baseline before any behaviour changes.

- [X] T001 Capture the pre-phase performance and storage baseline in the "Baseline Appendix" of `specs/015-pwa-mobile-readiness/quickstart.md`: cold desktop dashboard load feel, mobile-viewport load feel, current installability (expected: not installable), and current Cache Storage contents (expected: empty)
- [X] T002 Create the new `apps/web/public/` directory and `apps/web/public/icons/` subdirectory (no `public/` tree exists in the repo today)
- [X] T003 [P] Add a `mobile-ltr` Playwright project (mobile device profile, locale `en-US`) alongside the existing `mobile-rtl` project in `apps/web/playwright.config.ts`, matching the same new Phase 15 spec files
- [X] T004 [P] Add the Phase 15 translation namespaces (`pwa.install.*`, `pwa.offline.*`, `pwa.cached.*`, `nav.more`, `files.capture.*`) with placeholder-free Arabic and English strings in `apps/web/messages/ar.json` and `apps/web/messages/en.json`

**Checkpoint**: Directories exist, both mobile Playwright projects are configured, and translation keys are available.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Viewport, safe-area, and design-token plumbing that every later story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Add a Next `viewport` export to `apps/web/app/layout.tsx` with `viewportFit: "cover"` and `themeColor` sourced from the Phase 14 brand token, without setting `maximumScale` or `userScalable: false` (contract `web-app-manifest.md` §4)
- [X] T006 Add safe-area inset utility classes to `apps/web/app/globals.css` inside `@layer utilities` — logical `block-start`/`block-end` for the vertical edges and **physical** `left`/`right`/`x` for the horizontal edges (because `env(safe-area-inset-*)` values are physical and would be swapped under RTL by logical properties) — plus a `dvh`-based full-height helper with a `vh` fallback, introducing no new design tokens (contract `mobile-interaction.md` §2)
- [X] T007 Resolve and document the concrete `background_color` and `theme_color` hex values from the existing Phase 14 tokens in `apps/web/app/globals.css`, recording them in `specs/015-pwa-mobile-readiness/contracts/web-app-manifest.md` §2 so the manifest and `<meta name="theme-color">` cannot drift

**Checkpoint**: Safe-area and theme plumbing ready — user story implementation can begin.

---

## Phase 3: User Story 1 - The application installs and launches like an app (Priority: P1) 🎯 MVP

**Goal**: The application is installable, launches standalone with correct branding and direction, and offers a platform-adaptive, dismissible install affordance.

**Independent Test**: On a supported mobile browser, install from the affordance, launch from the home screen, and confirm standalone display, correct icon/name, branded launch appearance, correct reading direction, and a resumed session.

### Tests for User Story 1

- [X] T008 [P] [US1] Write `apps/web/e2e/pwa-installability.spec.ts` asserting contract `web-app-manifest.md` checks M-1 through M-6: `/manifest.webmanifest` returns 200 with all required fields, every icon URL resolves with the declared type and dimensions, exactly one icon is `maskable`, colours equal the concrete hex values recorded in the contract by T007 (`#006148` / `#fdfcf7`) rather than re-deriving oklch→sRGB inside the test, the document carries `<link rel="manifest">` and a matching `<meta name="theme-color">`, and user scaling is not disabled
- [X] T009 [P] [US1] Add install-affordance behaviour assertions M-7 and M-8 to `apps/web/e2e/pwa-installability.spec.ts`: the banner is absent when the app reports as installed/standalone, and after dismissal it does not reappear on navigation within the session while the Settings entry remains present
- [X] T010 [P] [US1] Write Vitest specs for the install affordance's four capability states (`promptable`, `manual`, `installed`, `unsupported`) in `apps/web/components/pwa/__tests__/InstallPrompt.test.tsx`, covering FR-005 and FR-006a in both locales

### Implementation for User Story 1

- [X] T011 [P] [US1] Produce the four icon assets — `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (content within the central 80% safe zone), and `apple-touch-icon.png` (180×180, no transparency) — in `apps/web/public/icons/`, with no placeholder or upscaled asset
- [X] T012 [US1] Create `apps/web/app/manifest.ts` exporting a `MetadataRoute.Manifest` with the exact field set in contract `web-app-manifest.md` §2 (`id`, `name`, `short_name`, `description`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, colours from T007, icons from T011) and none of the forbidden fields
- [X] T013 [US1] Add the `<link rel="apple-touch-icon">` reference to `apps/web/app/layout.tsx`
- [X] T014 [P] [US1] Implement install-capability detection in `apps/web/lib/pwa/install.ts`: capture the deferred install-prompt event where the platform fires one, detect standalone/installed mode, detect manual-install platforms, and expose `capability`, `deferredPrompt`, and `dismissedThisSession` per `data-model.md` §6
- [X] T015 [US1] Implement `apps/web/components/pwa/InstallPrompt.tsx` as a dismissible in-page banner (never a modal) that triggers the platform prompt when promptable, shows translated add-to-home-screen instructions on manual-install platforms, and renders nothing when installed or unsupported (FR-005, FR-006a)
- [X] T016 [US1] Mount `InstallPrompt` in the workspace shell at `apps/web/app/[locale]/w/[workspaceId]/layout.tsx` so it appears contextually without obstructing the primary task
- [X] T017 [US1] Add the permanent install entry to `apps/web/app/[locale]/w/[workspaceId]/settings/page.tsx`, following the same capability state table so a user who dismissed the banner can still install (FR-005)

**Checkpoint**: The application is installable and the affordance behaves correctly on every platform class. US1 is independently testable.

---

## Phase 4: User Story 2 - Offline and reconnect behaviour is safe and never corrupts financial data (Priority: P1)

**Goal**: Offline renders the shell with a clear indicator, every mutating action is blocked and explained, no write is ever queued, and reconnect recovers cleanly with at-most-once submission semantics.

**Independent Test**: Disconnect mid-session; confirm shell + indicator + staleness labelling, every mutating action blocked, then reconnect and confirm refresh, restored actions, unchanged totals, and no duplicate records after an interrupted submission.

### Tests for User Story 2

- [X] T018 [P] [US2] Write `apps/web/e2e/offline-behavior.spec.ts` covering contract `offline-behavior.md` checks O-1 and O-2: offline navigation renders the locale-correct offline route with a visible connectivity indicator, and each of the eleven mutating actions in §3 is disabled with an explanation
- [X] T019 [P] [US2] Add checks O-3, O-4, O-5, and O-6 to `apps/web/e2e/offline-behavior.spec.ts`: no queued write exists in any storage mechanism after an offline session; reconnect clears the indicator, refetches, and re-enables actions without a reload; an interrupted submission yields exactly zero or one record across repeated cycles; and post-reconnect totals equal the backend's values
- [X] T020 [P] [US2] Add checks O-7, O-8, and O-9 to `apps/web/e2e/offline-behavior.spec.ts`: `mutations.retry` resolves to `false` with no overriding call site, a backend-unreachable-but-browser-online condition renders `degraded` rather than empty data, and rapid connectivity toggling settles once without indicator flashing or duplicated in-flight requests
- [X] T021 [P] [US2] Add service-worker cache-policy assertions SW-1 through SW-8 in `apps/web/e2e/offline-behavior.spec.ts` (or a dedicated spec): after a full authenticated session, enumerating `caches.keys()` and each cache's entries yields zero API-origin and zero Supabase-origin URLs, every cached entry matches the §1 allowlist, offline navigation serves the offline route, an API request offline rejects rather than being served from cache, a bumped `CACHE_VERSION` removes prior caches, registration does not occur in a development build, and post-sign-out only allowlisted shell assets remain
- [X] T022 [P] [US2] Write Vitest specs for the connectivity state machine in `apps/web/lib/connectivity/__tests__/connectivity.test.ts`: `ApiError` is not classified as a connectivity failure, network-class failures while `navigator.onLine` is true produce `degraded`, transitions are debounced, and no interval polling occurs
- [X] T023 [P] [US2] Write Vitest specs for the offline banner and stale-data notice in `apps/web/components/ui/__tests__/offline-banner.test.tsx` and `apps/web/components/ui/__tests__/stale-data-notice.test.tsx`, asserting translated text and correct direction in both locales

### Implementation for User Story 2

- [X] T024 [US2] Implement the service worker at `apps/web/public/sw.js` per contract `service-worker-cache-policy.md`: a `CACHE_VERSION`-scoped shell cache, precaching of `/ar/offline` and `/en/offline`, network-first navigations falling back to the locale-matched offline route, cache-first for `/_next/static/**`, `/icons/**`, and `/manifest.webmanifest`, and a `fetch` handler that evaluates the **denylist first** so API-origin, Supabase, `Authorization`-bearing, non-`GET`, `Set-Cookie`, and `no-store` requests are passed straight to the network and never cached. **Review note**: the initial implementation opportunistically ran `cache.put()` on every same-origin navigation response that passed a `mayStore()` header check (ok, no `Set-Cookie`, no `no-store`). It never actually stored anything in practice, because Next.js currently sends `no-store` on every dynamic/authenticated route by default — but that safety property was an accident of Next's current defaults, not something the code enforced, and would have silently started persisting workspace-scoped pages to disk the moment any route opted into static/ISR caching or a proxy stripped that header. Fixed so navigation responses are **never** written to any cache — only read-matched against the precached offline routes — per data-model.md §5's "nothing else." Covered by a new runtime test (not the pre-existing source-text-substring check) that signs in, visits dashboard/expenses/incomes/files/reports, and asserts zero cached entries fall outside the allowlist; also added a genuine network-cut test (`context.setOffline`) for the offline-route fallback, since the existing tests only faked `navigator.onLine` without ever severing a real request.
- [X] T025 [US2] Implement `activate` handling in `apps/web/public/sw.js` that deletes every cache not matching the current `CACHE_VERSION` and calls `clients.claim()`, plus `skipWaiting()` on `install` (FR-028)
- [X] T026 [US2] Implement `apps/web/components/pwa/ServiceWorkerRegistrar.tsx` registering `/sw.js` only in production builds and only when `"serviceWorker" in navigator`, handling the update-available path so a subsequent navigation loads the new version, and mount it from `apps/web/app/layout.tsx`
- [X] T027 [P] [US2] Create the translated offline fallback route at `apps/web/app/[locale]/offline/page.tsx` using the Phase 14 design system, rendering correctly in both locales and directions
- [X] T028 [US2] Implement `ConnectivityProvider` and `useConnectivity()` in `apps/web/lib/connectivity/` per `data-model.md` §3: derive `online | degraded | offline` from browser events, real request outcomes, and a debounced, on-demand, recovery-only unauthenticated `GET` to the existing backend `/health` endpoint — no interval polling and no new endpoint
- [X] T029 [US2] Extend `apps/web/lib/api/client.ts` to classify fetch rejections and timeouts as connectivity failures distinct from `ApiError` (which means the backend answered), exposing that classification to the connectivity provider
- [X] T030 [US2] Wire `ConnectivityProvider` into `apps/web/components/providers.tsx`, adding `QueryCache`/`MutationCache` `onError` handlers that feed request outcomes into the connectivity state
- [X] T031 [US2] Pin `mutations: { retry: false }` in the query-client defaults in `apps/web/components/providers.tsx`, and audit every existing `useMutation` call site across `apps/web/components/**` to confirm none overrides it (contract `offline-behavior.md` D-1)
- [X] T032 [US2] Record the `refetchOnWindowFocus` decision from research R-006 in `apps/web/components/providers.tsx` — keep, or reduce to `false` while retaining `refetchOnReconnect` — based on measured request behaviour on an installed mobile PWA, with a comment stating which was chosen and why
- [X] T033 [P] [US2] Implement `apps/web/components/ui/offline-banner.tsx` as a persistent, translated connectivity indicator rendered whenever the state is not `online`, with distinct copy for `offline` and `degraded`
- [X] T034 [P] [US2] Implement `apps/web/components/ui/stale-data-notice.tsx` rendering a "cached — last updated \<time\>" label using the Phase 14 date formatting, shown only when the state is not `online` (FR-008)
- [X] T035 [US2] Add safe-area padding and the offline banner slot to `apps/web/components/ui/app-shell.tsx`, and render the banner from `apps/web/components/layout/WorkspaceShell.tsx`
- [X] T036 [US2] Gate every mutating action on `useConnectivity().canMutate` across the eleven surfaces in contract `offline-behavior.md` §3 — income, expense, and category forms and delete dialogs, `apps/web/components/files/FileUpload.tsx` and `DeleteFileDialog.tsx`, `TriggerExtractionButton.tsx`, `ExtractionReviewForm.tsx`, `DiscardExtractionDialog.tsx`, and the settings surfaces (`WorkspaceCurrencySelector.tsx`, `AutoDeleteToggle.tsx`, `AiProviderKeyForm.tsx`, `RemoveAiKeyDialog.tsx`) — disabling each with an explanation and never staging, queuing, or storing the attempt. **Review note**: the initial pass gated `IncomeForm.tsx`/`ExpenseForm.tsx` (create/edit) and `CategoryList.tsx`/`DeleteFileDialog.tsx` correctly, but missed the Delete buttons living directly in `IncomeHistoryList.tsx`/`ExpenseHistoryList.tsx` (a different component from the form) — fixed with `disabled={!canMutate}` + `MutationDisabledNotice` on both, and given a dedicated e2e test since the existing generic `button[type="submit"]` check could never have caught a `type="button"` delete control.
- [X] T037 [US2] Implement the indeterminate-outcome flow (contract `offline-behavior.md` D-2 through D-5): a mutation failing with a network-class error reports an unknown outcome, the affected list refetches on reconnect, and the retry affordance directs the user to confirm from the refreshed list before resubmitting — with the submit control disabled for the duration of every in-flight mutation. **Review note**: `useIndeterminateOutcome()`'s `visible` flag had no reset path — once shown, it persisted for the rest of the client-side session (surviving reconnect and successful retries) since nothing ever set it back to `false`. Fixed to clear on the next successful request after reconnect, consistent with D-3's "refetch before offering retry"; covered by a new unit test.
- [X] T038 [US2] Show the stale-data notice on cached workspace views while not `online`, and render the offline state instead of stale or empty-looking data where no in-session data exists (FR-008, cold-launch-offline edge case)

**Checkpoint**: Offline is safe, blocked, labelled, and recoverable, with at-most-once submission semantics. US2 is independently testable.

---

## Phase 5: User Story 4 - On-device data never leaks across workspaces, users, or sessions (Priority: P1)

**Goal**: Cached data is scoped to one user and one workspace, and is cleared on workspace switch, sign-out, session expiry, and version change — with nothing sensitive on the device.

**Independent Test**: Populate Workspace A, switch to Workspace B and confirm no A data (including offline), sign out and confirm clearing, then sign in as a different user and confirm no prior data anywhere.

### Tests for User Story 4

- [X] T039 [P] [US4] Write `apps/web/e2e/cache-isolation.spec.ts` covering contract `offline-behavior.md` checks O-10 and O-11: after a workspace switch no prior-workspace record, total, file, or summary renders (including offline), and after sign-out plus a second user signing in no prior user data renders anywhere. **Review note**: the original O-10 combined "switch workspace" with "then go offline and navigate via `page.goto`" in one assertion. Proven (by temporarily disabling the eviction predicate and re-running — it still passed) that the offline half is a false positive: a full-page navigation while offline is served by the service worker's generic offline fallback regardless of what is or isn't evicted, so it cannot distinguish "eviction worked" from "the page just failed to load." Split into O-10a (the real online assertion) and O-10b (kept, relabelled honestly as a safety check, not an eviction proof), and added a deterministic unit test (`lib/__tests__/workspace-context.test.ts`) against the extracted `evictQueriesForPreviousWorkspace` function, which is what actually proves the FR-023 mechanism.
- [X] T040 [P] [US4] Add check O-12 to `apps/web/e2e/cache-isolation.spec.ts`: a session that expired while offline returns to sign-in on reconnect with no cached workspace data readable. **Review note**: as written, O-12 manually calls `context.clearCookies()` and clears `localStorage`/`sessionStorage` itself before reloading — so the pass is guaranteed by the pre-existing server-side auth middleware's cookie check, not by this phase's `apiFetch` 401 handler (T045). Relabelled to describe what it actually verifies (the middleware gate) and added `lib/api/__tests__/client.test.ts`, a direct unit test of `apiFetch`'s 401 path that mocks a real 401 response and asserts `clearInMemoryQueryCache()` runs before the sign-in redirect — verified to fail when that call is removed.
- [X] T041 [P] [US4] Add an automated storage-inspection assertion to `apps/web/e2e/cache-isolation.spec.ts` covering SC-009: after a full authenticated session, Cache Storage, IndexedDB, localStorage, and sessionStorage contain no financial record, receipt content, API key, access token, vault value, or internal database identifier

### Implementation for User Story 4

- [X] T042 [US4] Remove in-memory queries scoped to the previous workspace when `workspaceId` changes in `apps/web/lib/workspace-context.tsx` (or the workspace switch handler in `apps/web/components/layout/WorkspaceSelector.tsx`), using the existing workspace-scoped query keys (FR-023). **Review note**: audited every `useQuery`/`useMutation` call site (15 files) — every workspace-scoped query key places `workspaceId` as a direct top-level array element, so the `query.queryKey.some(part => part === previousWorkspaceId)` predicate correctly matches all of them; no query key nests it inside an options object where the predicate would miss it. Extracted the predicate into an exported `evictQueriesForPreviousWorkspace` function so it is unit-testable in isolation.
- [X] T043 [US4] Extend the sign-out handler in `apps/web/components/layout/WorkspaceShell.tsx` to post a message to the service worker instructing it to delete all non-shell caches, alongside the existing `queryClient.clear()` (FR-024)
- [X] T044 [US4] Add the corresponding message handler to `apps/web/public/sw.js` that deletes every cache outside the allowlisted shell set on request
- [X] T045 [US4] Clear the in-memory query cache on the expired-session sign-in redirect path in `apps/web/lib/api/client.ts` so expired-session data is not readable on the way out (FR-029)

**Checkpoint**: Isolation holds across switch, sign-out, second user, expiry, and version change. US4 is independently testable.

---

## Phase 6: User Story 3 - Receipts can be captured and uploaded from a phone (Priority: P1)

**Goal**: A phone user can capture a receipt with the camera or pick a file, preview it, upload it with progress, and retry a failure without creating duplicates.

**Independent Test**: On a mobile viewport and device, use both capture and picker, preview and confirm, verify the file lands against the correct workspace, and verify one retry after an induced failure yields exactly one file.

### Tests for User Story 3

- [X] T046 [P] [US3] Write `apps/web/e2e/mobile-capture.spec.ts` covering contract `mobile-interaction.md` checks MI-7, MI-8, and MI-9: the capture control is present on a coarse-pointer profile and absent on desktop, selecting a file shows a preview with name and size that can be removed, and an induced upload failure followed by one retry yields exactly one stored file
- [X] T047 [P] [US3] Write Vitest specs for the capture-enabled upload primitive in `apps/web/components/ui/__tests__/file-upload.test.tsx`: capture-control feature detection, preview rendering, object-URL revocation on replace and unmount, cancelled capture leaving the form unchanged, and the confirm control disabled while in flight

### Implementation for User Story 3

- [X] T048 [US3] Extend `apps/web/components/ui/file-upload.tsx` with a second capture source using `<input type="file" accept="image/*" capture="environment">`, rendered only when `"capture" in document.createElement("input")` and `matchMedia("(pointer: coarse)").matches`, so no non-functional control appears on desktop (FR-016, FR-020)
- [X] T049 [US3] Add the staged-file preview to `apps/web/components/ui/file-upload.tsx` — file name, size, and an image thumbnail via an object URL revoked on replace and on unmount — with replace and remove controls (FR-017, contract C-4/C-5). **Review note**: there is no dedicated "Replace" button (the `files.capture.replace` string added in Phase 1 went unused) — replacing is done by re-selecting via either the picker or capture input, which remain visible alongside the staged preview. This is a legitimate design choice that satisfies FR-017, but nothing proved it actually worked (swaps rather than stacks, revokes the superseded object URL) until a test was added for it.
- [X] T050 [US3] Wire the capture source, preview, and staged-file state into `apps/web/components/files/FileUpload.tsx` per `data-model.md` §7, keeping the existing Phase 6 validation (10 MB limit, PNG/JPEG/WebP/PDF allow-list) unchanged for both sources (FR-021)
- [X] T051 [US3] Ensure a cancelled capture leaves `apps/web/components/files/FileUpload.tsx` unchanged with no partial file staged, and that upload progress shows a descriptive label while the confirm control stays disabled (FR-018, FR-022). **Review note**: the submit `Button` had `loading={isUploading}` but no `loadingLabel`, so during upload only a spinner appeared against the unchanged static "Upload" label — no descriptive text (screen-reader users got no signal anything was happening; the `files.capture.uploading` string added in Phase 1 for exactly this was never wired up). Fixed by passing `loadingLabel={t("capture.uploading")}`; verified the new test fails without the fix and passes with it.
- [X] T052 [US3] Confirm upload failure messaging in `apps/web/components/files/FileUpload.tsx` exposes no internal identifier, storage token, or stack trace, and that retry follows the at-most-once rules from contract `offline-behavior.md` §6 (FR-019)
- [X] T053 [US3] Disable both capture and picker with an explanation while offline or degraded in `apps/web/components/files/FileUpload.tsx`, staging nothing for later upload (contract C-10)

**Checkpoint**: Mobile capture and upload work safely with no duplicate risk. US3 is independently testable.

---

## Phase 7: User Story 5 - Mobile navigation and touch interactions feel native-quality (Priority: P2)

**Goal**: One-handed, direction-aware bottom navigation; safe-area-respecting layouts; keyboard-aware forms; comfortable touch targets; predictable dismissal — in both locales.

**Independent Test**: Complete every core task on a phone viewport in both languages, portrait and landscape, confirming reach, mirroring, safe areas, touch targets, dismissal, and unobstructed input with the keyboard open.

### Tests for User Story 5

- [ ] T054 [P] [US5] **Note**: the `chromium` project has no explicit `testMatch`, so it inherits the top-level glob and will also run the Phase 15 mobile specs on a desktop viewport — guard mobile-only assertions by project name or viewport width so they do not fail on `chromium`, where the bottom nav is hidden. Write `apps/web/e2e/mobile-navigation.spec.ts` covering contract `mobile-interaction.md` checks MI-1 through MI-4 in both locales: the bottom nav renders role-permitted destinations plus "more" with the desktop sidebar hidden, the active destination carries `aria-current="page"` and a visible indicator, Arabic mirrors item order and drawer side relative to English, and a Viewer sees no forbidden destination in bar or drawer
- [ ] T055 [P] [US5] Add checks MI-5, MI-6, MI-10, and MI-11 to `apps/web/e2e/mobile-navigation.spec.ts`: every interactive control on the audited mobile screens has a bounding box of at least 44×44px, the bottom nav does not occlude the last list row or the primary action, all eight core tasks complete on a mobile viewport in both locales, and dialogs/drawers dismiss via control and back gesture without leaving the underlying screen
- [ ] T056 [P] [US5] Write Vitest specs for the bottom navigation in `apps/web/components/ui/__tests__/bottom-nav.test.tsx`: role filtering, the four-plus-"more" split, `aria-current` on the active item, keyboard focusability, and logical-property mirroring

### Implementation for User Story 5

- [ ] T057 [US5] Implement `apps/web/components/ui/bottom-nav.tsx` per contract `mobile-interaction.md` §1: rendered below `lg` only, carrying the first four role-permitted destinations from the existing `navItems` array plus a "more" entry, using logical CSS properties for automatic RTL/LTR mirroring, `padding-block-end: env(safe-area-inset-bottom)`, `aria-current="page"` on the active item, and real focusable links
- [ ] T058 [US5] Render the bottom navigation from `apps/web/components/layout/WorkspaceShell.tsx`, reusing the existing role-filtered `navItems` array unchanged and routing the "more" entry to the existing `MobileNavDrawer` with the remaining destinations and quick actions (FR-030, FR-038)
- [ ] T059 [US5] Add bottom padding equal to the bar height to the content region in `apps/web/components/ui/app-shell.tsx` so the bar never occludes the last row or a primary action (contract N-9)
- [ ] T060 [US5] Apply `env(safe-area-inset-*)` on all four sides of the shell and to full-height overlays in `apps/web/components/ui/app-shell.tsx`, `apps/web/components/ui/dialog.tsx`, and `apps/web/components/ui/mobile-nav-drawer.tsx`, verified in portrait and landscape (contract S-2/S-3)
- [ ] T061 [US5] Convert full-height layouts from `vh` to `dvh` and make form footers sticky with safe-area padding in `apps/web/components/ui/app-shell.tsx` and the shared form layout, so the focused field and primary submit action stay visible with the on-screen keyboard open (FR-033, contract S-4/K-1/K-2)
- [ ] T062 [US5] Audit the mobile screens for the 44×44px touch-target minimum and adjacent-control spacing, adjusting the affected primitives in `apps/web/components/ui/` (FR-034, contract T-1/T-2)
- [ ] T063 [US5] Ensure dialogs, sheets, and drawers close on the device back gesture and their dismiss control without navigating away from the underlying screen, and return focus to the opening control, in `apps/web/components/ui/dialog.tsx` and `apps/web/components/ui/mobile-nav-drawer.tsx` (FR-035, contract T-3/T-4)
- [ ] T064 [US5] Ensure in-progress form input survives an orientation change: confirm form state is held in React (via `react-hook-form`) rather than in layout-dependent DOM state across the income, expense, category, AI review, and settings forms, and add an orientation-change assertion (rotate the viewport mid-edit, confirm field values persist) to `apps/web/e2e/mobile-navigation.spec.ts` (FR-036, contract K-4)

**Checkpoint**: The mobile experience meets the interaction contract in both locales. US5 is independently testable.

---

## Phase 8: User Story 6 - The frontend and contracts are documented as ready for app-store packaging (Priority: P3)

**Goal**: A Phase 16 developer has a written record of what is verified, what must be preserved, and what is deferred — with no contract change proposed.

**Independent Test**: Review the document against the Phase 16 goals in `docs/implementation-plan.md` and confirm every prerequisite is satisfied or explicitly deferred, and that zero API or schema changes are proposed.

- [ ] T065 [US6] Write `docs/mobile/app-store-readiness.md` with the sections required by research R-012: verified installability characteristics and platforms checked, the icon/asset inventory plus what a native shell additionally needs (the deferred iOS splash matrix and store icon sizes), the authentication and session rules a packaged client must preserve, the backend-financial-authority rule (no client calculation, no offline write), workspace-isolation requirements for any client-side cache, capture and upload constraints (file types, 10 MB, no client-side image processing), and an explicit Phase 16 deferral list
- [ ] T066 [US6] Verify `docs/mobile/app-store-readiness.md` against the Phase 16 goals and exit criteria in `docs/implementation-plan.md`, confirming each prerequisite is recorded as satisfied or deferred and that the document proposes zero new endpoint, request/response change, schema change, or native artefact (SC-013)

**Checkpoint**: Phase 16 has a complete readiness record.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, regression gates, and the manual sweep.

- [ ] T067 Complete the manual sweep table in `specs/015-pwa-mobile-readiness/quickstart.md` on a real device in both locales: install and standalone launch (confirming the signed-in session resumes), branded launch appearance and icon, manual add-to-home-screen guidance on a no-prompt platform, physical camera capture and upload, safe areas in portrait and landscape, keyboard-open form usability, one-handed bottom-nav reach, cold launch while offline, switching interface language inside the installed app (interface and direction update with no reinstall required), and the SW-9 device storage inspection
- [ ] T068 Verify a bumped `CACHE_VERSION` deployment loads the new version on relaunch with prior-version caches removed and no screen broken by mixed assets, and that an uninstall-then-reinstall cycle shows no stale cached content, recording both results in `specs/015-pwa-mobile-readiness/quickstart.md` (SC-010)
- [ ] T069 **Known pre-existing failure**: `e2e/visual-regression.spec.ts` fails on the `record-mobile-card` snapshot (ar + en, `chromium` and `mobile-rtl`) with an identical pixel delta on a clean pre-Phase-15 tree — the committed Phase 14 baselines were captured in an environment whose font metrics wrap the Edit/Delete button labels differently. Diagnose this as an environment/baseline issue, **not** a Phase 15 regression, and do not run `--update-snapshots` on a developer machine whose rendering differs from CI. Re-run the existing Phase 14 Playwright suites (`apps/web/e2e/visual-regression.spec.ts`, `apps/web/e2e/accessibility.spec.ts`, and all pre-existing flow specs) and confirm they stay behaviour-green, updating only presentation-coupled assertions and screenshot baselines where the bottom navigation or offline banner legitimately changed the markup (FR-044, SC-012)
- [ ] T070 Run `npm run test:unit` in `apps/web` and confirm the full Vitest suite passes
- [ ] T071 Run the entire `pytest` suite in `apps/api` **unmodified** and confirm it passes, as the SC-011 gate proving no backend endpoint, schema, financial-calculation, or role-permission outcome changed
- [ ] T072 Confirm the phase diff touches no file under `apps/api/` or `supabase/`, and that no out-of-scope capability (native packaging, push notifications, background sync, offline writes, payments, dark mode, global search, export) was introduced (FR-038, FR-040)
- [ ] T073 Complete the post-phase comparison in the "Baseline Appendix" of `specs/015-pwa-mobile-readiness/quickstart.md` against the T001 baseline, confirming no significant regression in initial load or interaction responsiveness (FR-045, SC-014)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 must precede any behaviour change so the baseline is meaningful.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Foundational. Delivers the manifest, icons, and install affordance.
- **US2 (Phase 4)**: Depends on Foundational; the service worker (T024–T026) is most naturally landed alongside US1's manifest, but US2's connectivity and gating work is independently testable.
- **US4 (Phase 5)**: Depends on US2's service worker for T043/T044 (the cache-purge message) and on the connectivity provider for the offline isolation assertions.
- **US3 (Phase 6)**: Depends on Foundational; T053 (offline blocking) depends on US2's `useConnectivity`.
- **US5 (Phase 7)**: Depends on Foundational; independent of US1–US4 except that T059/T060 share `app-shell.tsx` with T035, and T064's orientation assertion extends the spec file created in T054.
- **US6 (Phase 8)**: Depends on US1–US5 having been verified, since the document records actual findings.
- **Polish (Phase 9)**: Depends on all desired stories being complete.

### Within Each User Story

- Tests are written before the implementation they cover and must fail first.
- Contract-level tasks precede the components that satisfy them.
- Shared primitives (`app-shell.tsx`, `file-upload.tsx`) are edited by one story at a time to avoid conflicts.

### Parallel Opportunities

- T003 and T004 run in parallel in Setup.
- All `[P]`-marked test tasks within a story run in parallel (different files).
- T011 (icon assets) runs in parallel with T014 (install detection) — different files.
- T027 (offline route), T033 (offline banner), and T034 (stale-data notice) are independent files and run in parallel.
- US3 (Phase 6) and US5 (Phase 7) can proceed in parallel with different developers once US2's connectivity provider exists, apart from the shared `app-shell.tsx` edits.

### Sequential Constraints (do not parallelise)

- T024 → T025 → T044: all edit `apps/web/public/sw.js`.
- T030 → T031 → T032: all edit `apps/web/components/providers.tsx`.
- T035 → T059 → T060 → T061: all edit `apps/web/components/ui/app-shell.tsx`.
- T048 → T049: both edit `apps/web/components/ui/file-upload.tsx`.
- T050 → T051 → T052 → T053: all edit `apps/web/components/files/FileUpload.tsx`.
- T054 → T055 → T064: all edit `apps/web/e2e/mobile-navigation.spec.ts`.

---

## Parallel Example: User Story 2

```bash
# Launch the independent US2 test files together:
Task: "Connectivity state machine Vitest specs in apps/web/lib/connectivity/__tests__/connectivity.test.ts"
Task: "Offline banner and stale-data notice Vitest specs in apps/web/components/ui/__tests__/"

# Launch the independent US2 implementation files together:
Task: "Offline fallback route in apps/web/app/[locale]/offline/page.tsx"
Task: "Offline banner in apps/web/components/ui/offline-banner.tsx"
Task: "Stale-data notice in apps/web/components/ui/stale-data-notice.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: install on a real device, launch standalone, confirm branding and direction
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → plumbing ready
2. US1 → installable app (MVP)
3. US2 → safe offline and reconnect **(highest risk — do not defer past this point)**
4. US4 → verified isolation
5. US3 → mobile capture
6. US5 → mobile interaction polish
7. US6 → readiness documentation
8. Phase 9 → regression gates and manual sweep

### Critical Ordering Note

US2's service worker (T024) carries the cache **denylist** that makes the
phase's financial-safety and privacy guarantees structurally true. It ships
together with its verification task (T021) — the allowlist must never be
implemented without the test that proves API responses are absent from Cache
Storage.

---

## Notes

- `[P]` = different files, no dependencies.
- `[Story]` labels map every task to a spec user story for traceability.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- `apps/api/` and `supabase/` are frozen for this phase; the backend suite is run unmodified as the regression gate (T071).

**Total tasks**: 73
