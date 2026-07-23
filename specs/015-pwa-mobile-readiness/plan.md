# Implementation Plan: Progressive Web App and Mobile Readiness

**Branch**: `015-pwa-mobile-readiness` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-pwa-mobile-readiness/spec.md`

## Summary

Phase 15 turns the already-responsive, design-system-complete `apps/web`
application (Phase 14) into an **installable, mobile-ready Progressive Web
App** with **financially safe** offline behaviour. It is a frontend-only
phase: `apps/api/` and `supabase/` are untouched, and the backend suite is
re-run unmodified as the regression gate.

Four workstreams:

1. **Installability** — an App Router `manifest.ts`, a new `public/icons/`
   asset set (the app currently has no `public/` directory), theme/launch
   colours from the Phase 14 tokens, and a platform-adaptive, dismissible
   install affordance with a permanent entry in Settings.
2. **Safe offline** — a hand-written, versioned service worker that caches
   **only** the static shell, a translated offline route per locale, and a
   connectivity state derived from real request outcomes rather than
   `navigator.onLine` alone. **No API response is ever cached**, mutating
   actions are disabled while offline, and mutations are never auto-retried.
3. **Mobile experience** — a direction-aware bottom navigation bar feeding the
   existing Phase 14 drawer, camera capture in the receipt upload flow via the
   standard web `capture` attribute, safe-area insets, and keyboard-aware
   forms.
4. **Isolation and readiness** — cache clearing on sign-out, workspace switch,
   and version change, plus `docs/mobile/app-store-readiness.md` for Phase 16.

The central safety move — and the one decision this whole plan hangs on — is
that **the service worker's cache allowlist excludes every API and
authenticated response**. That makes "no incorrect totals", "no duplicate
records", and "no cross-workspace leakage" structurally true instead of
aspirational: offline reads come solely from the in-memory react-query cache,
which cannot outlive the session, and no financial record or credential is ever
written to device storage.

## Technical Context

**Language/Version**: TypeScript 5.7 on Next.js 16.2.9 (App Router) / React
18.3, scoped to `apps/web`. No change to `apps/api` (Python/FastAPI) source and
no change to `supabase/` migrations, RLS policies, or storage policies.

**Primary Dependencies**: No new runtime dependency. Reuses Tailwind CSS v4
(CSS-first `@theme` in `app/globals.css`), the Phase 14 `components/ui/`
primitive layer, `next-intl` v4 (locale routing + `messages/{ar,en}.json`),
`@tanstack/react-query` v5, `react-hook-form` + `zod`, `lucide-react`, and
`next/font` (Tajawal, already wired at `app/layout.tsx:10`). The service worker
is hand-written rather than pulled from `next-pwa`/Serwist — see
[research.md](./research.md) R-003. Icon assets are static files, not a
generated dependency.

**Storage**: N/A server-side. On the device: the service worker caches the
static shell only (`/_next/static/*`, `/icons/*`, `/manifest.webmanifest`, and
the two offline routes). **Financial data, file contents, and credentials are
never written to persistent device storage.** Offline reads are served from the
in-memory react-query cache for the current session and workspace only.

**Testing**: Vitest + React Testing Library for new primitives and hooks
(extending `components/**/__tests__/`); Playwright for behaviour — manifest
shape validation, offline shell + blocked-mutation assertions via
`context.setOffline(true)`, reconnect recovery, cache-isolation on sign-out and
workspace switch, capture affordance, and mobile navigation/touch targets. The
existing `mobile-rtl` Playwright project (`playwright.config.ts:38`) is joined
by a new `mobile-ltr` project so both locales are exercised on a mobile
viewport. A documented **manual sweep** covers what cannot be automated: real
device installation and launch, physical camera capture, and on-device touch
ergonomics/safe-area rendering. The full backend `pytest` suite is re-run
unmodified.

**Target Platform**: Browser — installed PWA and normal web — on phone,
tablet, and desktop, in `ar` (RTL) and `en` (LTR). Unchanged deployment posture
(Bunny Magic Containers, Phase 10). Installation requires a secure origin.
Light mode only.

**Project Type**: Web application (existing `apps/api` + `apps/web` monolith).
This phase is scoped to `apps/web` plus one new `docs/mobile/` document.

**Performance Goals**: No absolute SLA. Soft guardrail (FR-045, SC-014): no
significant regression in initial load or interaction responsiveness versus the
pre-phase baseline. The cost drivers are the icon assets (static, cached) and
the service worker (sub-100-line, no runtime library). The service worker
should *improve* repeat-visit shell load.

**Constraints**: Frozen contracts — no change to API request/response shapes,
DB schema, financial rules, confirmed-only totals, role permissions, auth, AI
provider behaviour, file-storage rules, history append-only behaviour, or
workspace isolation (FR-038, Constitution VI/VII/IX/X). No offline write path
of any kind (FR-010). No automatic retry of mutating requests (FR-012). No
caching of API or authenticated responses (FR-008, FR-013, FR-026). Existing
Phase 6 file validation (10 MB, PNG/JPEG/WebP/PDF) applies unchanged. Out-of-
scope capabilities (native packaging, push notifications, background sync, dark
mode, global search, export, payments) MUST NOT appear (FR-040).

**Scale/Scope**: ~10 new frontend files (manifest, service worker, offline
route, bottom nav, offline banner, stale-data notice, install prompt, SW
registrar, connectivity provider, install helper), ~10 modified files (root
layout, globals.css, providers, app shell, workspace shell, ui file-upload,
files FileUpload, settings page, api client, playwright config, messages ×2),
one new `public/` tree with 4 icon assets, one new `docs/mobile/` document, and
new Vitest + Playwright specs. Two locales × phone/tablet/desktop. No new
persisted server-side entities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **Principle I / III / XV (scope & scope control)**: Installability and mobile
  usability are delivery-surface improvements to the already-in-scope MVP
  application; no adjacent domain (banking, accounting, payments, enterprise
  workflow) is introduced. FR-040 explicitly fences out payments, push
  notifications, and native packaging. **Pass.**
- **Principle II (budgeting philosophy)**: Remaining balance stays
  `confirmed income − confirmed expenses`, computed by the backend. Nothing in
  this phase computes or caches a total as authoritative (FR-013). **Pass.**
- **Principle IV (Saudi-first defaults)**: Arabic-first RTL remains the
  default; the bottom navigation, install affordance, offline indicator, and
  capture controls all ship in both locales with correct mirroring (FR-031,
  FR-041). **Pass.**
- **Principle V (manual-first, AI-optional)**: AI extraction actions are
  disabled offline like every other mutation (FR-009); no AI behaviour changes.
  The application remains fully usable without AI. **Pass.**
- **Principle VI (privacy & security — the phase's main risk)**: This is the
  one principle Phase 15 could plausibly regress, because it introduces
  on-device storage for the first time. Mitigated structurally: the service
  worker allowlist excludes every API and authenticated response, so no
  financial record, receipt content, API key, token, or vault value is ever
  written to the device (FR-026, FR-027, R-003). Sign-out, workspace switch,
  and version change each clear their surface (FR-023, FR-024, FR-028).
  **Pass, with `contracts/service-worker-cache-policy.md` as the binding,
  testable rule.**
- **Principle VII (workspace isolation)**: Cached data is scoped to one user
  and one workspace in memory and discarded on switch (FR-023). No workspace
  scoping decision moves to the client; the backend still enforces access.
  **Pass.**
- **Principle IX (architecture authority)**: The frontend stays display-only.
  Offline mode *removes* capability rather than adding local authority — it
  never approves a permission (FR-039) or computes a total. **Pass.**
- **Principle X (financial accuracy — NON-NEGOTIABLE)**: No offline write path
  exists (FR-010); mutations are never auto-retried, so an interrupted
  submission is at-most-once (FR-012); cached values are never presented as
  authoritative and post-reconnect totals must equal backend values (FR-013,
  SC-004). Verified by the unmodified backend suite (SC-011). **Pass.**
- **Principle XI (reports integrity)**: Reports remain backend-computed from
  confirmed records; only their container becomes installable. **Pass.**
- **Principle XIV (testing requirements)**: Adds automated coverage for
  installability metadata, offline/reconnect, cache isolation, mobile capture,
  and mobile navigation in both locales, plus a documented manual sweep for the
  device-bound criteria; keeps existing behavioural/financial/permission/
  direction assertions green and re-runs the backend suite unmodified (FR-043,
  FR-044, SC-011, SC-012). **Pass.**
- **Principle XVI (spec-kit workflow)**: This plan follows the clarified
  `spec.md`; implementation does not begin until `/speckit-tasks` and
  `/speckit-analyze` complete. **Pass.**

**Technology Constraints check**: The constitution requires that future mobile
clients reuse the FastAPI backend, Supabase security model, workspace
isolation, and financial rules, and that any additional mobile-client
technology get its own spec and plan. This phase adds **no** mobile-client
technology — it is the same Next.js web application, made installable — and its
readiness document records exactly those reuse obligations for Phase 16.
**Pass.**

No violations identified; **Complexity Tracking is not needed**.

*Post-Phase 1 re-check*: the design artifacts introduce no new dependency, no
new persisted entity, and no backend surface. The cache-policy contract
strengthens the Principle VI position rather than weakening it. **Still passes.**

## Project Structure

### Documentation (this feature)

```text
specs/015-pwa-mobile-readiness/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output — 12 resolved decisions
├── data-model.md        # Phase 1 output — client-side state model (no DB entities)
├── quickstart.md        # Phase 1 output — validation/run guide incl. manual sweep
├── contracts/           # Phase 1 output — behavioural contracts (not HTTP APIs)
│   ├── web-app-manifest.md               # manifest fields + icon inventory
│   ├── service-worker-cache-policy.md    # THE safety allowlist (binding)
│   ├── offline-behavior.md               # connectivity states, blocked actions, reconnect
│   └── mobile-interaction.md             # bottom nav, capture, safe areas, touch targets
├── checklists/
│   └── requirements.md  # spec quality checklist (/speckit-specify output)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

**Structure Decision**: Existing web-application monolith. This phase changes
**only `apps/web`**, plus one new document under `docs/mobile/`. `apps/api/`
and `supabase/` are untouched and the backend suite is re-run unmodified as a
regression gate. The work adds one new directory — `apps/web/public/` (which
does not currently exist) — for the service worker and icon assets.

```text
apps/web/
├── public/                              # NEW — no public/ directory exists today
│   ├── sw.js                            # NEW: versioned service worker; shell-only cache
│   │                                    #   allowlist; NEVER caches API/authenticated responses
│   └── icons/                           # NEW: 192, 512, 512-maskable, apple-touch-icon-180
│
├── app/
│   ├── manifest.ts                      # NEW: MetadataRoute.Manifest → /manifest.webmanifest
│   ├── layout.tsx                       # extended: viewport export (viewportFit: "cover",
│   │                                    #   themeColor), apple-touch-icon link, SW registration
│   ├── globals.css                      # extended: safe-area inset utilities (no new tokens)
│   └── [locale]/
│       ├── offline/page.tsx             # NEW: translated, design-system offline fallback route
│       └── w/[workspaceId]/
│           ├── layout.tsx               # extended: bottom nav + offline indicator in shell
│           └── settings/page.tsx        # extended: permanent install entry (FR-005)
│
├── components/
│   ├── ui/
│   │   ├── bottom-nav.tsx               # NEW: direction-aware mobile bottom navigation
│   │   ├── offline-banner.tsx           # NEW: persistent connectivity indicator
│   │   ├── stale-data-notice.tsx        # NEW: "cached, last updated …" labelling
│   │   ├── app-shell.tsx                # extended: safe-area insets, bottom-nav slot
│   │   ├── file-upload.tsx              # extended: camera capture control + preview
│   │   ├── mobile-nav-drawer.tsx        # extended: reused as the bottom nav's "more" target
│   │   └── __tests__/                   # Vitest specs for each new/changed primitive
│   ├── pwa/
│   │   ├── InstallPrompt.tsx            # NEW: platform-adaptive dismissible install affordance
│   │   └── ServiceWorkerRegistrar.tsx   # NEW: production-only SW registration + update handling
│   ├── files/FileUpload.tsx             # extended: capture source choice, preview, offline block
│   ├── layout/WorkspaceShell.tsx        # extended: bottom nav, offline gating, cache clearing
│   └── providers.tsx                    # extended: mutations retry:false pinned; QueryCache/
│                                        #   MutationCache onError → connectivity; ConnectivityProvider
│
├── lib/
│   ├── connectivity/                    # NEW: ConnectivityProvider + useConnectivity hook
│   │                                    #   (navigator events + request outcomes + /health probe)
│   ├── pwa/install.ts                   # NEW: install-capability detection and prompt handling
│   └── api/client.ts                    # extended: classify network failures for connectivity
│
├── messages/{ar,en}.json                # extended: install/offline/capture/nav strings only
├── playwright.config.ts                 # extended: mobile-ltr project alongside mobile-rtl
└── e2e/
    ├── pwa-installability.spec.ts       # NEW: manifest shape, icons, affordance behaviour
    ├── offline-behavior.spec.ts         # NEW: offline shell, blocked mutations, reconnect
    ├── cache-isolation.spec.ts          # NEW: workspace switch, sign-out, second user
    ├── mobile-capture.spec.ts           # NEW: capture affordance, preview, retry-once
    └── mobile-navigation.spec.ts        # NEW: bottom nav, touch targets, safe areas, both locales

docs/mobile/
└── app-store-readiness.md               # NEW: Phase 16 readiness record (FR-042, US6)
```

## Implementation Strategy (dependency-ordered)

1. **Foundation — installability** (US1). Manifest, icons, viewport/theme
   wiring, service-worker registration, and the offline route. Nothing else can
   be verified as an installed app until this lands. The service worker ships
   with its cache allowlist and its test in the same slice, so the safety rule
   is never "added later".
2. **Safety — connectivity and offline gating** (US2). Connectivity provider,
   offline banner and stale-data labelling, mutation gating across every
   mutating surface, pinned `retry: false`, and the indeterminate-outcome +
   reconnect-refresh flow. This is the highest-risk slice and is verified by
   both automated offline tests and the unmodified backend suite.
3. **Isolation** (US4). Workspace-switch cache purge, sign-out purge extension,
   version-change cache deletion, and the expired-session-on-reconnect path —
   each with a dedicated test.
4. **Capture** (US3). Camera capture control, preview with revocable object
   URL, offline blocking, and safe failure/retry behaviour, reusing Phase 6
   validation unchanged.
5. **Mobile interaction** (US5). Bottom navigation, safe-area insets,
   keyboard-aware forms, touch-target audit, and dismissal behaviour, in both
   locales.
6. **Readiness documentation** (US6). Written last so it records what was
   actually verified, not what was planned.

Slices 1–4 are P1 and each is independently testable. Slice 5 (P2) refines
Phase 14 layouts; slice 6 (P3) blocks nothing.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| An implementer caches API GETs "to improve offline" — breaching financial safety and privacy in one move | `contracts/service-worker-cache-policy.md` states the allowlist as a binding, testable rule; a Playwright test asserts no API response is present in Cache Storage after an authenticated session |
| A stale service worker pins users to an old build | Versioned cache names; `activate` deletes non-current caches; update-available handling in the registrar; covered by FR-028 and a test |
| Offline gating is applied to some mutating surfaces but missed on others | Gating derives from one shared `useConnectivity` hook consumed by every mutating component; the offline e2e spec enumerates every mutating action from FR-009 |
| An existing `useMutation` overrides the pinned `retry: false` | Implementation includes an explicit audit of every `useMutation` call site; asserted in the offline spec |
| Install affordance built around a prompt event that never fires on some platforms | FR-006a requires platform-adaptive behaviour: prompt where available, instructions where installation is manual, nothing where unsupported |
| `refetchOnWindowFocus: true` causes request storms on an installed mobile PWA (app-switching) | Called out in research R-006 as a measured tuning decision rather than an accident |
| Manual-only criteria (real install, real camera, touch ergonomics) silently go unverified | A documented manual sweep checklist is a deliverable task, mirroring the Phase 14 pattern |

## Complexity Tracking

*No violations — table intentionally omitted.*
