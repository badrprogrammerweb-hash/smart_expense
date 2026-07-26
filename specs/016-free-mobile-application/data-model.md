# Phase 1 Data Model: Free Mobile Application

This phase introduces **no new persisted server-side data entities** and changes
**no** existing schema, contract, or financial rule. All business data (income,
expense, category, file, extraction, workspace, member, settings, history) is
owned by the existing backend and Supabase and is read/written exclusively
through the **existing** endpoints. The entities below are **client/native
concepts** that describe on-device state and packaging artefacts, not database
tables.

## Native / client-side state

### Native runtime context

- **What it is**: The app's awareness that it is running inside the Capacitor
  native shell (vs. a plain web browser), used to route camera, secure storage,
  and deep-link handling to native plugins with a web fallback.
- **Fields (conceptual)**: `isNative` (bool), `platform` (`ios` | `android` |
  `web`), available native capabilities.
- **Lifecycle**: Resolved once at startup; never persisted.
- **Rules**: When `isNative` is false, all behaviour falls back to the existing
  web behaviour unchanged. No financial or permission decision depends on this.

### Secure session record

- **What it is**: The authenticated Supabase session (access + refresh tokens)
  held in the platform secure store when running natively.
- **Fields (conceptual)**: opaque session token material managed by Supabase;
  storage key namespaced to the app.
- **Lifecycle**: Written on successful sign-in; restored on app launch; **cleared
  on sign-out and on session expiry**.
- **Rules (binding — see `contracts/on-device-security.md`)**: Stored **only** in
  the platform secure store, never in plain WebView localStorage or a plain file.
  Never exposed to logs or to the client display layer. Never accompanied by any
  AI provider key, vault value, or internal database identifier on device.

### In-memory workspace view

- **What it is**: Workspace/financial data fetched from the backend for the
  current session and workspace, held in the in-memory react-query cache.
- **Fields (conceptual)**: whatever the existing endpoints already return
  (unchanged shapes).
- **Lifecycle**: Populated on fetch; **discarded on workspace switch, sign-out,
  session expiry, and app termination**. Never written to persistent device
  storage.
- **Rules**: Scoped to one user and one workspace. Never presented as an
  authoritative total; post-reconnect totals must equal backend values. Reuses
  the Phase 15 read-only offline model.

### Deep-link / redirect registration

- **What it is**: The registered app link(s)/custom scheme used to return the
  user to the app after a provider authentication session.
- **Fields (conceptual)**: scheme/host/path registered in the native projects and
  added to Supabase's allowed redirect list.
- **Lifecycle**: Static app configuration; validated at build/submission time.
- **Rules**: Additive auth-redirect configuration only; **not** a financial API
  contract. Must resolve correctly for cold-start, backgrounded, and
  already-signed-in cases without duplicating sessions.

## Packaging & release artefacts (documentation entities)

### Mobile application package

- **What it is**: A per-platform (Android `.aab` / iOS build) installable app
  wrapping the locally-bundled web UI.
- **Fields (conceptual)**: app id, display name (both locales), version
  name/code, bundled `webDir`, icon set, splash set, signing identity.
- **Rules**: Free; no in-app purchase entitlement. Identity consistent with the
  approved design system in both locales.

### Store listing & compliance record

- **What it is**: Per-platform store metadata and compliance declarations.
- **Fields (conceptual)**: title, description, screenshots, category, content
  rating, **free / no-IAP** declaration, privacy-policy URL, data-safety /
  privacy-nutrition mapping, reviewer sign-in guidance.
- **Rules**: Truthful and complete in Arabic and English; declarations must match
  actual on-device storage (secure session only) and transmission (existing
  backend/Supabase).

### Release process record

- **What it is**: The reproducible runbook for shipping either platform.
- **Fields (conceptual)**: developer-account setup, signing/key management,
  version numbering, staged/test-track rollout, promotion to production.
- **Rules**: Reproducible without undocumented steps; developer accounts are an
  organizational dependency, not a user charge.

## Relationship to existing entities

```text
Existing backend + Supabase (UNCHANGED)
  income · expense · category · file · extraction · workspace · member · settings · history
        ▲
        │  same endpoints, same contracts, same RLS, backend-authoritative
        │
Mobile application package  ──uses──▶  Secure session record (secure store only)
        │                              In-memory workspace view (memory only)
        └──configured by──▶  Deep-link registration · Store listing · Release runbook
```

No migration, no new table, no contract change is implied by any entity above.
