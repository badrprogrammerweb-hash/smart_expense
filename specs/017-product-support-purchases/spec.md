# Feature Specification: Optional Product Support Purchases

**Feature Branch**: `017-product-support-purchases`

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "Phase 17 — Optional Product Support Purchases. Add an optional, one-time, symbolic digital \"support this project\" purchase experience that is completely separate from workspace financial records (income/expenses/budget). The complete product remains free for every user regardless of whether they purchase support — no features unlock, no limits change, no permissions change. Web purchases use a hosted checkout (e.g., Stripe Checkout or similar hosted payment page) so Smart Expense never stores payment-card details. Store app purchases (iOS/Android) use Apple In-App Purchase (StoreKit) and Google Play Billing respectively, per platform policy. Provide clear success, failure, pending, and refunded states, and a simple receipt/confirmation view. Support purchase records must never be described using charitable/donation terminology (use \"support\" language, not \"donate\"). This phase is planning/spec only — no application code."

## Overview

Smart Expense - AI completed its MVP (Phases 1–10), added localization and
workspace currency (Phase 12), hierarchical categories (Phase 13), the
approved design system (Phase 14), an installable Progressive Web App
(Phase 15), and free native Android/iOS applications (Phase 16). Phase 16
explicitly deferred any purchase, payment, or in-app purchase capability to
this phase.

Phase 17 adds a single, narrowly-scoped capability: a user who wants to may
make a **one-time, symbolic, optional purchase to support the project's
continued development**. The purchase is entirely cosmetic to the product
experience — it does not unlock a feature, raise a limit, change a role
permission, or alter anything about a workspace's income, expense, or
report data. A user who never makes a support purchase has, and always
will have, the exact same complete product as a user who has made ten.

This is required by the constitution's Principle XIII (Free Product and
Optional Support): the product **MUST remain fully usable without payment**,
support purchases **MUST NOT** unlock features, increase limits, change
permissions, restrict non-supporters, create a mandatory subscription, be
described as a charitable donation, or affect workspace financial records.
Payment handling **MUST** use approved external payment providers or
app-store billing, and Smart Expense **MUST NOT** store or directly process
payment-card details.

On the web, support purchases route through a **hosted checkout page**
operated by an approved external payment provider — Smart Expense never
receives or stores card details. In the native Android and iOS applications
(Phase 16), support purchases **MUST** use Apple In-App Purchase (StoreKit)
and Google Play Billing respectively, because both platforms require
digital-goods purchases inside their apps to use their own billing systems.

This is a **planning-and-spec phase**. No application code, payment
integration, or store-billing configuration is implemented here.

## Clarifications

### Session 2026-07-26

All clarification questions in this phase were resolved with recommended,
MVP-safe defaults that keep the smallest possible surface area while
satisfying every constitutional constraint on Principle XIII.

- Q: What can a user choose to pay — a fixed set of preset amounts, a fully
  custom amount, or both? → A: A small, fixed set of preset one-time support
  tiers (e.g., three tiers such as a small/medium/large symbolic amount),
  each mapped to its own store product/price. No free-text custom amount
  entry in this phase — presets keep the store-product catalog small,
  predictable, and easy to keep in sync across web, Apple, and Google, and
  avoid extra fraud/abuse surface from arbitrary amounts. Additional tiers or
  custom amounts may be considered in a later phase.
- Q: Is a support purchase tied to a signed-in user account, a workspace, or
  made anonymously? → A: Tied to the authenticated user's account, never to
  a workspace. This lets a signed-in user see their own support-purchase
  history and receipts across devices while keeping the purchase completely
  outside every workspace's financial data — consistent with the
  constitution's requirement that support purchases never touch workspace
  income, expense, balance, or report records. A user must be signed in to
  start a support purchase.
- Q: Who resolves refunds, and how does Smart Expense learn about one? → A:
  Refunds are always initiated and approved through the payment provider's or
  platform's own refund mechanism (the web payment provider's support/refund
  process, Apple's request-a-refund flow, or Google Play's refund flow) —
  Smart Expense never processes a refund itself and never touches card
  details. Smart Expense passively reflects the resulting status by
  receiving a provider/store notification (webhook or server notification)
  and updating the purchase record to `refunded`. This avoids building a
  parallel in-app refund/payment-processing system that the constitution
  already forbids ("MUST NOT store or directly process payment-card
  details").
- Q: What currency are the preset support amounts shown in? → A: Each channel
  uses its own native currency handling rather than Smart Expense performing
  conversion: the app-store channels (Apple, Google) display the tier in the
  buyer's store-account currency using the platform's own localized pricing,
  and the web hosted-checkout channel displays a single reference currency
  configured for the web tier (the workspace base-currency work from Phase 12
  is unrelated, since this purchase is account-level, not workspace-level).
  Smart Expense stores the actual charged amount and currency exactly as
  reported by the provider/store, never computing or converting it itself.
- Q: Is the receipt a Smart Expense–generated document or the provider's own
  receipt? → A: Smart Expense shows an in-app confirmation/receipt view
  (amount, currency, date, channel, transaction reference) sourced from the
  stored purchase record, and links out to the payment provider's or app
  store's own official receipt/email where one exists, rather than
  generating a competing PDF or formal financial document itself. This
  keeps Smart Expense out of the business of issuing its own payment
  receipts while still giving the user an at-a-glance confirmation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A user makes an optional one-time support purchase on the web (Priority: P1)

A signed-in user opens a "Support Smart Expense" entry point (for example,
from Settings), sees a short, honest explanation that the product is and
will remain completely free, and is shown a small set of preset one-time
support amounts. They pick one, are redirected to a hosted checkout page
operated by an external payment provider, complete payment there (card
details are entered on the provider's page, never on a Smart Expense
screen), and are returned to Smart Expense to a clear success confirmation
with a simple receipt. The workspace they were using before, during, and
after the purchase shows identical income, expense, and remaining-balance
totals throughout.

**Why this priority**: This is the headline capability of the phase and the
only path exercised on the web product; without it, nothing else in this
phase has a reason to exist.

**Independent Test**: As a signed-in user, open the support entry point,
select a preset amount, complete a test payment on the hosted checkout page,
confirm redirect back to a success/receipt view, and confirm the current
workspace's dashboard totals are byte-for-byte unchanged before and after.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the web, **When** they open the support
   entry point, **Then** they see a clear, non-charitable explanation that
   the product is fully free and a small set of preset one-time support
   amounts to choose from.
2. **Given** a selected preset amount, **When** the user proceeds, **Then**
   they are redirected to a hosted checkout page operated by an external
   payment provider, and no card-detail input field is ever rendered by
   Smart Expense itself.
3. **Given** a completed hosted-checkout payment, **When** the user returns
   to Smart Expense, **Then** they see a clear success state and a simple
   receipt showing the amount, date, and a provider reference.
4. **Given** a support purchase in any state, **When** the user's workspace
   dashboard or reports are viewed, **Then** income, expense, and remaining
   balance totals are unaffected and identical to their pre-purchase values.
5. **Given** an unauthenticated visitor, **When** they reach the support
   entry point, **Then** they are prompted to sign in before a purchase can
   be started.

---

### User Story 2 - A user makes an optional one-time support purchase in the mobile app (Priority: P1)

A signed-in user of the free Android or iOS application (Phase 16) opens the
same "Support Smart Expense" entry point inside the app and sees the same
preset support tiers, presented through the platform's native purchase
sheet (Google Play Billing on Android, Apple In-App Purchase / StoreKit on
iOS) rather than a hosted web checkout. They complete the purchase using
their platform account's configured payment method, see the native
purchase-confirmation UI, and return to Smart Expense to the same success
and receipt experience as the web, adapted to reflect the store as the
payment channel.

**Why this priority**: Both platforms require this billing path for
digital-goods purchases made inside a native app; without it the mobile
apps could not legally or technically offer this capability at all, and
Phase 16 explicitly deferred this exact capability to this phase.

**Independent Test**: On a real or emulated Android device and a real or
emulated iOS device, as a signed-in user, open the support entry point,
select a preset tier, complete a sandbox/test purchase through the
platform's native billing UI, confirm the app shows a success/receipt state,
and confirm workspace totals are unaffected.

**Acceptance Scenarios**:

1. **Given** a signed-in user in the Android app, **When** they select a
   preset support tier, **Then** the purchase is completed through Google
   Play Billing's native purchase flow, and no card-detail field is rendered
   by the app itself.
2. **Given** a signed-in user in the iOS app, **When** they select a preset
   support tier, **Then** the purchase is completed through Apple In-App
   Purchase (StoreKit), and no card-detail field is rendered by the app
   itself.
3. **Given** a completed native purchase, **When** the user returns to the
   app's UI, **Then** they see a clear success state and a simple receipt
   consistent with the web experience.
4. **Given** a support purchase made in the mobile app, **When** the same
   user's purchase history is viewed on the web, **Then** the same purchase
   appears, since it is tied to the user's account rather than a device or
   platform.
5. **Given** a support purchase in any state, **When** the user's workspace
   dashboard or reports are viewed in the app, **Then** totals are unaffected
   and identical to their pre-purchase values.

---

### User Story 3 - A user sees the correct state for a pending, failed, or refunded purchase (Priority: P2)

A user's support purchase does not always resolve instantly to success. A
web hosted-checkout session may be abandoned or fail; a store purchase may
remain pending platform-side; or a completed purchase may later be refunded
through the payment provider's or platform's own refund process. In every
case, the user sees an honest, specific state — not a generic error — and
the app or web UI never implies that a pending or failed purchase already
took effect. A refunded purchase's status updates automatically once Smart
Expense is notified by the provider or store; the user is never asked to
report or resolve a refund manually inside the app.

**Why this priority**: Clear success/failure/pending/refunded states are an
explicit phase goal and directly protect user trust; this depends on User
Stories 1–2 existing first, so it sequences after them.

**Independent Test**: Trigger a hosted-checkout cancellation, a simulated
payment-provider failure, a store sandbox purchase left pending, and a
provider/store-issued test refund notification, and confirm each renders its
own correct, specific state in the purchase history and receipt view with no
crash and no incorrect success state.

**Acceptance Scenarios**:

1. **Given** a user abandons or cancels the hosted checkout page, **When**
   they return to Smart Expense, **Then** the purchase shows as not
   completed (no false success state) and the user can retry.
2. **Given** a payment provider or store reports a failed payment, **When**
   the user views their purchase history, **Then** the record shows a clear
   `failed` state with a safe, non-technical explanation.
3. **Given** a store purchase that is still being processed platform-side,
   **When** the user views the purchase, **Then** it shows a `pending` state
   until the platform confirms or denies it, and it does not appear as a
   completed receipt during that window.
4. **Given** a completed purchase is refunded through the provider's or
   store's own refund process, **When** Smart Expense receives the resulting
   notification, **Then** the purchase record updates to `refunded`
   automatically, without the user taking any in-app action.
5. **Given** any purchase state, **When** the user's workspace data is
   checked, **Then** no state (pending, failed, refunded, or completed) has
   ever affected income, expense, or remaining-balance totals.

---

### User Story 4 - A user reviews their support-purchase history and receipts (Priority: P3)

A user who has made one or more support purchases can open a simple,
dedicated view listing each purchase with its date, tier/amount, channel
(web, Apple, Google), and current state, and can open the in-app receipt
view for a completed purchase. The list is honest about there being nothing to
manage beyond viewing — there is no entitlement, feature, or limit attached
to any row.

**Why this priority**: This is a supporting convenience for trust and
transparency, valuable independently, but lower priority than the purchase
flows and state-correctness themselves.

**Independent Test**: As a user with at least one completed, one pending or
failed, and one refunded purchase (test data), open the history view and
confirm each row shows accurate date, tier, channel, and state, and that a
completed purchase's receipt can be opened.

**Acceptance Scenarios**:

1. **Given** a signed-in user with prior support purchases, **When** they
   open their purchase history, **Then** every purchase they made — from any
   channel — appears with date, tier/amount, channel, and current state.
2. **Given** a completed purchase, **When** the user opens its receipt,
   **Then** they see the amount, date, currency, channel, and a provider or
   store transaction reference.
3. **Given** a user with zero support purchases, **When** they open the
   history view, **Then** they see a clear empty state that does not imply
   any purchase is required or expected.
4. **Given** a purchase made on one channel (e.g., mobile), **When** the
   same user views history on another channel (e.g., web), **Then** it
   appears identically, since history is scoped to the account, not the
   channel.

---

### Edge Cases

- A user must not be able to reach a working purchase flow while signed out;
  they are redirected to sign in first, and no purchase record is created
  before authentication.
- A web hosted-checkout redirect that returns with a tampered or replayed
  reference must not be trusted as proof of payment; the purchase's true
  state must be confirmed against the payment provider (for example, via a
  server-to-server webhook or a provider status check), not solely from the
  browser redirect.
- A store purchase acknowledged by the OS but not yet confirmed to Smart
  Expense's backend must not display as a completed receipt until that
  confirmation is received.
- A duplicate or replayed provider/store notification for the same
  transaction must not create two purchase records or double-apply a status
  change.
- A user who force-quits the app or closes the browser tab mid-checkout must
  be able to safely return later and see the correct outstanding/failed
  state rather than a stuck "processing" state forever.
- A refund notification arriving for a purchase the user already deleted
  their account context for (e.g., signed out, or account since removed)
  must not error the notification handler; it must be recorded or safely
  discarded per data-retention rules without affecting any workspace.
- Changing a preset support tier's price or availability over time must not
  retroactively change the amount or state shown on a user's already-issued
  historical receipt.
- A user attempting to link a support purchase to a specific workspace, or
  expecting it to change a role, limit, or feature, must be met with a clear
  explanation that support purchases are account-level only and change
  nothing about the product experience.
- Any wording anywhere in the flow (web or mobile) must avoid "donate,"
  "donation," or charitable-fundraising language, using "support" language
  instead.

## Requirements *(mandatory)*

### Functional Requirements

#### Scope, framing, and the free-product guarantee

- **FR-001**: The product MUST remain fully usable, with every existing
  feature, permission, limit, and workflow unchanged, for users who never
  make a support purchase and for users who make any number of support
  purchases.
- **FR-002**: The system MUST present the support-purchase entry point and
  all related screens using non-charitable "support" language; the words
  "donate," "donation," or equivalent charitable-fundraising terminology
  MUST NOT appear anywhere in the flow, receipts, or history.
- **FR-003**: A support purchase MUST NOT unlock a feature, raise a usage
  limit, change a role or permission, or otherwise alter the behavior of the
  product for the purchasing user or any other user.
- **FR-004**: A support purchase MUST NOT create, modify, or otherwise
  affect any workspace's income records, expense records, remaining balance,
  reports, or history entries; support-purchase data MUST be stored
  separately from workspace financial data.
- **FR-005**: The system MUST NOT present, and MUST NOT allow configuration
  of, a recurring or subscription support purchase in this phase; every
  support purchase MUST be one-time.

#### Support tiers and purchase initiation

- **FR-006**: The system MUST offer a small, fixed set of preset one-time
  support amounts ("tiers"); free-text custom-amount entry is out of scope
  for this phase.
- **FR-006a**: Each channel MUST display and charge tier amounts using its
  own native currency handling — the platform's localized store price on
  Apple/Google, and a single configured reference currency on the web hosted
  checkout — and Smart Expense MUST store the amount and currency exactly as
  reported by the provider/store rather than converting or recomputing it.
- **FR-007**: A user MUST be authenticated (signed in to their Smart Expense
  account) before a support purchase can be started; no purchase record MUST
  be created for an unauthenticated visitor.
- **FR-008**: A support purchase MUST be associated with the purchasing
  user's account and MUST NOT be associated with, or require selection of,
  any workspace.

#### Web purchase channel

- **FR-009**: On the web, initiating a support purchase MUST redirect the
  user to a hosted checkout page operated by an approved external payment
  provider; Smart Expense MUST NOT render its own payment-card input fields
  at any point in the web flow.
- **FR-010**: Smart Expense MUST NOT receive, transmit through its own
  servers unnecessarily, log, or store raw payment-card details at any point
  in the web purchase flow.
- **FR-011**: After a hosted checkout session concludes (success,
  cancellation, or failure), the user MUST be returned to a Smart Expense
  screen reflecting the correct outcome, with the authoritative status
  confirmed from the payment provider rather than trusted solely from
  redirect parameters.

#### Mobile / store purchase channel

- **FR-012**: In the native Android application, a support purchase MUST be
  completed using Google Play Billing; in the native iOS application, a
  support purchase MUST be completed using Apple In-App Purchase (StoreKit);
  neither app MUST render its own payment-card input fields for this flow.
- **FR-013**: Each preset support tier MUST correspond to its own store
  product/price configured in the respective platform's billing console, kept
  consistent in symbolic meaning with the equivalent web tier.
- **FR-014**: A store purchase MUST be verified/confirmed with the backend
  (using the platform's server-side receipt/purchase verification mechanism)
  before it is recorded as `completed`; a purchase acknowledged only by the
  OS and not yet backend-confirmed MUST display as `pending`.

#### Purchase states and lifecycle

- **FR-015**: Every support purchase MUST have exactly one of the following
  states at any time: `pending`, `completed`, `failed`, or `refunded`; the
  system MUST display the correct, specific state to the user rather than a
  generic error or a false success.
- **FR-016**: A purchase MUST transition to `completed` only after the
  payment provider or platform confirms successful payment; it MUST NOT be
  shown as completed based on a client-side redirect or client-reported
  status alone.
- **FR-017**: A purchase refunded through the payment provider's or
  platform's own refund process MUST transition to `refunded` automatically
  when Smart Expense receives the corresponding provider/store notification,
  without requiring any in-app user action; Smart Expense MUST NOT implement
  its own in-app refund-initiation or payment-processing capability.
- **FR-018**: Duplicate or replayed provider/store notifications for the
  same underlying transaction MUST NOT create a second purchase record or
  apply a status change more than once.
- **FR-019**: A `refunded` purchase MUST NOT retroactively change, remove
  access to, or otherwise affect any product feature, limit, or permission,
  since none were ever granted by the original purchase.

#### Confirmation, receipts, and history

- **FR-020**: On a completed purchase, the user MUST see a clear success
  confirmation and a simple in-app receipt view — sourced from the stored
  purchase record, not a Smart Expense–generated financial document —
  showing at minimum the amount, currency, date, purchase channel, and a
  provider/store transaction reference, with a link to the provider's or
  store's own official receipt/email where one exists.
- **FR-021**: A user MUST be able to view a history of their own support
  purchases across all channels (web, Apple, Google), each showing date,
  tier/amount, channel, and current state, scoped to their account and
  reachable from any channel they use.
- **FR-022**: A user with no support purchases MUST see a clear empty state
  that does not imply a purchase is expected or required.

#### Security and data handling

- **FR-023**: Smart Expense MUST NOT store or directly process raw
  payment-card details under any circumstance; all card data entry MUST
  occur solely within the payment provider's hosted checkout page or the
  platform's native purchase UI.
- **FR-024**: Support-purchase data MUST be scoped to the owning user account
  and MUST NOT be readable by other users or exposed across workspace
  boundaries.
- **FR-025**: Inbound payment-provider and app-store notifications (webhooks
  / server notifications) used to confirm or update a purchase's state MUST
  be authenticated/verified as genuinely originating from the expected
  provider or platform before being trusted.

#### Preservation and scope boundaries

- **FR-026**: This phase MUST NOT change any existing financial-calculation
  logic, confirmed-only totals behavior, database schema for workspace
  financial entities, role permissions, authentication rules, AI provider
  behavior, file storage rules, or history append-only behavior for
  workspace records.
- **FR-027**: This phase MUST NOT introduce bank connections, payment-card
  storage, general-purpose commerce/fundraising capability, mandatory
  billing, or any capability described as a subscription.
- **FR-028**: This phase MUST NOT hard-code store commission percentages,
  tax rules, or regional billing requirements into product documentation or
  long-term business-model artifacts; these MUST be verified against current
  provider/platform terms at implementation and release time.

#### Testing and verification

- **FR-029**: Automated and documented manual coverage MUST verify: a
  completed web purchase leaves workspace totals unchanged; a completed
  mobile purchase leaves workspace totals unchanged; pending, failed, and
  refunded states render correctly and never as a false success; duplicate
  notifications do not double-apply; an unauthenticated user cannot start or
  complete a purchase; and no screen or receipt contains charitable/donation
  wording.
- **FR-030**: Existing automated suites MUST stay behavior-green; no
  workspace financial-accuracy, role-permission, or tenant-isolation
  assertion may regress as a result of this phase.

### Key Entities *(include if feature involves data)*

- **Support tier**: A preset, symbolic one-time support amount (e.g.,
  small/medium/large) with a display amount/currency and a corresponding
  product/price identifier per channel (web payment provider, Google Play,
  Apple App Store).
- **Support purchase**: A single record of a user's attempt to make a
  one-time support purchase — tied to the purchasing user's account (never
  a workspace), the chosen tier, the purchase channel (web, Google, Apple), a
  provider/store transaction reference, and its current state (`pending`,
  `completed`, `failed`, `refunded`). Explicitly excluded from every
  workspace's income, expense, balance, and report calculations.
- **Receipt**: A simple, user-facing confirmation view of a `completed`
  support purchase showing amount, currency, date, channel, and transaction
  reference, with a link to the provider's/store's own official receipt
  where available; derived from a support purchase record, not a
  Smart-Expense-generated financial document or a separate ledger.
- **Provider/store notification**: An inbound, verified event from the web
  payment provider or an app store confirming, failing, or refunding a
  purchase; used only to update a support purchase's state, never to write
  to workspace financial data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tested workspace dashboard and report totals are
  byte-for-byte identical before and after any support purchase, in any
  state (pending, completed, failed, refunded).
- **SC-002**: A signed-in user can complete a test/sandbox support purchase
  on the web through a hosted checkout page and see a correct success
  confirmation and receipt, with zero payment-card fields ever rendered by
  Smart Expense itself.
- **SC-003**: A signed-in user can complete a sandbox support purchase in
  both the Android app (Google Play Billing) and the iOS app (Apple In-App
  Purchase) and see a correct success confirmation and receipt, with zero
  payment-card fields ever rendered by the app itself.
- **SC-004**: 100% of tested pending, failed, and refunded purchase
  scenarios display their correct, specific state — never a false success
  and never a generic unexplained error.
- **SC-005**: A refund issued through the payment provider's or platform's
  own refund process is reflected as `refunded` in Smart Expense without any
  in-app refund-processing action and without changing any feature, limit,
  or permission for the affected user.
- **SC-006**: A user's support-purchase history shows every purchase they
  made across web, Android, and iOS in one place, scoped to their account.
- **SC-007**: Zero instances of "donate," "donation," or equivalent
  charitable-fundraising language appear anywhere in the support-purchase
  entry point, checkout hand-off, confirmation, receipt, or history screens.
- **SC-008**: Zero duplicate purchase records or double-applied status
  changes occur when a provider/store notification is delivered more than
  once for the same transaction, across 100% of tested replay scenarios.
- **SC-009**: 0% of unauthenticated visitors can create or complete a
  support-purchase record.
- **SC-010**: Existing automated suites remain behavior-green with no
  regression in financial-accuracy, role-permission, or tenant-isolation
  assertions.

## Assumptions

- **Builds on Phase 16**: The free Android and iOS applications and the
  existing web frontend/backend are the integration surface this phase adds
  a purchase capability to; no new client platform is introduced.
- **Preset tiers only for MVP**: A small fixed set of one-time support
  amounts is offered; free-text custom amounts are deferred to a later
  phase if ever pursued.
- **Account-scoped, not workspace-scoped**: Support purchases belong to the
  authenticated user's account and are never selectable per-workspace or
  visible inside workspace financial screens.
- **Hosted checkout on web**: The concrete external payment provider (for
  example, a Stripe Checkout–style hosted page) is selected during the
  planning phase; this spec requires only that it be an approved external
  hosted-checkout provider that keeps card data off Smart Expense's own
  servers.
- **Native billing on mobile is mandatory, not optional**: Apple In-App
  Purchase (StoreKit) and Google Play Billing are the only permitted
  purchase mechanisms inside the native apps, per platform policy; this is a
  policy constraint, not a preference.
- **No in-app refund processing**: Refunds are always initiated through the
  payment provider's or platform's own refund channel; Smart Expense only
  reflects the resulting state via a verified provider/store notification.
- **No entitlement system introduced**: Because purchases never unlock
  anything, this phase introduces no feature-flag, entitlement, or
  limit-adjustment mechanism of any kind.
- **Store/provider terms verified at implementation time**: Exact
  commission percentages, tax handling, regional billing rules, and refund
  windows are confirmed against current provider/platform terms during
  implementation and release, and are not hard-coded into planning
  documentation.
- **Legal/commercial review is a release gate, not a spec blocker**: Final
  legal, tax, and accounting sign-off (named in the implementation plan's
  Phase 17 exit criteria) happens before release, not before this
  specification is written.
