# App-store readiness record

This record prepares the Phase 16 mobile-client work without changing the
current web API, schemas, backend calculations, or security model.

## Verified web baseline

- The web client has a manifest, production-only service worker, standalone
  display configuration, branded theme/background colours, and PNG icons for
  192px, 512px, maskable 512px, and Apple touch use.
- The installed experience keeps Arabic RTL and English LTR routing; the
  manifest identity is intentionally shared across locales.
- The shell cache is allowlist-only. API, Supabase, authenticated requests,
  receipt content, credentials, and workspace data are never persisted by the
  service worker. Offline reads are in-memory and session-scoped only.
- Camera capture uses the platform file input (`capture="environment"`) beside
  the picker; accepted files remain PNG, JPEG, WebP, or PDF up to 10 MB. No
  client image processing is performed.
- All eight core mobile tasks (view balance, add expense, add income, upload
  a receipt, review an AI extraction, switch workspace, filter records via
  Reports, open Settings) complete on a mobile viewport in both locales
  (SC-006), covering the financial, upload, AI-review, report, and settings
  flows Phase 16 must carry forward.

**Platforms checked**: automated/emulated only — Playwright's mobile device
profile (Pixel 7, both `en-US` and `ar-SA` locales) plus desktop Chromium.
No physical Android or iOS device has been checked yet; that is the Phase 9
manual sweep (`quickstart.md`'s Manual sweep record, T067), which had not
been run as of this document.

## Native-shell requirements to preserve

- Reuse the existing FastAPI API, Supabase authentication, tenant isolation,
  private file access, and workspace role enforcement. Never bypass RLS.
- Keep all financial totals backend-authoritative. A native client must not
  calculate authoritative balances or create offline writes, queued writes, or
  automatic mutation retries.
- Preserve session expiry handling: clear in-memory workspace state before
  returning to sign-in. Clear state on workspace switch and sign-out.
- Treat AI as optional, keep provider keys out of the client, and preserve
  review-before-confirmation for extraction results.
- Any client-side cache a native shell adds must stay isolated per workspace
  and per signed-in user: evict prior-workspace data on switch, clear all
  cached data on sign-out and on session expiry, and never let a second user
  on the same device read a previous user's cached records (FR-023, FR-024,
  FR-029). This mirrors the web client's existing in-memory-only, allowlisted
  cache — a native shell must not widen it into a persistent, cross-session,
  or cross-workspace store.

## Asset inventory and deferrals

The current web assets are `icon-192.png`, `icon-512.png`,
`icon-512-maskable.png`, and `apple-touch-icon.png`. A native shell still
needs platform-specific adaptive-icon assets, the App Store/Play Store
listing icon sizes, and the iOS launch-screen (splash) image matrix — none
of which exist today. Both the full iOS startup-image matrix and the store
icon-size set are deliberately deferred to Phase 16.

## Phase 16 deferral list

- Native Android/iOS project choice, store signing, and store submissions.
- Store-specific accessibility, device, security, and purchase-policy review.
- Native push notifications, background sync, and periodic refresh.
- Any API, request/response, schema, RLS, or financial-rule change.

This document proposes no backend endpoint, request/response change, schema
change, or native artifact. It records constraints that Phase 16 must retain.
