# Phase 0 Research: Free Mobile Application

All decisions below resolve the Technical Context choices for packaging the
existing web experience as free Android and iOS applications. Every decision is
constrained by the constitution: reuse the authoritative FastAPI backend and
Supabase security model, keep financial calculations backend-authoritative, keep
the product free, and preserve workspace isolation and privacy.

## R-001 — Mobile-client technology: Capacitor wrapper (not native rewrite, not remote-URL viewer)

- **Decision**: Use **Capacitor** to wrap a locally-bundled build of the existing
  `apps/web` UI into per-platform native apps that call the same remote FastAPI
  backend and Supabase. The web assets are bundled **locally** in the app; the
  native surface is limited to camera capture, secure storage, deep links, and
  safe-area/status-bar handling.
- **Rationale**: Phase 15 deliberately built the installable PWA as "the
  validated base experience" for Phase 16. Capacitor reuses that UI verbatim,
  reimplements no financial or business logic, is cross-platform from one web
  codebase, and exposes exactly the native plugins this phase needs. A native
  rewrite (Swift/Kotlin) or a cross-platform native UI (React Native/Flutter)
  would discard Phase 15 and contradict the constitution's "mobile delivery MUST
  reuse the authoritative backend" and "reuse the web experience" intent, at far
  higher cost and risk. A pure remote-URL WebView viewer is rejected because it
  fails offline shell rendering and is the classic Apple Guideline 4.2 rejection.
- **Alternatives considered**: React Native / Expo (full native UI rewrite —
  rejected, discards the web UI and doubles the surface); Flutter (same);
  Trusted Web Activity / bare `WKWebView` remote loader (rejected — remote-URL
  viewer, 4.2 risk, no local shell); PWA-only with no store presence (rejected —
  the phase goal is store distribution).

## R-002 — Local web bundle vs. Next.js SSR/middleware (the central build tension)

- **Decision**: Ship a **client-rendered local bundle** of the existing UI that
  Capacitor packages as `webDir` and that talks to the remote backend and
  Supabase directly from the client. The app does **not** run a Next.js server on
  device and does **not** load a remote URL for its shell. The exact build
  mechanism — a Capacitor-targeted client build of the current App-Router UI with
  client-side routing, versus a supported static-export path — is pinned during
  implementation; either way, **no financial or business logic is reimplemented**
  and the same React components/`components/ui` primitives are reused.
- **Rationale**: `apps/web` currently uses `middleware.ts` locale routing and
  `@supabase/ssr`, which a naive `output: 'export'` cannot reproduce. The app is
  already largely client-driven (react-query, `@supabase/supabase-js`), so a
  client-rendered bundle that resolves locale and auth on the client is the
  lowest-risk way to obtain a self-contained local shell. This keeps the offline
  shell (Phase 15) working and satisfies store minimum-functionality review.
- **Alternatives considered**: Bundling a Node/Next server in the app (rejected —
  heavy, unnecessary, not how Capacitor works); pointing `server.url` at
  production (rejected — remote-URL viewer, see R-001); forking a separate native
  UI (rejected — violates reuse).
- **Residual**: The precise client-build wiring is verified at implementation
  time against the then-current Next.js/Capacitor versions; it is a build-config
  decision, not a scope or contract decision, so it does not gate the spec.

## R-003 — Supabase authentication in a native context + deep-link return

- **Decision**: Reuse Supabase authentication with **exactly the sign-in methods
  already enabled on the web** (email/password plus any already-configured
  provider). Email/password authenticates directly via `@supabase/supabase-js`.
  Provider (OAuth) sign-in opens the platform's **secure in-app browser /
  authentication session** and returns to the app through a **registered deep
  link** (custom scheme and/or platform app link), which completes the Supabase
  session. The redirect target is added to Supabase's allowed redirect list —
  **additive auth configuration, not a financial API contract change**.
- **Rationale**: This is the standard, supported Supabase-on-Capacitor pattern.
  It introduces no new provider and no parallel auth system (FR-006), keeps the
  backend unchanged, and confines the new surface to redirect configuration.
- **Alternatives considered**: Embedding OAuth in a plain in-app WebView
  (rejected — insecure, and disallowed by major providers); adding a custom
  backend auth endpoint (rejected — FR-037 forbids new backend surface).

## R-004 — On-device session storage: platform secure store only

- **Decision**: Persist the Supabase session (access/refresh tokens) **only** in
  the platform secure store (iOS Keychain / Android Keystore-backed secure
  storage) via a secure-storage plugin, replacing the browser's default
  localStorage persistence when running inside Capacitor. Workspace/financial
  data is never persisted; it stays in the in-memory react-query cache for the
  session, exactly as on the web (Phase 15). No AI provider key, vault value, or
  internal identifier is ever stored on device or exposed to the client.
- **Rationale**: A native app introduces persistent token storage for the first
  time; the constitution (Principle VI) forbids exposing keys/tokens and requires
  privacy. Secure storage is the platform-blessed location; keeping everything
  else in memory makes sign-out/switch clearing structurally true.
- **Alternatives considered**: Default WebView localStorage (rejected — not
  hardware-backed, readable in some scenarios); encrypting a custom file
  (rejected — reinvents the keychain, more risk).

## R-005 — Camera capture and file upload

- **Decision**: Use a Capacitor camera plugin for native capture and the existing
  file picker for gallery/PDF selection, both feeding the **existing** upload
  path with **unchanged** Phase 6 validation (10 MB; PNG/JPEG/WebP/PDF). Where
  the web `capture` affordance (Phase 15) already works inside the WebView, it is
  reused; the native plugin is used where it provides a better/permitted capture
  experience. No client-side image processing is introduced.
- **Rationale**: Reliable capture is a named exit criterion and a store
  minimum-functionality signal. Reusing existing validation and upload keeps the
  backend and file rules untouched (FR-019).
- **Alternatives considered**: A custom native camera UI (rejected — unnecessary
  scope); client-side compression/OCR (rejected — out of scope, backend/AI owns
  extraction).

## R-006 — Offline behaviour: reuse the Phase 15 read-only model

- **Decision**: Carry the Phase 15 offline model into the native shell unchanged:
  a rendered local shell with a clear offline indicator, read-only in-memory data
  for the current session/workspace, **no** offline writes, **no** queued/replayed
  mutations, and **no** automatic retry of mutating requests. Connectivity is
  derived from real request outcomes plus platform signals.
- **Rationale**: The constitution's financial-accuracy rule (Principle X) is the
  highest risk; the Phase 15 model already makes "no incorrect totals / no
  duplicates" structurally true. Reusing it avoids reopening a solved problem.
- **Alternatives considered**: Native offline write queue / background sync
  (rejected — explicitly out of scope, FR-038, and a financial-safety hazard).

## R-007 — Free distribution, no in-app purchase, and update strategy

- **Decision**: Distribute both apps **free** on Google Play and the App Store,
  using a store-managed staged/test track before public release. **No** in-app
  purchase, subscription, or paid tier is included; support purchases and all
  billing are deferred to Phase 17. Users are kept current via the **stores'
  native update mechanisms**; **no** backend version-gate endpoint is added.
- **Rationale**: Principle XIII requires the complete product to stay free.
  Store-native updates satisfy "keep users current" without new backend surface
  (FR-005, FR-037).
- **Alternatives considered**: Custom min-version check endpoint (rejected —
  FR-037); over-the-air web-bundle hot updates (rejected for MVP — added
  complexity and store-policy nuance; store updates suffice).

## R-008 — Store readiness: minimum functionality, privacy, and accounts

- **Decision**: Prepare complete, truthful store listings and metadata in Arabic
  and English, accurate privacy-policy and data-safety declarations reflecting
  what the app stores on device (secure session only) and transmits (to the
  existing backend/Supabase), reviewer sign-in guidance, and evidence of native
  functionality (camera, secure storage, local shell) for Apple Guideline 4.2 /
  Google Play policy. Publishing depends on an **Apple Developer Program**
  membership and a **Google Play developer account** — organizational
  prerequisites, not a user-facing charge.
- **Rationale**: Store approval is the release gate and an explicit phase goal;
  4.2 rejection is the biggest approval risk and is mitigated by genuine native
  integration, not by adding out-of-scope features.
- **Alternatives considered**: Shipping a bare wrapper and hoping to pass review
  (rejected — high 4.2 rejection risk); adding features to look "more native"
  (rejected — scope creep, Principle XV).

## R-009 — Native testing strategy

- **Decision**: Reuse the existing Vitest + Playwright web suites unchanged as the
  behavioural/financial/RTL-LTR regression gate over the bundled UI; add a native
  smoke/e2e layer (Appium or platform UI-test tooling, finalised at
  implementation) for install-launch, sign-in + deep-link return, session
  persistence across restart, secure-storage inspection, camera capture, and
  offline behaviour on at least one Android and one iOS device/emulator; and keep
  a documented **manual sweep** for store test-track install, physical camera,
  screen-reader labels, and a store-review dry run. Re-run the full backend
  `pytest` suite unmodified.
- **Rationale**: Most behaviour is already covered by the web suites since the UI
  is reused; only the native surface and store gates need new coverage, and some
  device-bound criteria cannot be automated (mirrors the Phase 14/15 manual-sweep
  pattern).
- **Alternatives considered**: Re-authoring all UI tests natively (rejected —
  wasteful duplication); skipping native e2e entirely (rejected — the new native
  surface would go unverified, violating Principle XIV).

## Summary of resolved unknowns

| Topic | Decision |
|---|---|
| Mobile-client technology | Capacitor wrapper reusing `apps/web` + remote backend (R-001) |
| Local bundle vs SSR | Client-rendered local bundle; no on-device server, no remote-URL shell (R-002) |
| Authentication | Reuse Supabase; existing methods only; provider via secure session + deep link (R-003) |
| Session storage | Platform secure store only; data in memory only (R-004) |
| Capture/upload | Native camera + existing picker → existing upload, unchanged validation (R-005) |
| Offline | Reuse Phase 15 read-only model; no offline writes (R-006) |
| Distribution / updates | Free, staged store release; store-native updates; no version-gate endpoint (R-007) |
| Store readiness | Truthful listings, privacy/data-safety, reviewer guide, native-functionality evidence (R-008) |
| Testing | Reuse web suites + native smoke/e2e + manual sweep; backend suite unmodified (R-009) |

No `NEEDS CLARIFICATION` markers remain.
