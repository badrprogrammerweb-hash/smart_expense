# Quickstart & Validation Guide: Progressive Web App and Mobile Readiness

A run/validation guide proving Phase 15 works end-to-end. Implementation detail
lives in `tasks.md`; behavioural rules live in `contracts/` and `data-model.md`.

## Prerequisites

- Repo checked out on branch `015-pwa-mobile-readiness`.
- Local stack per existing project docs: Supabase local stack running,
  `apps/api` reachable, `apps/web` env configured (same as Phases 12–14).
- Node/npm installed; `apps/web` dependencies installed (`npm install` in
  `apps/web`). **No new dependency is added by this phase.**
- Playwright browsers installed (`npx playwright install`).
- For the manual sweep: at least one physical mobile device (or a device
  emulator with a working camera) able to reach the dev/staging origin, plus a
  **secure origin** — installation and service-worker registration require
  HTTPS or `localhost`.

## Run the app

The service worker registers in **production builds only**, so PWA behaviour
must be validated against a production build, not `next dev`:

```bash
cd apps/web

# PWA behaviour (service worker active) — use this for Phase 15 validation
npm run build && npm run start
# open http://localhost:3000/ar/...  (Arabic RTL, default)
# open http://localhost:3000/en/...  (English LTR)

# Ordinary development (no service worker)
npm run dev
```

To reach the dev server from a phone on the same network, expose it over a
secure tunnel (any HTTPS tunnel works) — installation will not be offered over
plain HTTP to a LAN IP.

## Manual validation scenarios

Each maps to spec user stories / success criteria.

1. **Install and launch (US1, SC-001)**: On a supported mobile browser, visit
   the app over a secure origin. Confirm the install affordance appears as a
   dismissible in-page banner (not a modal). Install, then launch from the home
   screen: standalone window with no address bar, correct icon and name,
   branded launch appearance, correct reading direction, and the signed-in
   session resumed. Revisit in a browser tab and confirm the banner is gone.
   Dismiss the banner in a fresh session and confirm the Settings install entry
   still works. Repeat in the other locale.
2. **Offline safety (US2, SC-002/003/004)**: With the app open, disable the
   network. Confirm the shell renders with a persistent offline indicator (not
   a browser error page), and that visible workspace data is labelled as cached
   with a last-updated time. Attempt every mutating action — add/edit/delete
   income and expense, upload a file, delete a file, trigger/confirm/discard an
   extraction, change settings, save an AI key — and confirm each is disabled
   with an explanation. Re-enable the network: the indicator clears, data
   refreshes, and actions re-enable without a manual reload. Then submit a
   record and kill the network mid-submission; on reconnect confirm the outcome
   is reported as indeterminate, the list refreshes, and exactly one (or zero)
   record exists — never two. Finally compare dashboard and report totals
   against the backend for the same period.
3. **Cold launch offline (US2 edge case)**: Fully close the installed app,
   disable the network, and launch it. Confirm the shell renders an offline
   state rather than a broken page or stale data.
4. **Mobile capture (US3, SC-005)**: On a phone, open the receipt upload flow.
   Confirm both a capture control and a file picker are offered. Take a photo:
   confirm the preview shows name and size and can be replaced or removed.
   Upload: confirm progress with a label and a disabled confirm control.
   Confirm the file appears against the correct workspace. Cancel a capture and
   confirm nothing is staged. Capture a full-resolution photo above 10 MB and
   confirm the existing size error appears before any upload. Induce a failure,
   retry once, and confirm exactly one stored file.
5. **Cache isolation (US4, SC-008/009)**: Load data in Workspace A, switch to
   Workspace B, and confirm no Workspace A record, total, file, or summary
   appears — including with the network off. Sign out and confirm cached
   workspace content is gone (back-navigate and relaunch to check). Sign in as
   a different user and confirm no prior user data anywhere. Then open browser
   devtools and inspect **Cache Storage, IndexedDB, localStorage, and
   sessionStorage**: there must be no financial record, receipt content, API
   key, access token, or vault value (contract SW-9).
6. **Mobile navigation and touch (US5, SC-006/007)**: On a phone in both
   locales, confirm the bottom navigation shows role-permitted destinations
   with a "more" entry opening the drawer, the active destination is indicated,
   ordering and drawer side mirror correctly in Arabic, and content is not
   occluded by the bar. Rotate to landscape and confirm safe areas are
   respected and in-progress form input survives. Open a form, focus a field,
   and confirm the focused field and the submit action stay visible with the
   keyboard open. Complete all eight core tasks (view balance, add expense, add
   income, upload receipt, review extraction, switch workspace, filter records,
   open settings).
7. **Version update (US4, SC-010)**: Deploy/rebuild with a bumped
   `CACHE_VERSION`, relaunch the installed app, and confirm the new version
   loads and prior-version caches are gone, with no screen broken by mixed
   assets.
8. **Readiness doc (US6, SC-013)**: Review `docs/mobile/app-store-readiness.md`
   against the Phase 16 goals in `docs/implementation-plan.md` — every
   prerequisite is either recorded as satisfied or explicitly deferred, and the
   document proposes no API or schema change.

### Manual sweep record

To be completed during implementation and recorded here, mirroring the Phase 14
pattern.

| Check | Device / platform | English LTR | Arabic RTL |
|---|---|---:|---:|
| Install + standalone launch | | [ ] | [ ] |
| Branded launch appearance + icon | | [ ] | [ ] |
| Manual add-to-home-screen guidance (no-prompt platform) | | [ ] | [ ] |
| Physical camera capture + upload | | [ ] | [ ] |
| Safe areas, portrait | | [ ] | [ ] |
| Safe areas, landscape | | [ ] | [ ] |
| Keyboard-open form usability | | [ ] | [ ] |
| One-handed bottom-nav reach | | [ ] | [ ] |
| Cold launch while offline | | [ ] | [ ] |
| Device storage inspection (SW-9) | | [ ] | [ ] |

## Automated validation

```bash
cd apps/web

# Unit/component (Vitest + RTL): new primitives, hooks, and changed components
npm run test:unit

# End-to-end (Playwright)
npm run test:e2e                                  # all projects
npx playwright test --project=chromium            # desktop
npx playwright test --project=mobile-rtl          # mobile Arabic RTL
npx playwright test --project=mobile-ltr          # mobile English LTR (new this phase)

npx playwright test e2e/pwa-installability.spec.ts
npx playwright test e2e/offline-behavior.spec.ts
npx playwright test e2e/cache-isolation.spec.ts
npx playwright test e2e/mobile-capture.spec.ts
npx playwright test e2e/mobile-navigation.spec.ts

# Phase 14 suites must stay green (screenshot baselines may need updating
# where the bottom nav or offline banner legitimately changes the markup):
npx playwright test e2e/visual-regression.spec.ts
npx playwright test e2e/accessibility.spec.ts
npx playwright test e2e/visual-regression.spec.ts --update-snapshots
```

### Backend regression gate (frozen — run unmodified)

```bash
cd apps/api
pytest            # entire suite must pass as-is (SC-011)
```

## Expected outcomes (Definition of Done for validation)

- Manifest and icons validate; the install affordance behaves correctly in all
  four capability states; a real device install and standalone launch is
  confirmed in the manual sweep (SC-001).
- Every mutating action is blocked with an explanation while offline; no queued
  write exists in any storage mechanism (SC-002).
- Interrupted submissions always yield exactly zero or one record (SC-003), and
  post-reconnect totals equal the backend's (SC-004).
- Camera capture and picker both work; retry after failure yields exactly one
  stored file (SC-005).
- All eight core tasks complete on a phone viewport in both locales (SC-006);
  touch targets ≥ 44×44px with no safe-area occlusion (SC-007).
- No cross-workspace or cross-user data after switch, sign-out, or second
  sign-in (SC-008); device storage inspection is clean (SC-009).
- A bumped cache version loads cleanly on relaunch (SC-010).
- Backend `pytest` passes **unmodified** (SC-011); existing frontend suites stay
  behaviour-green (SC-012).
- The readiness document is complete and proposes no contract change (SC-013).
- No significant load/interaction regression versus the pre-phase baseline
  (SC-014).
- No `apps/api` or `supabase/` source changed (frontend-only diff).

## Baseline Appendix

### Pre-phase baseline (to be captured at implementation start)

Captured before the first Phase 15 implementation change on 2026-07-23:

- **Cold desktop dashboard load feel**: the existing Chromium responsive
  workflow completed successfully against the desktop dashboard. Initial load
  reached the dashboard and key workflows without a visible responsiveness
  issue (the automated run does not provide a numeric performance budget).
- **Mobile-viewport load feel**: the same pre-change responsive workflow
  covers the 390x844 mobile viewport in both Arabic and English and completed
  without a visible responsiveness issue.
- **Installability**: not installable. Before this phase, the source tree has
  neither `app/manifest.ts` nor `public/sw.js`, so no manifest or service
  worker is available to make an install offer.
- **Cache Storage**: empty by design. With no service worker or cache-writing
  code, the application has no Cache Storage writer. The in-app browser surface
  was unavailable for a separate DevTools enumeration in this environment.

The baseline criteria below are retained for the phase-end comparison:

- Dashboard initial load feel on a cold (uncached) desktop load.
- Dashboard initial load feel on a mobile viewport.
- Whether the browser currently reports the app as installable (expected: no —
  there is no manifest or service worker prior to this phase).
- Current Cache Storage contents (expected: empty — no service worker exists).

### Post-phase comparison (to be completed at phase end)

- **Method and limit**: repeated the pre-phase responsive workflow against a
  fresh production build (`npm run build && npm run start`, launched by the
  Playwright web-server fixture) on 2026-07-24. The pre-phase entry was a
  qualitative load-feel baseline, not a timed performance benchmark, so the
  check below is a like-for-like responsiveness regression gate rather than a
  numeric speed comparison. It does not replace the physical-device checks
  still pending in T067–T068.
- **Desktop and mobile load/interaction**: `e2e/refresh-responsive.spec.ts`
  passed in Chromium and mobile RTL. It completed the Arabic/English phone,
  tablet, and desktop viewport matrix, including dashboard reachability,
  expense/income entry, files, AI-review, reports filters, and workspace
  switching, with no timeout or observed responsiveness regression. The
  measured test durations (30.9 s desktop and 39.9 s mobile RTL) include
  account/workspace seeding and are therefore not page-load timings.
- **Installability and repeat-visit prerequisites**:
  `e2e/pwa-installability.spec.ts` passed in Chromium, mobile RTL, and mobile
  LTR. It verified the manifest, icon assets, accessible metadata, standalone
  suppression, and a persistent Settings install entry after banner dismissal.
  The service-worker shell is intentionally cacheable, so repeat loads are
  expected to improve; this headless run does not make a real-device claim.
- **Storage/cache safety**: `e2e/cache-isolation.spec.ts` passed in all three
  projects, including its persistent-browser-storage check: no financial data
  or secrets were found after workspace switching, sign-out/another-user, or
  offline transitions.
- **Conclusion**: within the same automated harness used for the qualitative
  baseline, no significant initial-load or interaction-responsiveness
  regression was observed (FR-045, SC-014).
