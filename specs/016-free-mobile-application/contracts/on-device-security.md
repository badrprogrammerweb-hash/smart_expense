# Contract: On-Device Security & Isolation

**Type**: Behavioural contract (not an HTTP API). **THE binding safety rule** for
this phase (Constitution VI/VII/X).

## Purpose

Confine the one genuinely new surface of this phase — on-device storage — so that
workspace isolation, financial accuracy, and secret protection stay structurally
true rather than aspirational.

## Rules

1. **Secure session only**: The authenticated Supabase session MUST be stored
   **only** in the platform secure store (iOS Keychain / Android Keystore-backed
   secure storage). It MUST NOT be stored in plain WebView localStorage or a
   plain file.
2. **No secrets on device**: On-device storage MUST NOT contain any AI provider
   API key, vault value, access token beyond the securely stored session, or
   internal database identifier, and MUST NOT expose any such secret to the
   client display layer or logs.
3. **Financial data in memory only**: Workspace/financial data MUST live in the
   in-memory client cache for the current session only and MUST NOT be written to
   persistent device storage. Reuses the Phase 15 read-only model.
4. **Per-user / per-workspace scoping**: Cached data MUST be scoped to one user
   and one workspace, and MUST be discarded on workspace switch, so one
   workspace's data never appears in another (including offline).
5. **Sign-out clearing**: Sign-out MUST clear the secure session and all cached
   workspace content such that it is not recoverable by relaunching the app or
   navigating back.
6. **Second-user safety**: A different user signing in on the same device MUST
   see only their own authorised workspaces and never the previous user's cached
   data.
7. **Receipt content**: Receipt/invoice file content MUST NOT be retained on the
   device beyond what the active session requires and MUST NOT be publicly
   accessible from the device.
8. **No offline write path**: No queued write, replayed mutation, or automatic
   retry of mutating requests may exist; offline is read-only.
9. **Backend authority**: No permission or financial decision is made, cached, or
   inferred on device; the backend remains authoritative.

## Verification

- Inspect device storage (Keychain/Keystore + app sandbox): session present in
  secure store; **zero** API keys, vault values, or internal identifiers; **zero**
  persisted financial records or receipt contents.
- Populate Workspace A, switch to B: no A data shown. Sign out: cached content
  gone on relaunch. Second user signs in: no prior user data.
- Offline: shell renders, mutations blocked, no queued writes; post-reconnect
  totals equal backend values with zero discrepancy.
