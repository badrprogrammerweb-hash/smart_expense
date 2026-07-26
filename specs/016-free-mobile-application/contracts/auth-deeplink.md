# Contract: Authentication & Deep-Link Return

**Type**: Behavioural contract (not an HTTP API). Binding for this phase.

## Purpose

Define how sign-in works inside the native shell while reusing Supabase
authentication unchanged and adding only redirect configuration.

## Rules

1. **Reuse Supabase, existing methods only**: Authentication MUST use the
   existing Supabase auth with exactly the methods already enabled on the web
   (email/password plus any already-configured provider). NO new provider and NO
   parallel/reimplemented auth system.
2. **Email/password**: Authenticates directly via the existing Supabase client;
   session established without any browser redirect.
3. **Provider (OAuth) sign-in**: MUST open the platform's secure in-app
   authentication session / browser (not a plain embedded WebView) and MUST
   return to the app through a **registered deep link** (custom scheme and/or
   platform app link), completing the Supabase session on return.
4. **Redirect configuration is additive**: The deep-link redirect target is added
   to Supabase's allowed redirect list. This is auth configuration, **not** a
   financial API contract change, and adds no backend endpoint.
5. **Deep-link robustness**: A return deep link MUST resolve correctly when the
   app is cold-started, backgrounded, or already signed in, without duplicating
   sessions or losing the target destination. A cancelled/failed provider flow
   MUST return to sign-in cleanly with no partial session.
6. **Session persistence**: On success, the session MUST be stored per
   `on-device-security.md` (secure store only) and restored across app restarts
   until sign-out or expiry.
7. **Expiry**: A session that expired or was revoked (including while offline)
   MUST return the user to sign-in on the next protected action / reconnect,
   without exposing the expired session's workspace data.

## Verification

- Email/password sign-in lands in the correct workspace on a real device.
- Provider sign-in completes through the secure session and deep-link return in
  cold/background/signed-in states.
- App restart restores the session from secure storage; sign-out clears it.
- Backend auth behaviour and endpoints are unchanged (no `apps/api` diff).
