# Quickstart: Optional Product Support Purchases

A validation/run guide for Phase 17. It proves that an optional support
purchase completes correctly on each channel, that its state is always
server/provider-verified, and — the phase's central guarantee — that it
never affects any workspace's financial data. Implementation detail lives in
`tasks.md`; this is a run/verify guide.

## Prerequisites

- The existing backend (`apps/api`) runs with Supabase configured, and the
  new `support_purchases` migration (see `data-model.md`) is applied.
- A Stripe test-mode account with a webhook endpoint configured against the
  local/staging backend (e.g., via the Stripe CLI's `stripe listen --forward-to`
  during local development).
- An Apple sandbox tester account and a Google Play internal-testing track
  with the three support-tier products configured, consistent with
  `research.md` R-004's tier-id → provider-product-id mapping.
- The Phase 16 Capacitor apps (`apps/mobile`) build and run on at least one
  Android and one iOS device/emulator.
- At least one test user with existing workspace data (income, expenses,
  reports) whose totals will be checked before/after each purchase.

## Build & run

1. Apply the `support_purchases` migration; confirm the table has RLS
   enabled and no `workspace_id` column (`contracts/isolation-and-scope.md`).
2. Start `apps/api` with Stripe test keys and the Apple/Google
   service-account credentials configured as environment secrets (mirrors
   existing `SUPABASE_*` secret handling — never committed).
3. Start `apps/web`; confirm the new Settings → Support entry point renders
   the tiers returned by `GET /support-purchases/tiers`.
4. Build/run the Phase 16 Android and iOS apps against the same backend.

## Validation scenarios (map to spec Success Criteria)

### 1. Zero effect on workspace totals (SC-001)

- Record a test workspace's dashboard totals (remaining balance, income,
  expense) and report totals.
- Create a support purchase in each state — `pending`, `completed`,
  `failed`, `refunded` — for the same user.
- Re-check the same workspace's dashboard and report totals: **byte-for-byte
  identical** before and after, in every state.

### 2. Web hosted checkout (US1 → SC-002)

- As a signed-in user, open the support entry point, select a preset tier,
  and confirm no payment-card field is ever rendered by `apps/web` itself.
- Complete a Stripe test-mode payment on the hosted Checkout page.
- Confirm the redirect back to Smart Expense shows `pending` until the
  Stripe test webhook is delivered and verified, then flips to `completed`
  with a correct receipt (amount, currency, date, channel, reference).
- Cancel/abandon a Checkout session instead: confirm the purchase is never
  shown as completed and can be retried.

### 3. Mobile native billing (US2 → SC-003)

- On Android, complete a Google Play Billing sandbox purchase for a preset
  tier; confirm no card field is rendered by the app; confirm the purchase
  shows `pending` until backend server-side verification succeeds, then
  `completed`.
- On iOS, repeat with an Apple sandbox StoreKit purchase.
- Confirm the same purchase appears in purchase history when the same user
  signs in on the web (account-scoped, not device-scoped — SC-006).

### 4. Pending / failed / refunded states (US3 → SC-004, SC-005, SC-008)

- Trigger a Stripe test-mode payment failure: confirm the purchase shows
  `failed` with a safe, non-technical message, never a false success.
- Leave a store sandbox purchase unconfirmed: confirm it renders `pending`
  and never appears as a completed receipt during that window.
- Issue a test refund through Stripe's dashboard (and, where available, an
  Apple/Google sandbox refund): confirm the corresponding webhook/
  notification moves the purchase to `refunded` automatically, with no
  in-app refund action, and confirm the user's product access/features are
  completely unaffected.
- Redeliver the same webhook/notification event twice: confirm no duplicate
  purchase row is created and the status change is applied only once
  (`unique (channel, provider_transaction_id)`).

### 5. History and receipts (US4 → SC-006)

- With purchases made across web, Android, and iOS for the same user,
  confirm the history view lists all of them with correct date, tier,
  channel, and state.
- Open a `completed` purchase's receipt: confirm it shows amount, currency,
  date, channel, and reference, with a working link to the provider's/
  store's own receipt where available.
- As a different signed-in user, confirm zero rows from the first user's
  history are visible (RLS check).

### 6. Unauthenticated and language checks (SC-009, SC-007)

- As a signed-out visitor, confirm the support entry point prompts sign-in
  and no purchase record is created by any reachable action.
- Scan every new screen, confirmation, and receipt string for "donate" /
  "donation" / charitable-fundraising language: zero occurrences (grep/lint
  step over new translation-key files, documented in `tasks.md`).

### 7. Regression gate (SC-010)

- Re-run the full existing backend (`pytest`), web unit (Vitest), and web
  e2e (Playwright) suites unmodified: all remain green, with no
  financial-accuracy, role-permission, or tenant-isolation regression.

## Manual sweep (cannot be fully automated)

- A live Stripe test-mode checkout end-to-end, including the Stripe CLI
  webhook forwarding.
- A live Apple sandbox purchase and a live Google Play internal-testing
  sandbox purchase on real or emulated devices.
- A dashboard-side commission/tax/refund-window review against current
  Stripe/Apple/Google terms, recorded in
  `docs/support-purchases-compliance-notes.md` immediately before release.
