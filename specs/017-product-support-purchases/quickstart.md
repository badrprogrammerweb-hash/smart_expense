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

## T051: full regression gate

T051 is complete. The commands in this section are the exact ones used for
that run, and they remain the canonical commands for re-verifying the full
regression gate after any future change. The verified results are recorded
under "Recorded T051 results" at the end of this section.

Run them from the repository root in PowerShell after installing
dependencies, starting local Supabase, applying migrations, and configuring
the documented test environment.

### Backend pytest

```powershell
Push-Location apps/api
$env:PYTHONPATH = (Get-Location).Path
python -m pytest tests/ -q
Pop-Location
```

Required evidence:

- Exit code zero and the final pytest passed/skipped summary.
- `tests/acceptance/test_acc_financial_accuracy.py`, dashboard/report tests,
  and `test_support_purchases_isolation.py` pass, including unchanged income,
  expense, remaining-balance, report, feature, and usage-limit evidence.
- `tests/acceptance/test_acc_role_permissions.py`,
  `test_role_permissions_phase3.py`, and support-purchase isolation tests
  pass without any role, permission, or membership change.
- `tests/acceptance/test_acc_tenant_isolation.py`,
  `test_workspace_isolation.py`, and the support-purchase RLS/API isolation
  assertions pass for cross-workspace and cross-account access.
- Support API, receipt/history, provider, state, webhook, concurrency,
  ownership, and idempotency modules pass.

### Web Vitest

```powershell
npm run test:unit --workspace=@smart-expense/web
```

Required evidence:

- Exit code zero and the final Vitest file/test summary.
- The support entry point, four-state result/history UI, receipt eligibility,
  external-link safety, native/web switching, localization, and copy-lint
  unit tests pass.
- Existing financial, role-aware, RTL/LTR, and error-state unit tests remain
  green.

### Playwright with one worker

Start the test API and web application using the normal project test setup,
then run:

```powershell
npm run test:e2e --workspace=@smart-expense/web -- --workers=1 --grep-invert "design refresh visual regression"
```

`--grep-invert` is required and mirrors the bare-runner CI job exactly
(`.github/workflows/ci.yml`). The `design refresh visual regression` suite is
**not** part of the local T051 gate.

> **Visual-regression snapshots are Linux-container artifacts.** The committed
> baselines under `apps/web/__screenshots__/` are captured inside the pinned
> `mcr.microsoft.com/playwright:v1.61.1-noble` image, and CI verifies them only
> in that image. Running the suite on Windows compares Windows font
> rasterization against Linux baselines: the layout boxes, borders and SVG
> icons match exactly, but every text baseline sits ~3px lower because the
> `Arial, Helvetica, sans-serif` fallback resolves to Arial on Windows and to
> metric-compatible Liberation Sans in the container. That is environment
> drift, not a UI regression. **Never run `--update-snapshots` from Windows** —
> it would overwrite the Linux baselines and break the container job for
> everyone. Refresh baselines only inside the pinned image, and only when a UI
> change genuinely intends them to move.

Required evidence:

- Exit code zero, the final Playwright summary, and retained HTML report or
  trace paths for any retry.
- Existing dashboard/report financial assertions, role restrictions, and
  tenant-isolation journeys remain green.
- `e2e/support-purchases.spec.ts` proves hosted-redirect interception,
  provider-verified result polling, all history states, owner-only receipts,
  cross-channel history, and no app-rendered card fields.
- The run must not be described as a live Stripe payment; Playwright safely
  intercepts the external hosted redirect.

### Full native test suite

Run the existing native Node test suite once, deterministically, with one
test worker. `-Recurse` is required so a spec added in a nested `e2e`
subdirectory cannot be silently excluded from the regression gate, matching
the recursive `e2e/**/*.spec.mjs` glob in `apps/mobile`'s own `test:e2e`
script:

```powershell
Push-Location apps/mobile
$nativeSpecs = Get-ChildItem -LiteralPath "e2e" -Recurse -Filter "*.spec.mjs" |
  Sort-Object FullName |
  ForEach-Object { $_.FullName }
node --test --test-concurrency=1 $nativeSpecs
Pop-Location
```

Required evidence:

- Exit code zero and the final Node test summary.
- Android and iOS support-purchase specs pass together with finance parity,
  roles, tenant isolation, session, secure storage, RTL/LTR, and native
  capability regressions.
- Google purchase tokens and Apple signed transaction data are absent from
  client history, receipt state, and test artifacts.

The following platform-specific commands are useful for attaching focused
Android/iOS evidence, but they do not replace the full native command above:

```powershell
Push-Location apps/mobile
node --test --test-concurrency=1 e2e/support-purchase-android.spec.mjs e2e/support-purchase-no-card.spec.mjs
Pop-Location
```

```powershell
Push-Location apps/mobile
node --test --test-concurrency=1 e2e/support-purchase-ios.spec.mjs e2e/support-purchase-no-card.spec.mjs
Pop-Location
```

### Evidence record

For each command, record the source commit, OS/runtime versions, start/end
time, exact command, exit code, passed/failed/skipped counts, and artifact
location. T051 may be checked only after the release owner confirms:

- Financial accuracy: before/after totals and reports are equivalent for
  pending, completed, failed, and refunded support purchases.
- Role permissions: role, membership, permissions, features, and limits are
  unchanged.
- Tenant isolation: User B cannot read User A's purchase through direct
  authenticated RLS, history API, or receipt API.
- Support-purchase regression: identifier boundaries, verified transitions,
  retry behavior, receipt eligibility, secret handling, and web/native
  routing remain green.

### Recorded T051 results

T051 is complete. The full regression gate was run with the commands above
and every suite passed:

| Suite | Command | Result |
|---|---|---|
| Backend | `python -m pytest tests/ -q` | **282 passed** |
| Web unit | `npm run test:unit --workspace=@smart-expense/web` | **45 files passed, 236 tests passed** |
| Native | `node --test --test-concurrency=1 <e2e specs>` | **55 passed** |
| Playwright local gate | `npm run test:e2e --workspace=@smart-expense/web -- --workers=1 --grep-invert "design refresh visual regression"` | **109 passed, 22 skipped** |

The 22 skipped Playwright tests are the specs that self-skip without the
optional Supabase web environment variables. The `design refresh visual
regression` suite is excluded by design and is verified only in the pinned
Playwright Linux container in CI, per the note above.

No financial-accuracy, role-permission, or tenant-isolation assertion
regressed (SC-010).

## T052: manual provider sweep

T052 remains incomplete until all three provider checklists below are
performed with authorized sandbox/test accounts and real provider-generated
transactions. Never paste secrets, Google purchase tokens, Apple signed
payloads, raw webhook bodies, or card data into screenshots, logs, tickets,
or this repository.

### Shared prerequisites and baseline

- [ ] Use a dedicated, authenticated Smart Expense test account and record
  its user UUID in the restricted evidence record.
- [ ] Apply the current migration and confirm `support_purchases` has RLS,
  no `workspace_id`, and the unique `(channel, provider_transaction_id)`
  constraint.
- [ ] Create a workspace with known income/expense/dashboard/report data and
  capture API response hashes or canonical JSON before the purchase.
- [ ] Confirm the same three symbolic tiers exist in the backend and each
  provider catalog. Provider IDs and prices must be the currently approved
  test values; placeholders are not valid live configuration.
- [ ] Run the API and web/native client from the same source commit over
  HTTPS wherever a provider requires a public callback.
- [ ] Restrict provider credentials to backend environment secrets and use
  a log configuration that excludes headers, tokens, JWS values, and raw
  provider payloads.
- [ ] Have a second Smart Expense user available for ownership/isolation
  checks.

For safe database evidence, select only non-secret fields. Do not select the
raw Android `provider_transaction_id`:

```sql
select
  id,
  user_id,
  tier_id,
  channel,
  amount_minor_units,
  currency,
  status,
  failure_reason,
  created_at,
  updated_at,
  case
    when channel = 'android' then '[redacted]'
    when channel = 'web' then left(provider_transaction_id, 3)
    else '[store-reference-recorded]'
  end as identifier_evidence
from public.support_purchases
where user_id = '<test-user-uuid>'
order by created_at desc, id desc;
```

Expected in every channel: exactly one account-scoped row per provider
transaction, provider-reported amount/currency, forward-only status, no
workspace key, no entitlement/role/limit writes, and unchanged canonical
dashboard/report responses.

### Stripe test-mode checkout

#### Prerequisites

- [ ] Authorized Stripe test-mode account, Stripe CLI, and three one-time
  Price objects are available.
- [ ] Replace the non-live `price_support_*` placeholders in the approved
  deployment configuration/tier mapping with Stripe-generated test Price
  IDs in a separate reviewed configuration change.
- [ ] Configure backend-only `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SIGNING_SECRET`; do not expose them through `NEXT_PUBLIC_*`.
- [ ] Configure success/cancel origins to the test web origin and start API
  and web clients.
- [ ] Start a Stripe CLI listener that forwards the required Checkout,
  PaymentIntent, and refund events to
  `/support-purchases/webhooks/stripe`; use its temporary signing secret
  only in the local backend process.

#### Purchase and server verification

- [ ] Sign in, select each tier at least once, and confirm the browser leaves
  Smart Expense only for an HTTPS `checkout.stripe.com` URL.
- [ ] Confirm the Checkout Session is `mode=payment`, uses one preset Price,
  and has Smart Expense purchase/user correlation metadata.
- [ ] Complete one payment using Stripe's current official test payment
  method on the Stripe-hosted page. No card number, CVC, or expiry field may
  exist in Smart Expense DOM/network payloads.
- [ ] On redirect, confirm the result page reads only the `cs_...` lookup
  reference and initially shows backend state; query parameters alone do
  not create success.
- [ ] Confirm the CLI shows a signature-verified event accepted with 2xx and
  the stored purchase moves from `pending` to `completed`.
- [ ] Confirm the `cs_...` Checkout Session identity remains distinct from
  any `pi_...` PaymentIntent used only for verified correlation.

#### History, receipt, cancellation, and refund

- [ ] Confirm history shows the web purchase for the same account with the
  provider-reported amount/currency and completed state; User B sees neither
  history nor receipt.
- [ ] Open the completed receipt. A provider link is shown only if the
  backend returned an allowlisted HTTPS URL; the current data model normally
  returns no fabricated provider URL.
- [ ] Start a second Checkout Session and cancel/close it. The client must
  not mark it completed. Cause the session to expire using Stripe's
  test-mode provider controls and confirm the verified
  `checkout.session.expired` event marks only that pending attempt failed.
- [ ] Retry the failed purchase and confirm it receives a new `cs_...`
  identity; the original row is not overwritten or reused.
- [ ] Issue a partial test refund and confirm the whole purchase does not
  become refunded.
- [ ] Issue a full test refund in Stripe, confirm the verified refund event
  correlates PaymentIntent to Checkout Session, and confirm
  `completed -> refunded` exactly once on duplicate delivery.
- [ ] Confirm a refunded row has no completed-receipt action under the
  completed-only receipt contract and product access is unchanged.

#### Sensitive-data and cleanup checks

- [ ] Inspect browser network data, API JSON, server logs, Stripe CLI output
  retained as evidence, and database evidence for leaked secret keys,
  signing secrets, raw card data, or unredacted provider payloads.
- [ ] Re-fetch canonical dashboard/report/access responses and compare them
  with the baseline.
- [ ] Stop the Stripe CLI listener, remove its temporary signing secret from
  the local environment, archive disposable test catalog items if approved,
  and retain only redacted evidence. Delete the dedicated test account only
  after evidence approval if the test-data policy permits cascade cleanup.

### Apple sandbox purchase

#### Prerequisites

- [ ] Authorized Apple Developer/App Store Connect access, current agreements
  required for sandbox configuration, a Sandbox Apple Account, Xcode, and a
  supported iOS device/simulator are available.
- [ ] The app bundle is `com.smartexpense.ai`; all three one-time product IDs
  match `ai.smartexpense.support.small|medium|large`, are available in
  sandbox, and have current localized metadata/prices.
- [ ] Configure backend-only `APPLE_APP_STORE_ISSUER_ID`,
  `APPLE_APP_STORE_KEY_ID`, `APPLE_APP_STORE_PRIVATE_KEY`,
  `APPLE_APP_STORE_ROOT_CERTIFICATES`, and
  `APPLE_APP_STORE_ENVIRONMENT=Sandbox`.
- [ ] Configure an HTTPS App Store Server Notifications V2 sandbox endpoint
  at `/support-purchases/webhooks/apple`.
- [ ] Build the native app from the recorded commit, point it at the test
  backend, sign in to the dedicated Smart Expense account, and sign in with
  the Sandbox Apple Account using Apple's current instructions.

#### Purchase and server verification

- [ ] Open support inside Capacitor and confirm the native StoreKit sheet is
  used; no hosted Stripe flow or app-rendered card fields appear.
- [ ] Confirm localized products map to the same tier IDs, then complete one
  sandbox purchase.
- [ ] Confirm the device result is not proof of payment: the app sends the
  Apple transaction identifier to `/support-purchases/mobile/verify`, and
  the backend verifies the signed transaction/server response before
  completion.
- [ ] Confirm bundle ID, environment, product ID, amount/currency,
  `appAccountToken`, and account ownership match the authenticated user.
- [ ] Confirm history shows `pending` until verification and `completed`
  only after it; the same row appears on web for the same account.
- [ ] Confirm the backend explicitly correlates `transactionId` and
  `originalTransactionId` from verified Apple data without assuming they
  are interchangeable.

#### History, receipt, cancellation, and refund/revocation

- [ ] Cancel a second StoreKit sheet and confirm no false completed state or
  unrelated failed transition is created. Exercise an interrupted/pending
  sandbox transaction if Apple's current test environment supports it.
- [ ] Open the completed receipt summary. Show a provider link only if the
  backend returns a currently allowlisted HTTPS Apple URL; otherwise show
  the safe unavailable state and use Apple's official receipt channel.
- [ ] Use Apple's currently documented Sandbox/Xcode refund-testing
  mechanism for the actual product type. Do not post a handcrafted or
  unsigned notification.
- [ ] Confirm App Store Server Notifications V2 JWS and certificate chain
  verify before lookup, and bundle, environment, product, account ownership,
  transaction ID, and original transaction ID all match.
- [ ] Confirm a verified `REFUND`/applicable revocation moves
  `completed -> refunded` exactly once, while invalid and redelivered JWS
  messages make no unsafe transition.
- [ ] If the current sandbox cannot produce the required provider-generated
  event, record the exact limitation and leave this item and T052 open.

#### Expected evidence, sensitive-data checks, and cleanup

- [ ] Capture the safe database projection above, API history/receipt JSON,
  App Store sandbox transaction/event identifiers in a restricted record,
  and unchanged dashboard/report/access comparisons.
- [ ] Confirm no private key, bearer token, certificate material, complete
  JWS, raw signed transaction, or technical provider response appears in the
  device state, API response, logs, screenshots, analytics, or tickets.
- [ ] Clear sandbox purchase history using Apple's current Sandbox Account
  controls when needed, sign out of the sandbox account, remove test
  credentials from local environment/keychain, and retain only redacted
  evidence.

### Google Play internal-testing sandbox purchase

#### Prerequisites

- [ ] Authorized Play Console project, payments profile as required by
  current policy, internal-testing release, license tester, and Android
  device/emulator with Google Play are available.
- [ ] Package name is `com.smartexpense.ai`; all three active one-time
  products match `ai.smartexpense.support.small|medium|large`, with current
  localized prices and tester country availability.
- [ ] The internal tester installed the Play-delivered build from the opt-in
  link; sideloaded builds are not accepted as billing evidence.
- [ ] Configure backend-only `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`,
  `GOOGLE_PLAY_NOTIFICATION_AUDIENCE`, and
  `GOOGLE_PLAY_NOTIFICATION_SERVICE_ACCOUNT_EMAIL` with least-privilege
  Android Publisher/Pub/Sub access.
- [ ] Configure authenticated Pub/Sub push delivery to
  `/support-purchases/webhooks/google` and enable one-time-product and
  voided-purchase real-time developer notifications.

#### Purchase and server verification

- [ ] Open support inside Capacitor and confirm Google Play Billing UI is
  used; no Stripe redirect or app-rendered card fields appear.
- [ ] Confirm the store presents the expected localized product/price, then
  complete one license-test purchase.
- [ ] Confirm Android purchase state `0` remains pending and state `1`
  proceeds to backend verification; the device result alone never completes
  the Smart Expense row.
- [ ] Confirm `/support-purchases/mobile/verify` sends the purchase token
  only over authenticated TLS to the backend and the backend independently
  calls the Google Play Developer API.
- [ ] Confirm package, product, amount/currency, purchase state,
  `obfuscatedExternalAccountId`, and authenticated Smart Expense account
  ownership match before `pending -> completed`.
- [ ] Confirm history on mobile and web shows the same account-scoped row
  while every client response hides the Google purchase token.

#### History, receipt, cancellation, and refund/void

- [ ] Cancel a second billing sheet and confirm no false completed row.
  Exercise a documented pending test payment where the current license-test
  environment supports it, then confirm a verified cancellation/failure
  signal affects only the matching pending attempt.
- [ ] Open the completed receipt summary. A provider/store link appears only
  when the backend returns an allowlisted HTTPS URL; the raw token is never
  used as visible receipt text or a URL.
- [ ] Refund/void the actual test order through the current Play Console
  sandbox/order-management flow.
- [ ] Confirm authenticated RTDN delivery is followed by an independent
  Google API verification of package, product, token correlation, and
  ownership where available.
- [ ] Confirm a verified full void/refund moves `completed -> refunded`
  exactly once; partial or failed-authentication events do not mark the
  whole purchase refunded.
- [ ] Redeliver the Pub/Sub event and confirm no duplicate row, repeated
  transition, token exposure, or backward state change.

#### Expected evidence, sensitive-data checks, and cleanup

- [ ] Capture only the safe database projection above, redacted Play order
  evidence, API history/receipt JSON, authenticated notification status, and
  unchanged dashboard/report/access comparisons.
- [ ] Confirm the purchase token, service-account JSON/private key, OAuth
  assertion/access token, Pub/Sub bearer token, and raw provider responses
  are absent from client state, API JSON, logs, analytics, screenshots, and
  tickets.
- [ ] Refund/void or consume test products as appropriate for repeatability,
  remove local service-account material, stop temporary forwarding, and
  retain only approved redacted evidence.

### Final T052 sign-off

- [ ] All three provider flows produced genuine provider/store transactions;
  no mocked event is represented as live evidence.
- [ ] Completion, cancellation/expiry or pending behavior, full refund,
  duplicate delivery, history, receipt, ownership, and sensitive-data checks
  passed per provider.
- [ ] The financial/access baseline is unchanged for all observed states.
- [ ] `docs/support-purchases-compliance-notes.md` has current named owners,
  provider/account/regional conclusions, last-verified dates, and no
  release-blocking item left unresolved.
- [ ] Evidence is stored in the approved restricted location with secrets
  and reusable identifiers redacted.
