# Contract: Service Worker Cache Policy

**Feature**: `015-pwa-mobile-readiness` | **Status**: Binding

This is the **safety-critical contract of Phase 15**. It is what makes FR-008,
FR-010, FR-013, and FR-023–FR-027 structurally true rather than aspirational.
Every rule below is testable, and every rule below is a MUST.

---

## 1. Cache allowlist (exhaustive)

The service worker MAY cache **only** the following:

| Class | Examples | Strategy |
|---|---|---|
| Build assets | `/_next/static/**` | Cache-first (content-hashed, immutable) |
| Icons and manifest | `/icons/**`, `/manifest.webmanifest` | Cache-first |
| Offline fallback routes | `/ar/offline`, `/en/offline` | Precached at `install` |
| Navigation documents | any same-origin HTML navigation | Network-first, falling back to the locale-matched offline route |

Anything not in this table MUST NOT be written to any cache.

## 2. Cache denylist (absolute)

The service worker MUST NOT cache, and MUST NOT read from cache to satisfy:

1. **Any request to the API origin** (`NEXT_PUBLIC_API_URL`) — every income,
   expense, category, file, extraction, report, history, settings, workspace,
   and member response.
2. **Any request carrying an `Authorization` header.**
3. **Any Supabase request** — auth, session, storage, or vault.
4. **Any request whose method is not `GET`.**
5. **Any response with a `Set-Cookie` header, or `Cache-Control: no-store`.**
6. **Any receipt or invoice file content**, whether fetched from the API or
   from Supabase Storage.

The worker's `fetch` handler MUST evaluate the denylist **before** the
allowlist and MUST pass denied requests straight to the network without
touching Cache Storage.

**Rationale**: caching an API GET would simultaneously (a) allow a cached
financial value to be shown as authoritative, breaching Principle X, and (b)
write workspace financial data to persistent device storage, breaching
Principle VI/VII and FR-026/FR-027. There is no offline benefit worth that
trade, because offline reads are already served from the in-memory
react-query cache.

## 3. Versioning and update

- Cache names MUST be scoped by a `CACHE_VERSION` constant, e.g.
  `smart-expense-shell-v<N>`.
- On `activate`, the worker MUST delete every cache whose name does not match
  the current version, then call `clients.claim()`.
- On `install`, the worker MUST precache the allowlisted offline routes and
  call `skipWaiting()` so a new deployment is not blocked behind an open tab.
- The registrar MUST detect an available update and ensure a subsequent
  navigation loads the new version (FR-028).

## 4. Registration

- Registration MUST be guarded to production builds only (development runs
  under Turbopack with no stable asset URLs).
- Registration MUST be guarded on `"serviceWorker" in navigator`.
- Scope is the origin root. The existing middleware matcher
  `"/((?!_next|_vercel|.*\\..*).*)"` excludes dotted paths, so `/sw.js` and
  `/manifest.webmanifest` are not intercepted for authentication.

## 5. Clearing

- On **sign-out**, the client MUST call `queryClient.clear()` (already present
  at `components/layout/WorkspaceShell.tsx:52`) and MUST post a message to the
  service worker instructing it to delete all non-shell caches. Defence in
  depth: under this policy no non-shell cache should exist.
- On **workspace switch**, the client MUST remove in-memory queries scoped to
  the previous workspace.
- On **version change**, section 3 applies.

## 6. Verification

Each item is asserted by an automated test unless marked manual.

| # | Assertion |
|---|---|
| SW-1 | After an authenticated session that loads dashboard, records, files, and reports, enumerating `caches.keys()` and every cache's `keys()` yields **zero** entries whose URL is on the API origin |
| SW-2 | The same enumeration yields zero entries for any Supabase origin |
| SW-3 | Every cached entry's URL matches the section 1 allowlist |
| SW-4 | With the network offline, a navigation to a workspace route renders the offline route in the correct locale, not a browser error page |
| SW-5 | With the network offline, an API request rejects (is not served from cache) and the UI shows offline state |
| SW-6 | After bumping `CACHE_VERSION` and reactivating, caches from the prior version are absent |
| SW-7 | Registration does not occur in a development build |
| SW-8 | After sign-out, no cache entry exists other than the allowlisted shell assets |
| SW-9 *(manual)* | Browser devtools inspection of Cache Storage, IndexedDB, localStorage, and sessionStorage after a full authenticated session shows no financial record, receipt content, API key, access token, or vault value |

## 7. Explicitly out of scope

- Background sync or any deferred replay of requests (FR-010, FR-040).
- Push notifications and the `push`/`notificationclick` handlers (FR-040).
- Periodic background refresh.
- Caching of API responses under any strategy, including stale-while-revalidate.
