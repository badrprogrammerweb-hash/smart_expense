# Implementation Plan: Optional Product Support Purchases

**Branch**: `017-product-support-purchases` | **Date**: 2026-07-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-product-support-purchases/spec.md`

## Summary

Phase 17 adds an **optional, one-time, account-scoped "support this project"
purchase** — a small fixed set of symbolic support tiers, kept structurally
separate from every workspace's financial data. It does not unlock a feature,
raise a limit, or change a permission for anyone (Constitution Principle
XIII).

Three payment channels feed one shared backend domain:

1. **Web** — a hosted-checkout redirect to **Stripe Checkout** (the concrete
   external payment provider chosen for this plan; see
   [research.md](./research.md) R-001), so card data never reaches Smart
   Expense's own servers. `apps/api` creates a Checkout Session and
   authoritatively confirms payment from Stripe's own webhook, never from the
   browser's return redirect.
2. **Android** (`apps/mobile`, Capacitor — Phase 16) — **Google Play
   Billing**, via a Capacitor billing plugin.
3. **iOS** (`apps/mobile`) — **Apple In-App Purchase (StoreKit 2)**, via a
   Capacitor billing plugin.

All three channels write to one new, account-scoped table,
`public.support_purchases` (owner = `auth.uid()`, **no** `workspace_id`
column, **no** foreign key to `public.workspaces`), through a small new
FastAPI domain (`support_purchases` route/schema/service) plus a
`payment_providers` service that encapsulates Stripe Checkout-session
creation/webhook verification and validates Apple/Google server-to-server
purchase notifications. `apps/web` gets a new Settings sub-area (support
tiers, checkout hand-off, receipt, history) and `apps/mobile` gets a thin
native billing bridge feeding the same backend endpoints the web uses for
history/receipt — the store purchase itself goes through the platform's own
billing UI, not a web page.

The central safety property: **support purchases can never become financial
truth**. No dashboard, report, or history query for a workspace ever joins
against `support_purchases`; the table has no `workspace_id`, no expense/
income relationship, and no code path writes to `expenses`, `incomes`, or any
role/permission table as a side effect of a purchase.

This phase is **planning only** — no application code, migration, or
integration is implemented here.

## Technical Context

**Language/Version**: Backend additions in Python 3.11 / FastAPI (existing
`apps/api` stack). Web additions in TypeScript 5.7 / Next.js 16 / React 18
(existing `apps/web` stack). Mobile additions in the existing Capacitor
project under `apps/mobile` (TypeScript bridge code + a small
Swift/StoreKit and Kotlin/Play-Billing native plugin surface).

**Primary Dependencies**: New backend dependency — the official Stripe
Python SDK (`stripe`), used only for Checkout Session creation and webhook
signature verification (never for card input). New mobile dependencies — a
Capacitor billing plugin pair: an official/community Google Play Billing
plugin (Android) and an official/community StoreKit 2 plugin (iOS), pinned
in [research.md](./research.md) R-002. No new web-frontend payment SDK is
embedded in `apps/web`'s own bundle beyond a redirect to the Stripe-hosted
Checkout URL (Stripe.js is not required for a pure redirect-based Checkout
Session).

**Storage**: New Postgres table `public.support_purchases` in
`supabase/` (account-scoped, RLS by `auth.uid()`), created by a new,
additive migration. No change to any existing table, column, or RLS policy.
No Supabase Storage or Vault usage (no file, no secret, is introduced by this
domain beyond server-side provider API keys held as backend environment
configuration, mirroring existing `SUPABASE_*` secret handling in
`app/core/config.py`).

**Testing**: Reuse the existing `pytest` (backend), Vitest (web unit), and
Playwright (web e2e) suites, extended with new coverage: backend contract
tests for Checkout-session creation, webhook signature verification and
idempotency, and purchase-state transitions; web component/e2e tests for
tier selection, redirect hand-off, success/failure/pending/refunded
rendering, and history/receipt display; and a documented manual sweep for
what cannot be automated (live Stripe test-mode checkout, Apple/Google
sandbox purchases on the Phase 16 native apps). The full existing backend
and web suites are re-run unmodified as the regression gate (mirrors Phase
16's SC-012/SC-013 pattern).

**Target Platform**: Existing web deployment (`apps/web`) plus the existing
Phase 16 Android and iOS Capacitor apps (`apps/mobile`). No new client
platform.

**Project Type**: Existing web + API + mobile monolith. This phase adds **no
new app boundary** — it adds files inside the three existing boundaries
(`apps/api`, `apps/web`, `apps/mobile`) plus one additive `supabase/`
migration.

**Performance Goals**: No absolute SLA. Checkout-session creation and
purchase-status reads should feel instant (same latency class as existing
Settings endpoints); no goal beyond that, since purchase volume is expected
to be low relative to core financial traffic.

**Constraints**: Frozen financial contracts — no change to any existing API
request/response shape, database schema/table, financial-calculation logic,
confirmed-only totals behavior, role permission, or workspace-isolation rule
(Constitution IX/X/VII). No payment-card data of any kind is received,
transmitted through Smart Expense's own servers beyond a provider SDK call,
logged, or stored by Smart Expense (Constitution XIII; FR-010, FR-023).
Inbound provider/store notifications (Stripe webhook events; Apple App Store
Server Notifications v2; Google Play real-time developer notifications /
purchase verification) **MUST** be authenticated (signature/JWT verified)
and idempotent (FR-018, FR-025). No subscription, recurring billing, or
custom-amount entry (FR-005, FR-006).

**Scale/Scope**: One new DB table (`support_purchases`), one new backend
route module + schema module + two service modules
(`support_purchases.py`, `payment_providers.py`), a small set of new
`apps/web` Settings screens/components and one `lib/api` client module, a
small native billing bridge in `apps/mobile` plus platform billing-plugin
wiring, and one new `docs/` note capturing store-commission/tax/refund
verification steps to be confirmed at release time (Constitution: "Store
commissions, taxes, refund rules... must be verified immediately before
implementation and release").

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **Principle I / III / XV (scope & scope control)**: A single, narrowly
  allow-listed capability under Principle XIII; no bank connection,
  accounting ledger, or general commerce/fundraising capability is added
  (FR-027). **Pass.**
- **Principle II (budgeting philosophy)**: Remaining balance stays
  `confirmed income − confirmed expenses`; `support_purchases` has no join,
  FK, or trigger touching that calculation (FR-004, FR-026). **Pass.**
- **Principle VI (privacy & security)**: No payment-card data is stored or
  processed by Smart Expense (FR-010, FR-023); provider/store secrets follow
  the existing backend-only environment-secret pattern; inbound notifications
  are signature-verified (FR-025). **Pass.**
- **Principle VII (workspace isolation)**: `support_purchases` carries no
  `workspace_id` and is never exposed through a workspace-scoped endpoint;
  RLS scopes every row to its owning `auth.uid()` (FR-008, FR-024). **Pass.**
- **Principle IX (architecture authority)**: All purchase-state truth
  (pending/completed/failed/refunded) is decided server-side from verified
  provider/store signals, never from the client (FR-014, FR-016). **Pass.**
- **Principle X (financial accuracy — NON-NEGOTIABLE)**: No code path in
  this domain writes to `incomes`, `expenses`, or any total-affecting table;
  dashboard/report queries are untouched (FR-004, FR-026; SC-001). **Pass.**
- **Principle XI (reports integrity)**: Reports remain confirmed-record-only
  and backend-computed; this domain is not referenced by any report query.
  **Pass.**
- **Principle XIII (free product & optional support — THE governing
  principle of this phase)**: Preset one-time tiers only, no subscription
  (FR-005, FR-006); no feature/limit/permission changes from a purchase
  (FR-001, FR-003); non-charitable "support" language enforced in every
  screen and receipt (FR-002); hosted checkout (web) and store billing
  (mobile) only, no card storage (FR-009, FR-010, FR-012); refunds are
  provider/store-initiated only, never processed in-app (FR-017).
  **Pass — this plan's entire domain design exists to satisfy this
  principle.**
- **Principle XIV (testing requirements)**: New coverage for webhook
  signature/idempotency, purchase-state correctness, zero effect on
  workspace totals, and unauthenticated-purchase rejection, plus existing
  suites re-run unmodified (FR-029, FR-030). **Pass.**
- **Principle XVI (spec-kit workflow)**: This plan follows the clarified
  `spec.md`; implementation waits for `/speckit-tasks` and
  `/speckit-analyze`. **Pass.**

**Technology Constraints check**: The constitution requires any additional
mobile-client technology to be approved through its own spec/plan; this
phase adds **billing plugins only** inside the already-approved Phase 16
Capacitor shell (`apps/mobile`), not a new mobile-client technology. Stripe
is introduced as the web hosted-checkout provider per the implementation
plan's explicit Phase 17 goal ("use hosted checkout for supported web
purchases"); it is a backend-only integration (Checkout Session creation +
webhook verification) with no card UI hosted by Smart Expense. **Pass.**

No violations identified; **Complexity Tracking is not needed**.

*Post-Phase 1 re-check*: The data model adds exactly one account-scoped
table with RLS by `auth.uid()` and no relationship to any financial table;
the contracts make the "never affects totals" and "server-verified state
only" rules explicit and testable. **Still passes.**

## Project Structure

### Documentation (this feature)

```text
specs/017-product-support-purchases/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output — provider/plugin decisions
├── data-model.md        # Phase 1 output — support_purchases table + RLS + state machine
├── quickstart.md        # Phase 1 output — build/run/validate guide incl. manual sweep
├── contracts/           # Phase 1 output
│   ├── support-purchases-api.md      # REST contract: tiers, checkout session, history, receipt
│   ├── webhooks-and-idempotency.md   # Stripe/Apple/Google inbound-notification contract (binding)
│   └── isolation-and-scope.md        # THE "never touches workspace finance" rule (binding)
├── checklists/
│   └── requirements.md  # spec quality checklist (/speckit-specify output)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

**Structure Decision**: Existing monolith with `apps/web` (Next.js) +
`apps/api` (FastAPI) + `apps/mobile` (Capacitor, Phase 16) + `supabase`. This
phase adds **no new app boundary** — it adds an account-scoped domain's
files inside the three existing app boundaries plus one additive migration.

```text
apps/api/app/
├── routes/support_purchases.py        # NEW: GET tiers, POST checkout-session (web),
│                                       #   POST verify (mobile store purchase), GET history,
│                                       #   GET {id} receipt, POST webhooks/{provider}
├── schemas/support_purchases.py       # NEW: SupportTier, CheckoutSessionRequest/Response,
│                                       #   MobilePurchaseVerifyRequest, SupportPurchase,
│                                       #   SupportPurchaseHistoryItem
├── services/support_purchases.py      # NEW: create-session, record/confirm/fail/refund
│                                       #   transitions, history/receipt queries — all scoped
│                                       #   to current_user.user_id, never workspace_id
└── services/payment_providers.py      # NEW: Stripe Checkout-session + webhook-signature
                                        #   verification; Apple server-side receipt/notification
                                        #   verification; Google purchase/notification verification

supabase/migrations/
└── <timestamp>_support_purchases.sql  # NEW: additive migration — table, RLS, indexes
                                        #   (no change to any existing table)

apps/web/
├── lib/api/support-purchases.ts       # NEW: typed client — tiers, start checkout, history, receipt
├── components/settings/
│   ├── SupportPurchaseCard.tsx        # NEW: Settings entry point + non-charitable framing
│   ├── SupportTierSelector.tsx        # NEW: preset tier picker
│   ├── SupportPurchaseHistory.tsx     # NEW: history list (all channels, account-scoped)
│   └── SupportReceiptView.tsx         # NEW: receipt view + link to provider/store receipt
└── app/[locale]/(app)/settings/support/
    ├── page.tsx                       # NEW: support entry point route
    └── result/page.tsx                # NEW: post-hosted-checkout return route (success/cancel)

apps/mobile/src/native/
└── billing.ts                         # NEW: bridge to the platform billing plugin (Play Billing /
                                        #   StoreKit 2); calls the same backend verify/history endpoints
                                        #   the web uses — no separate mobile-only backend contract

docs/
└── support-purchases-compliance-notes.md  # NEW: living note — store commission %, tax,
                                            #   and refund-window verification checklist,
                                            #   confirmed at implementation/release time
                                            #   (never hard-coded per constitution)
```

## Implementation Strategy (dependency-ordered)

1. **Data model & isolation contract** (foundation for everything). Land the
   additive `support_purchases` migration, RLS policies, and
   `contracts/isolation-and-scope.md`. Nothing else can be built or tested
   safely without this landing first and being verified against zero
   workspace coupling.
2. **Backend domain + Stripe web channel** (US1). `support_purchases`
   route/schema/service, `payment_providers.py` Stripe integration
   (Checkout Session creation, webhook signature verification, idempotent
   state transitions). Highest **integration** risk slice — this is where
   "never trust the browser redirect, always confirm via webhook" (FR-011,
   FR-016) is enforced.
3. **Web UI** (US1, US3, US4). Settings entry point, tier selector, redirect
   hand-off, result page (success/failed/pending), receipt view, and history
   list — all reading/writing only the new endpoints.
4. **Mobile billing bridge** (US2). Wire the Capacitor billing plugin pair
   in `apps/mobile`, the native purchase UI hand-off, and the
   backend-verification call so a store purchase only becomes `completed`
   once server-confirmed (mirrors the web's webhook-authoritative rule).
5. **Cross-channel history & receipts** (US4). Confirm a purchase made on
   any channel appears identically in history/receipt on every other
   channel, since everything is account-scoped, not device- or
   channel-scoped.
6. **Compliance documentation** (release gate). Verify and record current
   Stripe/Apple/Google commission, tax, and refund-window terms in
   `docs/support-purchases-compliance-notes.md` without hard-coding
   percentages into planning artifacts, satisfying the phase's legal/
   commercial exit criterion.

Slices 1–4 are P1 and independently testable; slice 5 refines P2/P3 stories;
slice 6 is the release gate carried from the implementation plan's Phase 17
exit criteria.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| A client-reported "success" (redirect param, OS purchase ack) is trusted as payment truth, creating a fake `completed` state | `contracts/webhooks-and-idempotency.md` makes server-side, signature-verified confirmation the **only** path to `completed`/`refunded`; FR-016 states this explicitly; tested via a "redirect without webhook" scenario that must stay `pending` |
| A replayed or duplicate provider/store notification double-applies a state change or creates a second purchase row | Idempotency keyed on the provider/store's own event/transaction id, enforced by a unique constraint in the migration and checked in `services/support_purchases.py` (FR-018) |
| A developer accidentally adds a `workspace_id` column, FK, or joins `support_purchases` into a dashboard/report query "for visibility" | `contracts/isolation-and-scope.md` states this as a binding rule with a named test asserting zero references from dashboard/report services; schema review checklist item in `tasks.md` |
| Wording drift reintroduces "donate"/"donation" language in a new screen or receipt string | FR-002/SC-007 are explicit; a lint/test step (documented in `quickstart.md`) scans new UI copy for the banned terms |
| Store commission/tax/refund terms hard-coded into docs go stale | `docs/support-purchases-compliance-notes.md` is written as a living, dated checklist, verified again immediately before release, per the constitution's explicit instruction not to hard-code commission percentages |
| Apple/Google billing-plugin choice adds native code beyond a thin bridge, drifting from the Phase 16 "wrapper, not rewrite" posture | [research.md](./research.md) R-002 pins a plugin approach that keeps native code to plugin configuration + the small bridge in `apps/mobile/src/native/billing.ts`, consistent with Phase 16's Structure Decision |
| Web checkout redirect handling introduces a payment-card field in `apps/web` "for convenience" | FR-009 forbids it; Structure Decision confines the web change to a redirect + result page, no card-input component is added |

## Complexity Tracking

*No violations — table intentionally omitted.*
