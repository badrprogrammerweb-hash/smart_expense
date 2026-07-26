# Phase 0 Research: Optional Product Support Purchases

All items below were "NEEDS CLARIFICATION" candidates in the Technical
Context or open technology choices implied by the spec's Assumptions. Each is
resolved with a decision, rationale, and rejected alternatives.

## R-001: Web hosted-checkout provider

**Decision**: **Stripe Checkout** (hosted payment page), integrated
server-side only via the official Stripe Python SDK in `apps/api`.

**Rationale**: Stripe Checkout is a fully hosted page — the buyer enters card
details on Stripe's own domain, never on a Smart Expense page — which
directly satisfies Principle XIII's "MUST NOT store or directly process
payment-card details" and FR-009/FR-010/FR-023 with the least integration
surface. It supports one-time ("payment mode") Checkout Sessions matching
the spec's fixed-tier, non-subscription requirement (FR-005), has mature
webhook signature verification for authoritative, idempotent state
confirmation (FR-011, FR-016, FR-018, FR-025), and is broadly available in
the regions Smart Expense currently targets. Because the spec's Assumptions
already flag the provider as "selected during planning" and "pluggable," the
`payment_providers.py` service is written as a thin, single-purpose module
so swapping providers later stays a contained change.

**Alternatives considered**:
- *A generic self-hosted card form* — rejected outright: this is exactly the
  card-storage/processing surface Principle XIII forbids.
- *PayPal Checkout / another hosted-checkout provider* — viable and hosted
  similarly, but Stripe's one-time Checkout Session + webhook model is the
  simplest fit for "fixed preset tiers, one-time, server-confirmed" and is
  named as the illustrative example in the phase's own goals ("e.g., Stripe
  Checkout or similar hosted payment page"). Not chosen as primary to avoid
  planning two integrations without a concrete driver for the second.
- *A custom checkout UI using Stripe Elements embedded in `apps/web`* —
  rejected for this phase: Elements still renders card fields inside Smart
  Expense's own page (more PCI/DSS surface than a pure hosted redirect) with
  no material UX benefit for a symbolic one-time support purchase.

## R-002: Mobile native-billing integration approach

**Decision**: Add a small, official/community Capacitor plugin pair to the
existing Phase 16 `apps/mobile` project — one wrapping **Google Play
Billing Library** for Android, one wrapping **StoreKit 2** for iOS — behind
a single thin bridge module, `apps/mobile/src/native/billing.ts`, that
exposes "list available tiers," "purchase(tierId)," and "restore/verify"
calls to the bundled web UI. The bridge calls the **same backend
verification/history endpoints** the web channel uses; no separate
mobile-only API contract is introduced.

**Rationale**: Both platforms require in-app digital-goods purchases to use
their own billing systems — this is a policy constraint stated directly in
the implementation plan and spec (FR-012), not a design preference. Using a
plugin (rather than hand-written native modules) keeps `apps/mobile` in its
established Phase 16 posture: "thin native shell, no hand-authored native
business logic beyond bootstrap/config/plugin wiring." The purchase itself
is confirmed `completed` only after the backend independently verifies the
platform's server-side purchase/receipt data (App Store Server API /
Google Play Developer API), mirroring the web channel's "never trust the
client alone" rule (FR-014, FR-016).

**Alternatives considered**:
- *Hand-written native Swift/Kotlin billing modules* — rejected: duplicates
  well-maintained plugin functionality and reintroduces exactly the
  "hand-authored native business logic" risk Phase 16's plan flagged as
  scope creep.
- *A pure web/hosted-checkout flow reused inside the native app* — rejected
  outright: both Apple and Google policy require native digital-goods
  purchases to go through their own billing systems; a web-checkout
  workaround would violate store policy and risk rejection/removal.
- *Skipping server-side purchase verification and trusting the OS purchase
  acknowledgement alone* — rejected: this would let a spoofed or
  interrupted client report a false success; FR-014 requires a `pending`
  state until backend confirmation.

## R-003: Idempotency and inbound-notification verification approach

**Decision**: Every inbound provider/store signal is verified before being
trusted, and every state transition is keyed on the provider/store's own
event or transaction identifier with a database-level uniqueness guarantee:

- **Stripe**: webhook signature verified using the endpoint's signing
  secret (standard Stripe SDK verification); the Stripe `event.id` (or the
  Checkout Session/PaymentIntent id) is the idempotency key.
- **Apple**: App Store Server Notifications V2 (JWS-signed) verified using
  Apple's published root certificates; the notification's transaction id is
  the idempotency key.
- **Google**: Play real-time developer notifications plus a server-side
  purchase verification call (Google Play Developer API) using a service
  account; the purchase token is the idempotency key.

**Rationale**: This directly satisfies FR-018 ("duplicate or replayed
notifications MUST NOT create a second purchase record or apply a status
change more than once") and FR-025 ("notifications MUST be
authenticated/verified... before being trusted"), and keeps all three
channels behind one consistent state-machine shape in
`services/support_purchases.py` regardless of which provider produced the
event.

**Alternatives considered**:
- *Trusting notification payloads without signature verification* —
  rejected: this would let a forged request mark an unpaid purchase
  `completed`, a direct financial-integrity and fraud risk even though
  support purchases don't affect workspace totals (it would still be a real
  billing/fraud exposure for the business).
- *De-duplicating only at the application layer (in-memory or query-then-
  insert) without a DB uniqueness constraint* — rejected: vulnerable to a
  race between two concurrently delivered duplicate notifications; a unique
  index on `(provider, provider_transaction_id)` is used instead.

## R-004: Where purchase-tier configuration lives

**Decision**: The three preset tiers are defined as backend configuration
(a small static list in `apps/api`, not a new database-editable catalog
table), each carrying a stable internal tier id plus its Stripe
price id and its Apple/Google product id. The web/mobile clients only ever
receive the resolved list from a `GET /support-purchases/tiers` endpoint —
neither client hard-codes amounts.

**Rationale**: Three fixed tiers (FR-006) do not need an admin-editable
catalog for MVP; keeping them in backend configuration avoids building
unnecessary CRUD/admin surface while still giving one authoritative source
of truth shared by web and mobile (avoiding tier drift between channels).

**Alternatives considered**:
- *A DB-backed, admin-editable tiers table* — deferred: no admin UI or
  multi-tier-versioning requirement exists yet; would add scope not
  requested by the spec.
- *Hard-coding tier amounts separately in `apps/web` and `apps/mobile`* —
  rejected: risks the two channels drifting out of sync, and duplicates
  provider/store product-id mapping in two places.

## R-005: Refund handling integration point

**Decision**: No in-app refund initiation UI or endpoint is built. Smart
Expense subscribes only to the *outcome* of a refund already granted by
Stripe (via the same webhook endpoint, listening for the relevant
refund/charge-refunded event), Apple (via App Store Server Notifications V2,
`REFUND` notification type), and Google (via Play real-time developer
notifications, `SUBSCRIPTION`/`ONE_TIME_PRODUCT` void or refund
notifications) to move the matching purchase to `refunded`.

**Rationale**: Matches the spec's Clarifications decision directly: refunds
are always initiated and approved through the provider's/platform's own
channel, and Smart Expense "MUST NOT implement its own in-app
refund-initiation or payment-processing capability" (FR-017).

**Alternatives considered**:
- *An in-app "request a refund" button that emails support* — deferred as
  unnecessary scope: users already have official refund channels through
  each provider/store, and building one would imply Smart Expense processes
  the refund, which the constitution forbids.
