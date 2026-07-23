# Data Model: Progressive Web App and Mobile Readiness

**Feature**: `015-pwa-mobile-readiness` | **Date**: 2026-07-23

## Scope statement

This phase introduces **no new persisted server-side entities**, no database
table, column, index, migration, RLS policy, or storage policy. Existing domain
entities — income, expense, category, file, extraction, workspace, member,
settings, history — are consumed exactly as they are today, through unchanged
API contracts.

What follows is the **client-side state model**: the declarative assets and
in-memory state this phase adds to `apps/web`. It exists so the tasks phase and
the implementer share one vocabulary, not because anything is stored.

---

## 1. Application identity (declarative, build-time)

**Where**: `apps/web/app/manifest.ts` → served at `/manifest.webmanifest`.

| Attribute | Type | Value / rule |
|---|---|---|
| `id` | string | `/` — stable across deployments |
| `name` | string | `Smart Expense - AI` |
| `short_name` | string | `Smart Expense` |
| `description` | string | Understandable to both locale audiences |
| `start_url` | string | `/` — middleware redirects to the user's locale |
| `scope` | string | `/` |
| `display` | enum | `standalone` |
| `orientation` | enum \| absent | Must not lock out landscape |
| `background_color` | colour | Phase 14 surface token |
| `theme_color` | colour | Phase 14 brand token; equals the `<meta name="theme-color">` value |
| `icons` | array | See §2 |

Full field rules and forbidden fields: `contracts/web-app-manifest.md`.

## 2. Application icon set (static assets)

**Where**: `apps/web/public/icons/` — a new directory in a new `public/` tree.

| Asset | Size | Purpose |
|---|---|---|
| `icon-192.png` | 192×192 | `any` |
| `icon-512.png` | 512×512 | `any` |
| `icon-512-maskable.png` | 512×512 | `maskable`, content inside the central 80% safe zone |
| `apple-touch-icon.png` | 180×180 | Apple touch icon, no transparency |

**Validation**: every declared icon URL must resolve with the declared MIME
type and dimensions; exactly one asset declares `maskable`; no placeholder or
upscaled asset ships.

## 3. Connectivity state (in-memory, React context)

**Where**: `apps/web/lib/connectivity/`, exposed as `useConnectivity()`.

| Field | Type | Meaning |
|---|---|---|
| `status` | `"online" \| "degraded" \| "offline"` | The single source of truth for connectivity gating |
| `lastOnlineAt` | timestamp \| null | Drives the "cached — last updated …" label |
| `canMutate` | boolean | Derived: `status === "online"`. Every mutating surface gates on this |

**State transitions**:

```text
online  --browser offline event / navigator.onLine false-->  offline
online  --network-class request failure while navigator.onLine true-->  degraded
offline --browser online event + debounce + successful /health probe-->  online
degraded --successful request or successful /health probe + debounce-->  online
```

**Rules**:

- An `ApiError` (backend answered) is **not** a connectivity failure; only
  fetch rejections and timeouts are.
- Transitions are debounced (~1.5s) — FR-015.
- The `/health` probe is on-demand and recovery-only. Interval polling is
  forbidden.
- No component may read `navigator.onLine` directly; all gating flows through
  this context.

Full rules: `contracts/offline-behavior.md` §1.

## 4. Cached workspace view (in-memory only)

**Where**: the existing `@tanstack/react-query` cache. **Not persisted.**

| Attribute | Rule |
|---|---|
| Scope | One user, one workspace — existing query keys are already workspace-scoped, e.g. `["files", workspaceId]` |
| Lifetime | The browser session only. Never written to Cache Storage, IndexedDB, localStorage, or sessionStorage |
| Labelling | Displayed while not `online` only with a visible "cached — last updated \<time\>" notice |
| Authority | Never presented as an authoritative total (FR-013) |
| Cleared on | Workspace switch, sign-out, session-expiry redirect, version change |

**Consequence (accepted, recorded in the spec's assumptions)**: offline reads
do not survive relaunching the application. A cold launch while offline shows
the offline state. This is the deliberate trade that keeps financial data off
the device.

## 5. Shell cache (persistent, non-sensitive)

**Where**: Cache Storage, managed by `apps/web/public/sw.js`.

| Attribute | Rule |
|---|---|
| Contents | `/_next/static/**`, `/icons/**`, `/manifest.webmanifest`, `/ar/offline`, `/en/offline` — nothing else |
| Naming | Scoped by `CACHE_VERSION` |
| Eviction | `activate` deletes every cache not matching the current version |
| Denylist | API origin, Supabase origins, any `Authorization`-bearing request, any non-`GET`, any `Set-Cookie` or `no-store` response, any receipt/invoice content |

This cache contains **zero** user-specific, workspace-specific, financial, or
credential data by construction. Full rules and the verification matrix:
`contracts/service-worker-cache-policy.md`.

## 6. Install capability state (in-memory)

**Where**: `apps/web/lib/pwa/install.ts` + `components/pwa/InstallPrompt.tsx`.

| Field | Type | Meaning |
|---|---|---|
| `capability` | `"promptable" \| "manual" \| "installed" \| "unsupported"` | Determines which affordance renders (FR-005, FR-006a) |
| `deferredPrompt` | platform prompt event \| null | Present only when `capability === "promptable"` |
| `dismissedThisSession` | boolean | Suppresses the banner, never the Settings entry |

Nothing here is persisted beyond the session; a dismissal does not need to
survive a relaunch, and the Settings entry is always the durable path.

## 7. Capture source (transient form state)

**Where**: the receipt upload flow.

| Field | Type | Meaning |
|---|---|---|
| `source` | `"camera" \| "picker" \| null` | Which affordance produced the staged file |
| `stagedFile` | `File` \| null | Cleared on remove, replace, cancel, and successful upload |
| `previewUrl` | object URL \| null | Revoked on replace and on unmount (no leak) |
| `isUploading` | boolean | Disables the confirm control (at-most-once, D-5) |

Existing Phase 6 validation (10 MB; PNG/JPEG/WebP/PDF) applies unchanged to
either source. No file content is written to device storage.

## 8. Packaging readiness record (documentation artefact)

**Where**: `docs/mobile/app-store-readiness.md`.

Not data — a written record. Required sections: verified installability
characteristics and platforms checked; asset inventory and what a native shell
additionally needs; authentication/session rules a packaged client must
preserve; the backend-financial-authority rule; workspace-isolation
requirements for any client cache; capture and upload constraints; and an
explicit Phase 16 deferral list. It MUST propose zero API, schema, or native
changes (SC-013).

---

## Entity relationship summary

```text
Application identity ──declares──> Application icon set
                     ──declares──> start_url ──(middleware)──> locale-prefixed route

Service worker ──manages──> Shell cache            (persistent, non-sensitive)
               ──serves───> Offline fallback route (per locale)
               ──never────> API / authenticated responses

Connectivity state ──gates──> mutating actions      (FR-009)
                   ──labels─> Cached workspace view (FR-008)
                   ──drives─> offline indicator + reconnect refresh (FR-011)

Cached workspace view ──scoped to──> (user, workspace) ──cleared by──> switch / sign-out / expiry / version change

Install capability ──selects──> install affordance variant (banner prompt | instructions | none)

Capture source ──stages──> file ──(existing Phase 6 validation)──> existing upload endpoint (unchanged)
```
