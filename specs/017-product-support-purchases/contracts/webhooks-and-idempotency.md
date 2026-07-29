# Contract: Inbound Provider/Store Notifications (binding)

Governs how `public.support_purchases.status` may change after row creation.
This is the enforcement point for FR-014, FR-016, FR-017, FR-018, and FR-025.

## Binding rules

1. **No client-reported status is ever trusted.** A browser return redirect
   from Stripe Checkout, a bare OS purchase-acknowledgement event on
   Android/iOS, or any request body field named like `status`/`success`
   coming directly from a web or mobile client **MUST NOT**, by itself,
   move a purchase to `completed` or `refunded`.
2. A transition to `completed` requires one of:
   - A **Stripe webhook** event (`checkout.session.completed` /
     `payment_intent.succeeded`) whose signature is verified against the
     endpoint's Stripe-provided signing secret.
   - A **server-side verification call** to Apple's App Store Server API
     confirming the transaction for the purchase's original transaction id.
   - A **server-side verification call** to the Google Play Developer API
     confirming the purchase token's state.
3. A transition to `refunded` requires one of:
   - A **Stripe webhook** refund/charge-refunded event, signature-verified
     as above.
   - An Apple **App Store Server Notification V2** of type `REFUND`,
     verified as a genuine Apple-signed JWS payload.
   - A Google Play **real-time developer notification** (or subsequent
     verification call) indicating a voided/refunded one-time product
     purchase.
4. A transition to `failed` is set when the provider/store itself reports a
   failed or canceled payment/purchase, or when a `pending` purchase is
   explicitly abandoned (e.g., an expired Stripe Checkout Session) —
   **never** inferred from the user simply navigating away, since that must
   default to remaining `pending` until the provider's own terminal signal
   arrives or the session provably expires.
5. **Every notification handler MUST verify authenticity before acting**:
   - Stripe: verify the `Stripe-Signature` header against the configured
     webhook signing secret.
   - Apple: verify the notification's JWS signature chain against Apple's
     published root certificates.
   - Google: verify the request originates from the configured Pub/Sub
     subscription / service-account context, and independently re-verify
     purchase state via the Google Play Developer API rather than trusting
     notification payload fields alone.
6. **Idempotency is enforced at the database level**, not just in
   application logic: `unique (channel, provider_transaction_id)` on
   `support_purchases`, plus an explicit check (query-then-conditional-
   update, or `ON CONFLICT DO NOTHING`/guarded update) so a redelivered
   notification for an already-`completed` or already-`refunded` purchase
   is a safe no-op, never a duplicate row or a repeated side effect.
7. A notification for a purchase that cannot be matched to an existing row
   (e.g., unknown `provider_transaction_id`) MUST be logged and safely
   discarded — it MUST NOT create a new, orphaned `completed` purchase from
   a notification alone; only the flows in rules 2–3 above, starting from a
   `pending` row this backend created, may reach `completed`/`refunded`.

## Non-goals (explicitly out of scope)

- Smart Expense does not expose any endpoint that lets a user or the app
  directly set `status` to `completed`, `failed`, or `refunded`.
- Smart Expense does not implement refund initiation; rule 3 only ever
  *reflects* a refund the provider/store already granted (spec
  Clarifications; research.md R-005).

## Verification

- Unit tests simulate: a valid signed webhook/notification (→ correct
  transition), a tampered/invalid signature (→ rejected, no transition), a
  redelivered identical notification (→ no duplicate row, no repeated
  transition), and a client-only "I paid!" request with no corresponding
  verified signal (→ purchase stays `pending`).
- A documented manual sweep exercises Stripe test-mode webhooks and
  Apple/Google sandbox purchase + notification flows end-to-end
  (`quickstart.md`).
