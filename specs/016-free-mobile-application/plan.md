# Implementation Plan: Free Mobile Application

**Branch**: `016-free-mobile-application` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/016-free-mobile-application/spec.md`

## Summary

Phase 16 packages the validated, installable web experience (Phase 15) into
**free native applications for Android and iOS**, distributed through the Google
Play Store and the Apple App Store. It reuses the existing `apps/web` frontend,
the authoritative `apps/api` FastAPI backend, and Supabase authentication — no
financial or business logic is reimplemented client-side, and no financial API
contract, database schema, or role-permission rule changes.

The chosen mobile-client technology is **Capacitor**: a thin native shell per
platform that bundles a build of the existing web UI as **local assets** (not a
pure remote-URL viewer), talks to the same **remote** FastAPI backend and
Supabase for all data, and adds a small, genuine native integration surface —
device camera capture, secure session storage (iOS Keychain / Android
Keystore-backed), and deep-link return for provider (OAuth) sign-in. This
technology choice is the one this whole plan hangs on and is approved here per
the constitution's Technology Constraints ("any additional mobile-client
technology MUST be approved through its own specification and technical plan").

Five workstreams:

1. **Native shell & local bundle** (US1 foundation) — a Capacitor project under
   `apps/mobile/` wrapping a locally-bundled build of `apps/web`, with app
   identity (name, icons, splash), standalone launch, and the Android/iOS native
   projects.
2. **Authentication in a native context** (US1) — Supabase email/password plus
   the already-enabled provider(s), with provider sign-in using the platform
   secure browser session and returning through a registered deep link; the
   session persisted only in platform secure storage.
3. **Core flows over the remote backend** (US2, US3) — dashboard, income/expense
   CRUD per role, history/filtering, categories, reports, settings, receipt
   capture/upload, and AI review — all reusing the existing endpoints, with the
   backend remaining the sole financial authority.
4. **On-device security, privacy & isolation** (US4) — secure token storage,
   per-user/per-workspace cache scoping, sign-out and workspace-switch clearing,
   expired-session handling, and the Phase 15 read-only offline model preserved.
5. **Localization, accessibility & store readiness** (US5, US6) — Arabic RTL /
   English LTR including native chrome, dynamic type and screen-reader support,
   safe areas, and the store-submission package (listings, privacy/data-safety
   declarations, reviewer guidance, and a reproducible release process).

The central safety move is that **the mobile app is a presentation shell only**:
it reuses `apps/web`'s existing display-only posture and the same remote backend,
so "financial calculations remain backend-authoritative", "no offline writes",
and "no cross-workspace leakage" stay structurally true. The one genuinely new
surface — on-device session storage — is confined to the platform secure store
and cleared on sign-out, mirroring the Phase 15 isolation rules.

## Technical Context

**Language/Version**: TypeScript 5.7 on the existing Next.js 16.2.9 / React
18.3 `apps/web` UI (reused as the bundled web layer). Native shell via Capacitor
(current major line, pinned at implementation) generating a Swift/Xcode iOS
project and a Kotlin/Gradle Android project — both thin wrappers, **no** native
UI or business logic authored by hand beyond configuration, plugin wiring, and
platform bootstrap. No change to `apps/api` (Python/FastAPI) source and no change
to `supabase/` migrations, RLS policies, or storage policies.

**Primary Dependencies**: Reuses the entire `apps/web` dependency set (Tailwind
v4, `components/ui/` primitives, `next-intl`, `@tanstack/react-query`,
`react-hook-form` + `zod`, `@supabase/supabase-js`, the Phase 15 manifest /
service worker / icons). New **mobile-only** dependencies live under
`apps/mobile/` and do not touch the web bundle: Capacitor core + iOS + Android
platforms, and official/community plugins for camera capture, secure storage
(Keychain/Keystore-backed), deep links / app links, and status-bar / safe-area
handling. Exact plugin set and versions are pinned in
[research.md](./research.md).

**Storage**: N/A server-side (unchanged). On device: the authenticated Supabase
session lives **only** in the platform secure store (Keychain / Keystore-backed
secure storage); the app's local bundle (HTML/CSS/JS/icons/splash) is packaged
read-only in the app; workspace/financial data is fetched from the remote
backend per session and held **in memory only** (react-query), never written to
persistent device storage — exactly the Phase 15 rule carried into the native
shell.

**Testing**: Reuse the existing Vitest + Playwright web suites unchanged as the
behavioural/financial regression gate (they exercise the bundled UI). Add
**mobile-specific** verification: a native smoke/e2e layer (Appium or the
platform's UI-test tooling, selected in research) for install-launch, sign-in
incl. deep-link return, session persistence across restart, secure-storage
inspection, camera capture, and offline behaviour on at least one Android and
one iOS device/emulator; plus a **documented manual sweep** for what cannot be
automated (real store test-track install, physical camera, screen-reader
labels, store-review dry run). The full backend `pytest` suite is re-run
unmodified (SC-012).

**Target Platform**: Android and iOS as free store apps, plus the unchanged web
deployment (the bundled UI is the same codebase). OS baseline: target **iOS 15+**
and **Android 8 / API 26+**, exact floors confirmed against current store and
toolchain requirements at implementation time. Both `ar` (RTL) and `en` (LTR).
Light mode only (consistent with Phase 14/15).

**Project Type**: Mobile + existing web/API monolith. This phase adds one new
app boundary — `apps/mobile/` (Capacitor project with generated `ios/` and
`android/` native projects) — and new `docs/mobile/` release/store artifacts. It
**reuses** `apps/web` and does not modify `apps/api` or `supabase`.

**Performance Goals**: No absolute SLA. Soft guardrail (FR-042): no significant
regression in the shared web experience's load/interaction responsiveness versus
the pre-phase baseline, and native launch to interactive within a reasonable
mobile expectation (measured, not gated). The local bundle should make cold
launch independent of network for the shell.

**Constraints**: Frozen financial contracts — no change to API request/response
shapes, DB schema, financial rules, confirmed-only totals, role permissions,
auth rules, AI provider behaviour, file-storage rules, history append-only
behaviour, or workspace isolation (FR-036, FR-037; Constitution VI/VII/IX/X). No
new backend endpoint of any kind, including no version-gate endpoint (FR-005,
FR-037). Free product — no paid tier, subscription, or in-app purchase (FR-003;
Constitution XIII); billing deferred to Phase 17. No push notifications, no
background sync, no offline financial writes (FR-038). The native shell bundles
the web UI locally rather than acting as a pure remote-URL viewer (FR-001) to
satisfy offline shell rendering and store minimum-functionality review. Existing
Phase 6 file validation (10 MB; PNG/JPEG/WebP/PDF) applies unchanged.

**Scale/Scope**: One new `apps/mobile/` Capacitor project (config, local shell
assets, generated `ios/` and `android/` native projects, native plugin wiring
for camera / secure storage / deep links / safe area), a small set of
mobile-only source files (native bootstrap, secure-session adapter, deep-link
handler, platform capability shims that the bundled web layer calls through
Capacitor), the platform icon/splash asset matrices, native e2e/smoke specs, and
new `docs/mobile/` documents (store listings ×2 locales, privacy/data-safety
mapping, reviewer guidance, release/signing/rollout runbook). Changes to
`apps/web` are limited to **additive capability shims** (detect Capacitor
runtime; route camera, secure storage, and deep-link handling to native plugins
when present, falling back to the existing web behaviour otherwise) — no change
to financial logic, endpoints, or display-only posture. No new persisted
server-side entities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **Principle I / III / XV (scope & scope control)**: Packaging the existing MVP
  as free store apps is a delivery-surface change, not a new domain. No banking,
  accounting, payments, payroll, tax, or enterprise workflow is added; FR-038
  fences out payments/IAP, push, and background sync. **Pass.**
- **Principle II (budgeting philosophy)**: Remaining balance stays
  `confirmed income − confirmed expenses`, computed by the backend and only
  displayed by the app (FR-012, FR-013). **Pass.**
- **Principle IV (Saudi-first defaults)**: Arabic-first RTL remains default;
  every screen and native chrome ships in both locales with correct mirroring
  (FR-027, FR-030). **Pass.**
- **Principle V (manual-first, AI-optional)**: AI review reuses existing
  BYOK/extraction behaviour; the app is fully usable without AI (FR-021). **Pass.**
- **Principle VI (privacy & security — a primary risk of this phase)**: The one
  new on-device surface is the session token, confined to the platform secure
  store; no API key, vault value, token beyond the secure session, or internal
  identifier is written to plain storage or exposed to the client (FR-008,
  FR-022). Sign-out, workspace switch, and expired sessions each clear their
  surface (FR-009, FR-010, FR-023). Bound by
  `contracts/on-device-security.md`. **Pass.**
- **Principle VII (workspace isolation)**: Cached workspace data stays in memory,
  scoped to one user/workspace, discarded on switch and sign-out; no scoping
  decision moves to the client (FR-023, FR-024). **Pass.**
- **Principle IX (architecture authority)**: The mobile app is display-only; it
  reimplements no calculation or permission and adds no local authority
  (FR-012, FR-014). **Pass.**
- **Principle X (financial accuracy — NON-NEGOTIABLE)**: No offline write path
  (FR-026, reused Phase 15 model); totals shown equal backend values with zero
  discrepancy (FR-015, SC-004); verified by the unmodified backend suite
  (SC-012). **Pass.**
- **Principle XI (reports integrity)**: Reports stay backend-computed from
  confirmed records; only their container becomes a store app (FR-013). **Pass.**
- **Principle XIII (free product & optional support)**: The apps are free with
  no paid tier, subscription, or in-app purchase; support purchases are
  explicitly deferred to Phase 17 (FR-003, FR-038). Developer-account
  memberships are an organizational dependency, not a user-facing charge.
  **Pass.**
- **Principle XIV (testing requirements)**: Adds mobile coverage for install,
  auth/deep-link, secure storage, isolation, capture/upload, AI review,
  RTL/LTR, accessibility, and offline behaviour on real/emulated devices, plus a
  documented manual sweep; keeps existing suites green and re-runs the backend
  suite unmodified (FR-040, FR-041, SC-012, SC-013). **Pass.**
- **Principle XVI (spec-kit workflow)**: This plan follows the clarified
  `spec.md`; implementation waits for `/speckit-tasks` and `/speckit-analyze`.
  **Pass.**

**Technology Constraints check (the decisive gate for this phase)**: The
constitution requires mobile delivery to reuse the authoritative FastAPI
backend, Supabase security model, workspace isolation, and financial rules, and
requires any additional mobile-client technology to be approved through its own
spec and plan. This plan approves **Capacitor** as that technology: it wraps the
same web UI, calls the same backend and Supabase, reimplements no financial
logic, and its native surface is limited to camera, secure storage, and deep
links. The reuse obligations from `docs/mobile/app-store-readiness.md` (Phase 15)
are carried forward verbatim. **Pass.**

No violations identified; **Complexity Tracking is not needed**.

*Post-Phase 1 re-check*: The design artifacts introduce no new persisted entity,
no backend surface, and no financial contract change; the security and offline
contracts strengthen the Principle VI/X positions rather than weakening them.
**Still passes.**

## Project Structure

### Documentation (this feature)

```text
specs/016-free-mobile-application/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output — resolved technology & packaging decisions
├── data-model.md        # Phase 1 output — client/native state model (no DB entities)
├── quickstart.md        # Phase 1 output — build/run/validate guide incl. manual sweep
├── contracts/           # Phase 1 output — behavioural contracts (not HTTP APIs)
│   ├── native-shell-packaging.md    # local-bundle rule, app identity, launch, update path
│   ├── auth-deeplink.md             # Supabase auth in native context + deep-link return
│   ├── on-device-security.md        # THE secure-storage & isolation rule (binding)
│   └── store-readiness.md           # store listing, privacy/data-safety, review criteria
├── checklists/
│   └── requirements.md  # spec quality checklist (/speckit-specify output)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

**Structure Decision**: Existing monolith with `apps/web` (Next.js) + `apps/api`
(FastAPI) + `supabase`. This phase adds **one new app boundary**, `apps/mobile/`
(the Capacitor project and its generated native projects), reuses `apps/web` as
the bundled UI, and makes only **additive capability shims** in `apps/web`.
`apps/api/` and `supabase/` are untouched and the backend suite is re-run
unmodified as the regression gate.

```text
apps/mobile/                             # NEW — Capacitor wrapper app boundary
├── capacitor.config.ts                  # NEW: app id/name, bundled webDir, deep-link scheme,
│                                        #   plugin config; points at a LOCAL web build (not a URL)
├── package.json                         # NEW: Capacitor CLI + platform + plugin deps (mobile-only)
├── scripts/
│   └── build-web-bundle.*               # NEW: produce the local web bundle from apps/web and copy in
├── src/
│   ├── native/secure-session.ts         # NEW: secure-store adapter (Keychain/Keystore) for the session
│   ├── native/deep-link.ts              # NEW: OAuth return / app-link routing into the web app
│   └── native/capabilities.ts           # NEW: camera + safe-area + status-bar bridges
├── resources/                           # NEW: source icon + splash used to generate platform matrices
├── ios/                                 # NEW: generated Xcode project (thin shell, signing config)
├── android/                             # NEW: generated Gradle project (thin shell, signing config)
└── e2e/                                 # NEW: native smoke/e2e (install, auth+deeplink, capture, offline)

apps/web/                                # REUSED — additive shims only, no financial/endpoint change
├── lib/platform/capacitor.ts            # NEW: detect Capacitor runtime; expose native bridges
├── lib/auth/session-store.ts            # extended: use native secure store when in Capacitor,
│                                        #   else existing web behaviour (no auth rule change)
├── components/files/FileUpload.tsx      # extended: route capture to native camera when available,
│                                        #   else existing web capture (Phase 15) — same validation
└── (all other web files unchanged; the same build is bundled into apps/mobile)

docs/mobile/
├── app-store-readiness.md               # REUSED — Phase 15 record, carried forward
├── store-listing.ar.md                  # NEW: Arabic store listing/metadata
├── store-listing.en.md                  # NEW: English store listing/metadata
├── privacy-data-safety.md               # NEW: privacy policy link + data-safety mapping
├── reviewer-guide.md                    # NEW: sign-in path for store reviewers
└── release-runbook.md                   # NEW: accounts, signing, versioning, staged rollout
```

## Implementation Strategy (dependency-ordered)

1. **Native shell & local bundle** (US1 foundation). Stand up `apps/mobile/`
   Capacitor project, the web-bundle build step, app identity, icons/splash, and
   standalone launch on both platforms. Nothing else can be exercised as an
   installed app until this lands.
2. **Auth in a native context** (US1). Wire Supabase email/password and the
   existing provider(s) with the platform secure browser session and deep-link
   return; persist the session in secure storage; restore across restart; clear
   on sign-out. Highest **technical** risk slice.
3. **Core flows + capture + AI review** (US2, US3). Verify dashboard, CRUD per
   role, history/filter, categories, reports, settings, native camera capture,
   upload, and extraction review — all against the remote backend, with totals
   matching web. Reuses Phase 6 validation and Phase 8 extraction behaviour.
4. **Security, privacy & isolation** (US4). Secure-storage inspection, per-user/
   per-workspace cache scoping, workspace-switch and sign-out clearing,
   expired-session-on-reconnect, and the preserved read-only offline model —
   each with a dedicated check. Highest **security** risk slice.
5. **Localization & accessibility** (US5). RTL/LTR incl. native chrome, dynamic
   type, screen-reader labels, safe areas, touch targets, both locales.
6. **Store readiness & release docs** (US6). Written/validated last so they
   record what was actually verified: listings, privacy/data-safety, reviewer
   guidance, and the reproducible release runbook.

Slices 1–4 are P1 and independently testable; slice 5 (P2) refines existing
localised layouts for native; slice 6 (P2) is the release gate.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| **Next.js SSR/middleware vs. a local static bundle** — `apps/web` uses `middleware.ts` locale routing and `@supabase/ssr`, which a naive static export cannot produce | Resolved as the #1 Phase 0 research item ([research.md](./research.md) R-001): produce a **client-rendered local bundle** that talks to the remote backend/Supabase, with the exact build strategy (client-side routing shim vs. supported export path) pinned before implementation; no financial/business logic is reimplemented regardless |
| **Apple "minimum functionality" (Guideline 4.2) rejection** of a website wrapper | The app bundles the UI locally and ships genuine native integrations — camera capture, secure storage, deep links (FR-033); `contracts/store-readiness.md` records the criteria and evidence; verified against current guidelines at implementation time |
| **Native auth / deep-link** behaves differently than a browser tab (session loss, duplicate sessions, dropped return) | Dedicated US1 slice and `contracts/auth-deeplink.md`; cold/background/signed-in deep-link cases enumerated as edge cases and tested; session only in secure store |
| An implementer widens the on-device cache into persistent/cross-session storage "for offline" | `contracts/on-device-security.md` states the in-memory-only, secure-session-only rule as binding and testable; a native check asserts no financial data or secret in device storage |
| Scope creep into a native rewrite or new native UI | Structure Decision + FR-001/FR-039 confine the phase to a wrapper reusing `apps/web`; any hand-written native UI beyond bootstrap/config is out of scope |
| A backend endpoint is added "to support mobile" (e.g., version gate) | FR-005/FR-037 forbid it; the plan relies on store update mechanisms; `apps/api` and `supabase` are untouched and the backend suite is re-run unmodified |
| Store policy / signing / data-safety requirements drift between spec and submission | Verified against current store docs at implementation time (Assumptions); `release-runbook.md` and `privacy-data-safety.md` are living deliverables |
| Developer-account cost mistaken for a paid product tier | Documented as an organizational dependency in Assumptions and `release-runbook.md`; the user-facing product stays free (FR-003) |

## Complexity Tracking

*No violations — table intentionally omitted.*
