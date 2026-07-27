---
description: "Task list for Phase 17 — Optional Product Support Purchases"
---

# Tasks: Optional Product Support Purchases

**Input**: Design documents from `/specs/017-product-support-purchases/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/,
quickstart.md

**Tests**: Test tasks ARE included — the spec requires verified state
transitions, idempotency, and a zero-effect-on-workspace-totals guarantee
(FR-029, FR-030), consistent with Constitution Principle XIV. Backend tests
live under `apps/api/tests/`; web tests under `apps/web/tests/` and
`apps/web/e2e/`; mobile native checks under `apps/mobile/e2e/`. The existing
backend `pytest`, web Vitest/Playwright, and mobile native suites are re-run
unmodified as the regression gate.

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md) for
independent implementation and testing.

**Scope note**: This phase adds **no new app boundary**. It adds an
account-scoped domain inside the existing `apps/api`, `apps/web`, and
`apps/mobile` boundaries plus one additive `supabase/` migration. No
existing financial-calculation logic, schema, role permission, or financial
API contract changes (FR-026, FR-027; `contracts/isolation-and-scope.md`).
This tasks.md is a **planning artifact only** — `/speckit-implement` is not
run in this phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4, mapping to the user stories in spec.md

## Path Conventions

- Backend domain: `apps/api/app/routes/support_purchases.py`,
  `apps/api/app/schemas/support_purchases.py`,
  `apps/api/app/services/support_purchases.py`,
  `apps/api/app/services/payment_providers.py`
- Migration: `supabase/migrations/<timestamp>_support_purchases.sql`
- Web: `apps/web/lib/api/support-purchases.ts`,
  `apps/web/components/settings/`, `apps/web/app/[locale]/(app)/settings/support/`
- Mobile: `apps/mobile/src/native/billing.ts`
- Compliance doc: `docs/support-purchases-compliance-notes.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new domain's files and dependencies without wiring
behavior yet.

- [X] T001 Add the `stripe` Python SDK to `apps/api`'s dependency manifest and pin the version per research.md R-001
- [X] T002 [P] Add Apple App Store Server API and Google Play Developer API client dependencies (or documented minimal HTTP-call helpers) to `apps/api`'s dependency manifest per research.md R-002/R-003
- [X] T003 [P] Add the Capacitor billing plugin pair (Google Play Billing wrapper for Android, StoreKit 2 wrapper for iOS) to `apps/mobile/package.json` per research.md R-002
- [X] T004 Create empty module skeletons: `apps/api/app/routes/support_purchases.py`, `apps/api/app/schemas/support_purchases.py`, `apps/api/app/services/support_purchases.py`, `apps/api/app/services/payment_providers.py`
- [X] T005 [P] Add backend environment configuration entries (Stripe secret/publishable/webhook-signing keys, Apple App Store Server API credentials, Google Play service-account credentials) to `apps/api/app/core/config.py`'s `Settings`, following the existing `SUPABASE_*` secret-handling pattern
- [X] T006 [P] Add the backend static tier configuration (three preset tiers: id, label, per-channel provider/store product-price id) as a small config module referenced by `services/support_purchases.py`, per research.md R-004

**Checkpoint**: New domain files exist; no behavior implemented yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `support_purchases` table, RLS, and the isolation/idempotency
guarantees every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Write the additive migration `supabase/migrations/<timestamp>_support_purchases.sql` creating `public.support_purchases` exactly per data-model.md (columns, checks, no `workspace_id`, no FK to `workspaces`)
- [X] T008 In the same migration, add `unique (channel, provider_transaction_id)` and enable RLS with the `SELECT ... using (user_id = auth.uid())` policy per data-model.md; leave INSERT/UPDATE/DELETE denied for `authenticated`
- [X] T009 [P] Add a schema-level test asserting `support_purchases` has no `workspace_id` column and no FK to `public.workspaces` in `apps/api/tests/test_support_purchases_isolation.py` per `contracts/isolation-and-scope.md`
- [X] T010 [P] Add a static query-surface check (grep/import assertion) confirming `services/dashboard.py`, `services/reports.py`, and `services/history.py` never reference `support_purchases`, in `apps/api/tests/test_support_purchases_isolation.py`
- [X] T011 Implement `apps/api/app/services/payment_providers.py`: Stripe Checkout-session creation, Stripe webhook signature verification, Apple JWS notification verification, Google Play notification/purchase verification (research.md R-001–R-003; `contracts/webhooks-and-idempotency.md`)
- [X] T012 Implement the core state-machine functions in `apps/api/app/services/support_purchases.py` (`create_pending`, `mark_completed`, `mark_failed`, `mark_refunded`), each scoped by `user_id` and enforcing the `pending → completed|failed`, `completed → refunded` transition rules from data-model.md, using the DB unique constraint for idempotency
- [X] T013 Add unit tests for the state machine in `apps/api/tests/test_support_purchases_state.py`: valid transitions, invalid transitions rejected, duplicate `(channel, provider_transaction_id)` is a no-op not a new row

**Checkpoint**: Table, isolation guarantee, and verified state machine exist — user stories can begin.

---

## Phase 3: User Story 1 - Optional support purchase on the web (Priority: P1) 🎯 MVP

**Goal**: A signed-in user selects a preset tier, completes payment on a
Stripe-hosted Checkout page, and returns to a correct, provider-verified
success state and receipt, with zero effect on workspace totals.

**Independent Test**: As a signed-in user, select a tier, complete a Stripe
test-mode payment, confirm the redirect result is `pending` until the test
webhook lands and then `completed`, and confirm workspace dashboard/report
totals are unchanged before and after.

### Tests for User Story 1

- [X] T014 [P] [US1] Contract test: `GET /support-purchases/tiers` returns the three configured tiers in `apps/api/tests/test_support_purchases_api.py`
- [X] T015 [P] [US1] Contract test: `POST /support-purchases/checkout-sessions` creates a `pending` row and a **one-time (`mode=payment`, not `subscription`)** Stripe Checkout Session URL for a valid preset `tier_id`, rejects an unknown/non-preset `tier_id` with no row created, and rejects unauthenticated requests, in `apps/api/tests/test_support_purchases_api.py` (FR-005, FR-006)
- [X] T016 [P] [US1] Contract test: `POST /support-purchases/webhooks/stripe` with a valid signed test event moves the matching purchase to `completed`; an invalid signature is rejected and causes no transition, in `apps/api/tests/test_support_purchases_webhooks.py`
- [X] T017 [P] [US1] Integration test: workspace dashboard and report totals are byte-for-byte unchanged before/after a completed web support purchase, in `apps/api/tests/test_support_purchases_isolation.py`

### Implementation for User Story 1

- [X] T018 [US1] Implement `GET /support-purchases/tiers` in `apps/api/app/routes/support_purchases.py` per `contracts/support-purchases-api.md`
- [X] T019 [US1] Implement `POST /support-purchases/checkout-sessions` in `apps/api/app/routes/support_purchases.py`, calling `payment_providers.create_stripe_checkout_session` and `services/support_purchases.create_pending`
- [X] T020 [US1] Implement `POST /support-purchases/webhooks/stripe` in `apps/api/app/routes/support_purchases.py`, verifying the Stripe signature and calling `mark_completed`/`mark_failed`/`mark_refunded` as appropriate
- [X] T021 [US1] Add the typed web API client `apps/web/lib/api/support-purchases.ts` (list tiers, start checkout session, get history, get receipt)
- [X] T022 [P] [US1] Build `apps/web/components/settings/SupportPurchaseCard.tsx` (non-charitable framing, entry point) and `apps/web/components/settings/SupportTierSelector.tsx` (preset tier picker)
- [X] T023 [US1] Build the support entry route `apps/web/app/[locale]/(app)/settings/support/page.tsx` that redirects the browser to the returned Stripe Checkout URL
- [X] T024 [US1] Build the post-checkout result route `apps/web/app/[locale]/(app)/settings/support/result/page.tsx` that polls/re-fetches purchase status and renders success/pending/failed states without trusting redirect query params as proof of payment (FR-011, FR-016)
- [X] T025 [US1] Add an unauthenticated-visitor redirect-to-sign-in guard on the support entry point (FR-007)
- [X] T026 [US1] Add Playwright e2e coverage in `apps/web/e2e/` for: tier selection → Stripe test-mode redirect → success/receipt render, and cancel → returns to a retryable non-success state
- [X] T026a [P] [US1] Add a static audit test asserting no payment-card input element (e.g., a card-number/CVC field) is ever rendered by any `apps/web` component in the support-purchase flow, in `apps/web/e2e/` or `apps/web/tests/unit/` (FR-009), mirroring the mobile audit in T033

**Checkpoint**: A user can complete a web support purchase end-to-end with zero effect on workspace totals — MVP reachable.

---

## Phase 4: User Story 2 - Optional support purchase in the mobile app (Priority: P1)

**Goal**: A signed-in user of the Phase 16 Android/iOS apps completes the
same preset-tier purchase through Google Play Billing / Apple In-App
Purchase, verified server-side before showing success.

**Independent Test**: On Android and iOS, select a preset tier, complete a
sandbox purchase through the platform's native billing UI, confirm the app
shows `pending` until backend verification succeeds and then a correct
success/receipt state, and confirm the same purchase appears in web history
for the same account.

### Tests for User Story 2

- [X] T027 [P] [US2] Contract test: `POST /support-purchases/mobile/verify` creates a `pending` row keyed by `(channel, provider_transaction_id)` and only transitions to `completed` after successful Apple/Google server-side verification, in `apps/api/tests/test_support_purchases_api.py`
- [X] T028 [P] [US2] Native test: Android sandbox purchase flow (tier selection → Play Billing purchase → backend verify call) in `apps/mobile/e2e/support-purchase-android.spec.*`
- [X] T029 [P] [US2] Native test: iOS sandbox purchase flow (tier selection → StoreKit purchase → backend verify call) in `apps/mobile/e2e/support-purchase-ios.spec.*`

### Implementation for User Story 2

- [X] T030 [US2] Implement `POST /support-purchases/mobile/verify` in `apps/api/app/routes/support_purchases.py`, calling the Apple/Google verification helpers in `services/payment_providers.py`
- [X] T031 [US2] Implement `apps/mobile/src/native/billing.ts`: list tiers (reusing the web API client's response shape), initiate a platform purchase for a `tier_id`, and call the verify endpoint with the resulting purchase token/transaction id
- [X] T032 [US2] Wire the support entry point UI (reused `SupportPurchaseCard`/`SupportTierSelector` from US1) to route through `apps/mobile/src/native/billing.ts` when running inside Capacitor, else the web checkout path (mirrors the Phase 16 native-capability-shim pattern)
- [X] T033 [US2] Ensure no payment-card input field is ever rendered by `apps/mobile` for this flow (verified by a static UI-audit test alongside T028/T029)
- [X] T034 [US2] Confirm a purchase made on Android or iOS appears in `GET /support-purchases` history when the same user is signed in on the web (account-scoped, not device-scoped) — integration test in `apps/api/tests/test_support_purchases_api.py`

**Checkpoint**: Support purchases work identically across web, Android, and iOS, all account-scoped and server-verified.

---

## Phase 5: User Story 3 - Correct pending / failed / refunded states (Priority: P2)

**Goal**: Every non-completed purchase state (abandoned checkout, failed
payment, pending store purchase, provider/store-issued refund) renders
correctly, and refunds apply automatically from a verified notification with
no in-app refund action.

**Independent Test**: Trigger a Stripe checkout cancellation, a simulated
payment failure, a store sandbox purchase left pending, and a test refund
notification; confirm each renders its own correct state with no false
success and no crash.

### Tests for User Story 3

- [ ] T035 [P] [US3] Test: abandoned/expired Stripe Checkout Session never shows as `completed` and remains retryable, in `apps/api/tests/test_support_purchases_webhooks.py`
- [ ] T036 [P] [US3] Test: a Stripe/Apple/Google failure signal moves a purchase to `failed` with a safe, non-technical `failure_reason`, in `apps/api/tests/test_support_purchases_webhooks.py`
- [ ] T037 [P] [US3] Test: a verified refund notification (Stripe, Apple `REFUND`, Google void) moves a `completed` purchase to `refunded` with no in-app action, and a `refunded` purchase changes no feature/limit/permission, in `apps/api/tests/test_support_purchases_webhooks.py`
- [ ] T037a [P] [US3] Test: an Apple notification with an invalid/untrusted JWS signature and a Google notification/verification call that fails authenticity checks are both rejected with no state transition, in `apps/api/tests/test_support_purchases_webhooks.py` (FR-025 — extends T016's Stripe-only signature coverage to all three providers)
- [ ] T038 [P] [US3] Test: a redelivered/duplicate notification for an already-`completed` or already-`refunded` purchase is a safe no-op (no duplicate row, no repeated transition), in `apps/api/tests/test_support_purchases_webhooks.py`

### Implementation for User Story 3

- [ ] T039 [US3] Implement Checkout Session expiry/cancellation handling in `payment_providers.py` / `services/support_purchases.py` so an abandoned session resolves to `failed` rather than lingering as `pending` indefinitely
- [ ] T040 [US3] Implement the Apple `REFUND` and Google void/refund notification paths in `payment_providers.py`, calling `mark_refunded`
- [ ] T041 [US3] Render the four purchase states distinctly (`pending`, `completed`, `failed` with safe message, `refunded`) in `apps/web/components/settings/SupportPurchaseHistory.tsx` and the result route from T024
- [ ] T042 [US3] Add an integration test confirming a purchase in **every** state — `pending`, `completed`, `failed`, and `refunded` — leaves the affected user's role, permissions, feature access, and usage limits completely unchanged (not only the refunded case), in `apps/api/tests/test_support_purchases_isolation.py` (FR-001, FR-003, FR-019)

**Checkpoint**: All four purchase states are correct, provider-verified, and never imply a false success or affect product access.

---

## Phase 6: User Story 4 - Support-purchase history and receipts (Priority: P3)

**Goal**: A user can view all their support purchases across channels with
date, tier, channel, and state, and open a receipt for a completed purchase.

**Independent Test**: With completed, pending/failed, and refunded test
purchases across channels for one user, open history and confirm each row
and the completed purchase's receipt render correctly; confirm a second
user sees none of it.

### Tests for User Story 4

- [ ] T043 [P] [US4] Contract test: `GET /support-purchases` returns only the current user's own purchases across all channels, newest first, in `apps/api/tests/test_support_purchases_api.py`
- [ ] T044 [P] [US4] Contract test: `GET /support-purchases/{id}/receipt` returns receipt data for the owner's own `completed` purchase and is denied for another user's purchase or a non-`completed` purchase, in `apps/api/tests/test_support_purchases_api.py`
- [ ] T045 [P] [US4] RLS test: User B cannot read User A's `support_purchases` rows via direct query or the API, in `apps/api/tests/test_support_purchases_isolation.py`

### Implementation for User Story 4

- [ ] T046 [US4] Implement `GET /support-purchases` and `GET /support-purchases/{id}/receipt` in `apps/api/app/routes/support_purchases.py` per `contracts/support-purchases-api.md`
- [ ] T047 [US4] Build `apps/web/components/settings/SupportPurchaseHistory.tsx` (list, empty state) and `apps/web/components/settings/SupportReceiptView.tsx` (receipt + link to the provider's/store's own receipt where available)
- [ ] T048 [US4] Wire the mobile billing bridge (`apps/mobile/src/native/billing.ts`) and its UI to call the same history/receipt endpoints, confirming cross-channel visibility (no mobile-only history contract)

**Checkpoint**: A user's support-purchase history and receipts are complete, correct, and account-scoped across every channel.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Wording compliance, release documentation, and the full
regression gate.

- [ ] T049 [P] Add a copy-lint/grep check scanning all new translation-key files and UI strings for "donate"/"donation"/charitable-fundraising language, failing the build on any match (FR-002, SC-007)
- [ ] T050 [P] Write `docs/support-purchases-compliance-notes.md`: a living, dated checklist for Stripe/Apple/Google commission percentages, tax handling, regional billing rules, and refund windows, verified against current terms (explicitly not hard-coded per the constitution)
- [ ] T051 Run the full existing backend `pytest`, web Vitest/Playwright, and mobile native suites unmodified; confirm zero regression in financial-accuracy, role-permission, or tenant-isolation assertions (SC-010)
- [ ] T052 Execute the manual sweep from quickstart.md: live Stripe test-mode checkout end-to-end, live Apple sandbox purchase, live Google Play internal-testing sandbox purchase

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational completion.
  - US1 (Phase 3) and US2 (Phase 4) are both P1 and share the backend domain
    built in Phase 2; US2 additionally depends on US1's tier-selector UI
    (T022) being reusable, but not on US1's Stripe-specific routes.
  - US3 (Phase 5) depends on US1 and US2 existing (it refines the states
    both channels produce).
  - US4 (Phase 6) depends on US1/US2 (there must be purchases to show).
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel.
- T009/T010 (isolation tests) can run in parallel with T011/T012 once the
  migration (T007/T008) lands.
- Within each user story, contract/integration tests marked [P] can run in
  parallel with each other before implementation begins.
- US1 (Phase 3) and US2 (Phase 4) can be staffed in parallel once Phase 2 is
  checkpointed, since they touch different route handlers and different
  client boundaries (`apps/web` vs. `apps/mobile`) atop the same service
  layer.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (web support purchase)
4. **STOP and VALIDATE**: Confirm a web support purchase completes correctly
   and workspace totals are unaffected
5. Proceed to US2 (mobile) once the web MVP is validated

### Incremental Delivery

1. Setup + Foundational → domain and isolation guarantee ready
2. US1 (web) → validate independently
3. US2 (mobile) → validate independently, confirm cross-channel history
4. US3 (states/refunds) → validate all four states and refund reflection
5. US4 (history/receipts) → validate the complete user-facing view
6. Polish → wording compliance, compliance doc, full regression gate

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- No task in this list creates, modifies, or reads `incomes`, `expenses`,
  `categories`, or any workspace-scoped financial table — this is
  intentional and enforced by `contracts/isolation-and-scope.md`.
- This tasks.md describes future implementation work; `/speckit-implement`
  is explicitly **not** run as part of this phase.
