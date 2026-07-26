# Contract: Support Purchases API

Account-scoped endpoints (no `workspace_id` — see
`isolation-and-scope.md`). All non-webhook endpoints require an
authenticated user (`Depends(get_current_user)`), mirroring the existing
`/me` route's account-level pattern rather than the workspace-prefixed
pattern used by financial routes.

## `GET /support-purchases/tiers`

Returns the fixed, backend-configured list of preset support tiers
(research.md R-004). Public to any authenticated user; no purchase is
created by this call.

**Response**

```json
{
  "tiers": [
    { "tier_id": "support_small",  "label": "Small",  "display_amount": "…", "currency": "…" },
    { "tier_id": "support_medium", "label": "Medium", "display_amount": "…", "currency": "…" },
    { "tier_id": "support_large",  "label": "Large",  "display_amount": "…", "currency": "…" }
  ]
}
```

`display_amount`/`currency` are indicative for the web channel's reference
currency (research.md R-001); the Apple/Google channels resolve their own
localized store price for the same `tier_id` client-side via the platform
billing plugin, then report the actual charged amount/currency back through
the verify endpoint (FR-006a).

## `POST /support-purchases/checkout-sessions` *(web channel)*

Creates a `pending` `support_purchases` row and a Stripe Checkout Session for
the selected tier, scoped to `current_user.user_id`.

**Request**

```json
{ "tier_id": "support_medium" }
```

**Response**

```json
{ "purchase_id": "uuid", "checkout_url": "https://checkout.stripe.com/…" }
```

The client redirects the browser to `checkout_url`. No card field is ever
rendered by `apps/web` (FR-009).

## `POST /support-purchases/mobile/verify` *(iOS/Android channel)*

Called by `apps/mobile` after the platform billing UI reports a purchase,
carrying the platform's own purchase token / transaction id. Creates (if not
already present) a `pending` row keyed by `(channel, provider_transaction_id)`
and triggers **server-side verification** against the App Store Server API
or Google Play Developer API; the row only becomes `completed` once that
independent verification succeeds (FR-014, FR-016).

**Request**

```json
{ "tier_id": "support_small", "channel": "ios", "provider_transaction_id": "…" }
```

**Response**: the current `SupportPurchase` (see below), typically
`pending` immediately after this call, `completed` once verification
finishes (client polls or re-fetches history/receipt).

## `POST /support-purchases/webhooks/{provider}` *(provider/store → backend)*

`{provider}` is one of `stripe`, `apple`, `google`. Unauthenticated by user
session (no end user is involved) but **authenticated by the provider's own
signature/JWS mechanism** per `webhooks-and-idempotency.md`. Never trusts an
unsigned or invalid-signature payload. Response is a bare 2xx acknowledgement
per each provider's own webhook contract; no financial or workspace data is
ever touched by this handler.

## `GET /support-purchases` *(history)*

Returns the current user's own purchases, across all channels, newest first.

**Response**

```json
{
  "purchases": [
    {
      "id": "uuid",
      "tier_id": "support_medium",
      "channel": "web",
      "amount_minor_units": 0,
      "currency": "…",
      "status": "completed",
      "created_at": "…",
      "updated_at": "…"
    }
  ]
}
```

Scoped by RLS/service query to `user_id = current_user.user_id` only
(FR-021, FR-024).

## `GET /support-purchases/{purchase_id}/receipt`

Returns the in-app receipt view data for one of the current user's own
`completed` purchases (404/403-equivalent for another user's purchase or a
non-`completed` purchase, consistent with existing error-handling
conventions).

**Response**

```json
{
  "id": "uuid",
  "tier_id": "support_medium",
  "channel": "web",
  "amount_minor_units": 0,
  "currency": "…",
  "created_at": "…",
  "provider_reference": "…",
  "provider_receipt_url": "…or null"
}
```

`provider_receipt_url` links to Stripe's/Apple's/Google's own official
receipt where one exists (spec Clarifications: Smart Expense does not
generate a competing financial document — see FR-020).

## Error handling

Follows existing API response principles (implementation-plan §9): no stack
traces, no internal identifiers beyond the purchase id the user already
owns, no provider secret ever included in any response body.
