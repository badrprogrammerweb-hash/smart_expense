# Contract: Offline, Reconnect, and Duplicate Prevention

**Feature**: `015-pwa-mobile-readiness` | **Covers**: FR-007 – FR-015, FR-023 – FR-029, FR-039, SC-002 – SC-004, SC-008

## 1. Connectivity states

Exactly three states, exposed by one `useConnectivity()` hook. Every component
that gates behaviour on connectivity MUST consume this hook — no component may
read `navigator.onLine` directly.

| State | Meaning | Derived from |
|---|---|---|
| `online` | Backend reachable, recent request succeeded | `navigator.onLine` true **and** no recent connectivity failure |
| `degraded` | Browser reports online, but the backend is unreachable (captive portal, timeout, network error) | A query/mutation failed with a network-class error while `navigator.onLine` is true (FR-014) |
| `offline` | Browser reports no connectivity | `offline` event / `navigator.onLine` false |

Rules:

- **Classification**: an `ApiError` (the backend answered with a status) is
  **not** a connectivity failure. Only fetch rejections and timeouts are.
- **Debounce**: state transitions MUST be debounced (~1.5s) so flapping does
  not thrash the interface or trigger refetch storms (FR-015).
- **Recovery probe**: when leaving `degraded`/`offline`, a single debounced,
  unauthenticated `GET` to the backend's existing `/health` endpoint MAY
  confirm recovery. **Interval polling is forbidden.** No new endpoint is
  introduced.
- `degraded` and `offline` are treated identically for the purpose of gating
  mutations (section 3) and labelling data (section 4); only the message text
  differs.

## 2. Offline shell

- A failed navigation MUST render the precached locale-matched offline route,
  never a browser network-error page (FR-007).
- A persistent, translated connectivity indicator MUST be visible in the
  application shell whenever the state is not `online` (FR-007).
- Launching while already offline with no in-session data MUST render the shell
  with an offline state, not stale data and not a broken page.

## 3. Blocked actions (exhaustive)

While `offline` or `degraded`, each of the following MUST be disabled and MUST
show an explanation. None may be queued, stored locally, or replayed (FR-009,
FR-010):

1. Create / edit / delete income
2. Create / edit / delete expense
3. Create / edit / archive category
4. Upload file
5. Delete file
6. Trigger AI extraction
7. Confirm AI extraction
8. Discard AI extraction
9. Change workspace settings (base currency, auto-delete, language preference persistence)
10. Save / replace / remove AI provider key
11. Any workspace member or role change

Permission behaviour is unchanged: an action the user's role forbids stays
forbidden, and the client MUST NOT approve, cache, or infer any permission
outcome locally (FR-039).

## 4. Cached-data labelling

- Data loaded earlier in the session MAY be shown read-only while not `online`,
  and MUST carry a visible "cached — last updated \<time\>" label (FR-008).
- Where no in-session data exists for the current view, the offline state MUST
  be shown instead of stale or empty-looking data.
- Cached values MUST NEVER be presented as authoritative totals (FR-013).
- Nothing in this contract permits writing workspace data to persistent device
  storage — see `service-worker-cache-policy.md`.

## 5. Reconnect

On transition to `online` (FR-011):

1. The connectivity indicator clears.
2. Workspace queries refetch (react-query `refetchOnReconnect`, already the
   default).
3. Mutating actions re-enable.
4. No manual full page reload is required.
5. If the session expired while offline, the first request returns 401, the
   existing `apiFetch` redirect to sign-in runs (`lib/api/client.ts:83`), and
   the in-memory cache MUST be cleared on that path so expired-session data is
   not readable (FR-029).

## 6. Duplicate prevention (at-most-once)

No idempotency key or API contract change is permitted, so the guarantee is
delivered entirely by client behaviour:

| Rule | Requirement |
|---|---|
| D-1 | Mutations MUST NEVER be retried automatically. `mutations: { retry: false }` MUST be pinned in the query-client defaults, and **no** `useMutation` call site may override it |
| D-2 | A mutation that fails with a network-class error MUST be reported as an **indeterminate outcome** — the user is told the result is unknown, not that it failed |
| D-3 | On reconnect, the list affected by the interrupted mutation MUST be refetched from the backend before the user is offered a retry |
| D-4 | The retry affordance MUST direct the user to confirm from the refreshed list that the record is absent before resubmitting |
| D-5 | The submit control MUST remain disabled for the duration of an in-flight mutation so double-tap cannot double-submit |
| D-6 | File upload MUST follow D-1 – D-5 identically; a retried upload MUST result in exactly one stored file |

## 7. Cache isolation

| Trigger | Required effect |
|---|---|
| Workspace switch | Queries scoped to the previous workspace are removed from the in-memory cache; no prior-workspace record, total, file, or summary may render under the new workspace, online or offline (FR-023) |
| Sign-out | `queryClient.clear()` runs and the service worker is instructed to drop non-shell caches; cached workspace content is not recoverable by back-navigation or relaunch (FR-024) |
| Different user signs in | Only their own authorised workspaces are visible; no prior user data anywhere (FR-025) |
| Version change | Prior-version caches are deleted on service-worker activation (FR-028) |
| Session expiry detected | In-memory cache cleared as part of the sign-in redirect (FR-029) |

## 8. Verification

| # | Assertion | Mode |
|---|---|---|
| O-1 | Offline navigation renders the offline route in the correct locale, with a visible connectivity indicator | Automated |
| O-2 | Each of the eleven actions in section 3 is disabled with an explanation while offline | Automated |
| O-3 | After an offline session, no local draft, queued write, or pending-mutation record exists in any storage mechanism | Automated |
| O-4 | Reconnecting clears the indicator, refetches data, and re-enables mutations without a page reload | Automated |
| O-5 | A submission interrupted by connectivity loss results in exactly zero or exactly one persisted record across repeated cycles | Automated |
| O-6 | Post-reconnect dashboard and report totals equal the backend's values for the same workspace and period | Automated |
| O-7 | `mutations.retry` resolves to `false` and no `useMutation` call site overrides it | Automated |
| O-8 | A backend-unreachable-but-browser-online condition renders `degraded`, not successful empty data | Automated |
| O-9 | Rapid connectivity toggling produces a debounced, single state settle — no repeated indicator flashing or duplicated in-flight requests | Automated |
| O-10 | After a workspace switch, no prior-workspace data renders, including offline | Automated |
| O-11 | After sign-out and a second user signing in, no prior user's data renders anywhere | Automated |
| O-12 | An expired-offline session returns to sign-in on reconnect with no cached workspace data readable | Automated |
