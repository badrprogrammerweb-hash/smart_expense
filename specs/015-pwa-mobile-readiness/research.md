# Phase 0 Research: Progressive Web App and Mobile Readiness

**Feature**: `015-pwa-mobile-readiness` | **Date**: 2026-07-23

All Technical Context unknowns are resolved below. Every decision is
constrained by three hard rules from the spec and constitution: the phase is
**frontend-only** (`apps/web` only), offline is **read-only**, and **no
financial data or credential may be persisted to the device**.

---

## R-001: How to declare the application manifest

**Decision**: Use the App Router's file-based manifest at
`apps/web/app/manifest.ts` exporting a `MetadataRoute.Manifest`. It is served
at `/manifest.webmanifest` and Next.js injects the `<link rel="manifest">` tag
automatically.

**Rationale**: No new dependency, type-checked, colocated with the existing
`metadata` export in `app/layout.tsx`, and version-controlled as code. A static
`public/manifest.json` would require a hand-written link tag and would drift
from the design tokens.

**Locale note**: A web manifest declares one identity; it cannot vary by
locale. `start_url` is set to `/`, which the existing `next-intl` middleware
already redirects to the user's locale (honouring the `NEXT_LOCALE` cookie), so
FR-004's language/direction requirement is satisfied by the existing routing
rather than by manifest duplication. `name`/`short_name` use the product's
Latin brand name ("Smart Expense - AI"), which is the registered product
identity in both locales; `description` is written to be understandable to both
audiences (FR-006).

**Alternatives considered**: static `public/manifest.json` (drift risk, manual
link tag); per-locale manifests selected by middleware (no platform reliably
supports switching an installed app's manifest; adds complexity for no gain).

---

## R-002: Application icons and launch appearance

**Decision**: Add a new `apps/web/public/icons/` directory (the app currently
has **no `public/` directory at all**) containing PNG icons at 192×192,
512×512, a 512×512 `purpose: "maskable"` variant with the required safe-zone
padding, and a 180×180 `apple-touch-icon`. Launch appearance is driven by the
manifest's `background_color` and `theme_color`, sourced from the Phase 14
design tokens in `app/globals.css`, plus `<meta name="theme-color">` via the
Next `viewport` export.

**Rationale**: This is the minimum set that Android/Chromium and iOS both
honour, and it produces a branded launch screen on Android without hand-
authoring images. FR-002 requires a maskable variant so Android does not crop
the wordmark.

**Explicitly not done**: the full iOS `apple-touch-startup-image` matrix (one
image per device resolution). iOS falls back to a `background_color`-tinted
launch using the touch icon, which satisfies FR-003's "branded launch
appearance" at MVP quality. Generating and maintaining ~20 device-specific
splash images is disproportionate here and is recorded as a Phase 16 deferral
in the packaging readiness document.

**Alternatives considered**: SVG-only icons (inconsistent platform support for
maskable/apple-touch); generating icons at build time (extra tooling for a
static asset set that changes only when branding changes).

---

## R-003: Service worker strategy

**Decision**: A **hand-written, versioned service worker** at
`apps/web/public/sw.js`, registered from a small client component that runs
**only in production builds** and only when `serviceWorker` is supported.

Caching policy (this is a hard contract — see
`contracts/service-worker-cache-policy.md`):

| Request class | Strategy |
|---|---|
| Navigation requests | Network-first; on failure serve the precached locale-matched offline route |
| `/_next/static/*`, `/icons/*`, `/manifest.webmanifest` | Cache-first (immutable, content-hashed) |
| The two offline fallback routes | Precached at install |
| **Anything on `NEXT_PUBLIC_API_URL`** | **Never cached, never intercepted for caching** |
| **Any request carrying an `Authorization` header** | **Never cached** |
| Supabase auth/storage requests | Never cached |

Version handling: a `CACHE_VERSION` constant scopes cache names; `activate`
deletes every cache not matching the current version, then `clients.claim()`
(FR-028).

**Rationale**: This is the single most safety-critical decision in the phase.
Caching API GETs is the natural implementer instinct and would simultaneously
breach FR-010/FR-013 (cached financial data presented as authoritative) and
FR-023–FR-027 (workspace/user data and file contents persisted to disk). By
restricting the service worker to the static shell, workspace isolation and
sign-out clearing become **structurally true** rather than a scrubbing routine
that could miss data. Offline reads then come solely from the in-memory
react-query cache, which cannot outlive the session — consistent with the
clarified "offline reads are session-scoped" assumption.

**Why hand-written rather than a library**: `next-pwa` is unmaintained against
Next 16; Serwist would add a build-plugin dependency and a Workbox runtime for
a worker that is under 100 lines and whose entire value is in what it *refuses*
to cache. A hand-written worker keeps the safety rule readable and directly
testable.

**Routing note**: the existing middleware matcher
`"/((?!_next|_vercel|.*\\..*).*)"` excludes dotted paths, so `/sw.js` and
`/manifest.webmanifest` are not auth-redirected and the worker can claim
root scope. Verified against `apps/web/middleware.ts:55`.

**Alternatives considered**: no service worker at all (fails FR-001
installability expectations and FR-007 offline shell); Serwist/Workbox
(dependency and indirection without benefit at this scope); caching API
responses (rejected — breaches financial-safety and privacy requirements).

---

## R-004: Offline fallback route

**Decision**: Add `app/[locale]/offline/page.tsx`, a static route rendered with
the Phase 14 design system and translated in both locales. The service worker
precaches `/ar/offline` and `/en/offline` at install and, on a failed
navigation, serves the one matching the requested URL's locale prefix (falling
back to the default locale).

**Rationale**: Keeps the offline experience inside the approved design system
and translation pipeline (FR-041) rather than a bare `public/offline.html`.
Precaching both locales is two small documents.

**Alternatives considered**: `public/offline.html` (untranslated, off-design);
rendering the offline state client-side only (does not help when the navigation
request itself fails).

---

## R-005: Connectivity state detection

**Decision**: A `ConnectivityProvider` React context in `apps/web/lib/` that
derives one of `online | degraded | offline` from:

1. the browser `online`/`offline` events and `navigator.onLine` (fast, coarse),
2. **real request outcomes** — a global `QueryCache`/`MutationCache` `onError`
   handler in `components/providers.tsx` that classifies network failures and
   timeouts as connectivity failures (distinguishing them from `ApiError`,
   which means the backend answered), and
3. an **on-demand, debounced** recovery probe against the backend's existing
   `GET /health` endpoint, fired only when recovering from a failure state —
   never on an interval.

State transitions are debounced (~1.5s) so flapping cannot thrash the UI
(FR-015).

**Rationale**: `navigator.onLine` alone reports "online" behind a captive
portal or when the backend is unreachable, which FR-014 explicitly forbids.
Real request outcomes are the ground truth. Interval polling would fight FR-015
and drain mobile battery, so the probe is recovery-only. `GET /health` already
exists (`apps/api/app/routes/health.py:35`) so this adds **no** endpoint.

**CORS note**: the probe is cross-origin against `NEXT_PUBLIC_API_URL`, the
same origin `apiFetch` already calls; the probe must use a plain unauthenticated
`GET` (not `HEAD`, which may not be permitted) so no CORS configuration change
is needed. To be confirmed during implementation; if `/health` is not reachable
cross-origin, fall back to signals (1) and (2) only, which still satisfy FR-014.

**Alternatives considered**: `navigator.onLine` only (fails FR-014); periodic
heartbeat polling (fails FR-015, battery cost); Network Information API (poor
support, reports link type not reachability).

---

## R-006: Preventing duplicate records without an API contract change

**Decision**: Configure `@tanstack/react-query` mutation defaults with
`retry: false` explicitly in `components/providers.tsx`, audit every existing
`useMutation` call site to confirm none overrides it, and surface an
**indeterminate outcome** state when a mutation fails with a network error:
the UI tells the user the result is unknown, refetches the affected list on
reconnect (`refetchOnReconnect`, already the react-query default), and asks the
user to confirm from the refreshed list before retrying.

**Rationale**: FR-012 forbids automatic retry precisely because the phase may
not add an idempotency key to the API (that would be a contract change and
therefore backend work). "Never retry automatically + refresh + user-confirmed
manual retry" delivers at-most-once semantics using only frontend behaviour.
`retry: 0` is already the react-query v5 mutation default; pinning it makes the
guarantee explicit and lint-able.

**Also decided**: `refetchOnWindowFocus` is currently `true`
(`components/providers.tsx:12`). On an installed mobile PWA this fires on every
app-switch, causing request storms. It is narrowed to
`refetchOnWindowFocus: "always"`-free behaviour — specifically left `true` for
desktop parity but gated by react-query's default staleness so cached-fresh
queries do not refetch; if measurement during implementation shows churn on
mobile, it is reduced to `false` with `refetchOnReconnect` retained. This is a
tuning decision, recorded so it is not silently changed.

**Alternatives considered**: client-generated idempotency keys (requires
backend support — out of scope); automatic retry with de-duplication
(unsafe — cannot distinguish "request lost" from "response lost").

---

## R-007: Camera capture on mobile

**Decision**: Extend the receipt upload flow with a second control using
`<input type="file" accept="image/*" capture="environment">` alongside the
existing file picker, plus a client-side preview (name, size, and an image
thumbnail via an object URL that is revoked on unmount/replace).

Capture-control visibility is feature-detected: shown only when
`"capture" in document.createElement("input")` **and**
`window.matchMedia("(pointer: coarse)").matches`, so desktop browsers and
devices without a camera never see a non-functional control (FR-020).

**Rationale**: `capture` is the standard web platform affordance, needs no
permission prompt handling, no `getUserMedia` stream management, and no custom
camera UI — matching the spec assumption that capture uses the web platform.
Existing Phase 6 validation (`MAX_FILE_SIZE_BYTES` 10 MB and the allowed MIME
set in `components/files/FileUpload.tsx:14`) applies unchanged to captured
photos, which satisfies FR-021 and covers the "large full-resolution photo"
edge case with the existing `errors.fileTooLarge` message.

**Alternatives considered**: `getUserMedia` custom camera (permission
complexity, a whole camera UI to design and test, and a client-side image
pipeline the spec excludes); capture-only with no picker (breaks PDF upload).

---

## R-008: Mobile primary navigation

**Decision**: A new `components/ui/bottom-nav.tsx` primitive rendered below
`lg` breakpoints, carrying the first four role-permitted destinations plus a
"more" entry that opens the **existing** `MobileNavDrawer` with the remaining
destinations and quick actions. It uses logical CSS properties so it mirrors
automatically for RTL/LTR, and `padding-block-end: env(safe-area-inset-bottom)`
for home-indicator clearance.

**Rationale**: The clarified answer. It delivers one-handed reach (FR-030)
without discarding the drawer already shipped in Phase 14, and it reuses the
existing role-filtered `navItems` array in
`components/layout/WorkspaceShell.tsx:17` so permission behaviour is unchanged
(FR-038/FR-039). Destination selection follows the existing array order, which
already ranks dashboard/incomes/expenses/files first.

**Alternatives considered**: drawer only (fails one-handed reach); a floating
action button (adds a competing navigation model, and FR-041 forbids a
competing visual system); replacing the drawer entirely (loses access to the
lower-frequency destinations).

---

## R-009: Safe areas and keyboard behaviour

**Decision**: Add `viewportFit: "cover"` to the Next `viewport` export in
`app/layout.tsx`, then apply `env(safe-area-inset-*)` padding at the shell
level (`components/ui/app-shell.tsx`), the bottom nav, and full-height
overlays (dialog/drawer). For keyboard behaviour (FR-033), sticky form footers
use `position: sticky` with safe-area padding, and forms scroll the focused
field into view; where supported, the `dvh` unit (rather than `vh`) keeps
layouts correct when the on-screen keyboard resizes the visual viewport.

**Rationale**: `viewport-fit=cover` is the prerequisite for `env()` insets to
resolve to non-zero values. `dvh` is the modern replacement for the
`100vh`-with-keyboard problem and is supported across the target browsers.
`MobileNavDrawer` already applies `env(safe-area-inset-bottom)`
(`components/ui/mobile-nav-drawer.tsx:4`), confirming the pattern.

**Alternatives considered**: VisualViewport API scroll management (complex,
easy to get wrong, needed only for cases `dvh` + sticky already handle).

---

## R-010: Cache and session isolation

**Decision**: Three independent clearing points, each testable:

1. **Sign-out** — `queryClient.clear()` already runs in
   `WorkspaceShell.signOut` (`components/layout/WorkspaceShell.tsx:52`);
   extend it to also post a message to the service worker to drop non-shell
   caches, for defence in depth even though only shell caches exist.
2. **Workspace switch** — remove queries for the previous workspace when
   `workspaceId` changes, so no Workspace A data can render under Workspace B
   (FR-023). Existing query keys are already workspace-scoped
   (e.g. `["files", workspaceId]`), which makes this a targeted removal.
3. **Version change** — the service worker's `activate` handler deletes caches
   from prior `CACHE_VERSION` values (FR-028).

**Rationale**: Because no financial data is persisted (R-003), these clears
concern the in-memory cache and the static shell only — a much smaller and
more verifiable surface than a general "scrub the device" routine.

**Session expiry while offline** (FR-029): `apiFetch` already redirects to
sign-in on a 401 (`lib/api/client.ts:83`); on reconnect the first request
returns 401 and triggers that path. The change needed is to ensure the
in-memory cache is cleared on that redirect too, so expired-session data cannot
be read on the way out.

**Alternatives considered**: persisting react-query state to IndexedDB with
per-user keys (would give cold-launch offline reads, but persists financial
data to disk — rejected outright).

---

## R-011: Testing approach

**Decision**:

- **Vitest** for the new primitives and hooks (bottom nav, install affordance,
  connectivity provider, capture control, offline indicator) — extending the
  existing `components/**/__tests__/` convention.
- **Playwright** for behaviour: manifest fetch/shape validation, offline shell
  and blocked-mutation assertions via `context.setOffline(true)`, reconnect
  recovery, workspace-switch and sign-out cache isolation, and mobile
  navigation/touch-target checks.
- Add a **`mobile-ltr`** Playwright project (mobile device profile, `en-US`) to
  pair with the existing `mobile-rtl` project (`playwright.config.ts:38`), so
  FR-043's "both locales on a mobile viewport" is actually exercised.
- **Manual sweep** for what cannot be automated: real device installation and
  launch (SC-001), physical camera capture (SC-005), and on-device touch
  ergonomics and safe-area rendering (SC-007). Documented as a checklist, the
  same pattern Phase 14 used for its full-inventory review.
- The **backend `pytest` suite is re-run unmodified** as the SC-011 gate.

**Rationale**: Install prompts and real cameras cannot be driven by Playwright,
so pretending to automate them would produce tests that assert nothing. Every
other FR-043 area is automatable and gets a test task. `context.setOffline`
drives the service worker and `navigator.onLine` correctly in Chromium.

**Alternatives considered**: Lighthouse PWA audit in CI (deprecated PWA
category; brittle); real-device cloud testing (out of proportion for this
phase).

---

## R-012: Packaging readiness documentation

**Decision**: Produce `docs/mobile/app-store-readiness.md` recording: verified
installability characteristics and the platforms checked; the icon/asset
inventory and what a native shell would need beyond it (the deferred iOS splash
matrix, store icon sizes); the authentication and session rules a packaged
client must preserve (Supabase session handling, backend-validated permissions,
no client-side authorization); the financial-authority rule (backend computes
all totals; no client calculation or offline write); workspace-isolation
requirements for any client-side cache; capture and upload constraints
(file types, 10 MB limit, no client-side image processing); and an explicit
deferred list for Phase 16.

**Rationale**: FR-042 and US6 require documentation, not code. Placing it in
`docs/mobile/` matches the repository's existing `docs/` convention and keeps
it out of `specs/`, which is phase-scoped.

**Hard constraint restated**: this document proposes **zero** new endpoints,
request/response changes, or native artefacts (SC-013).
