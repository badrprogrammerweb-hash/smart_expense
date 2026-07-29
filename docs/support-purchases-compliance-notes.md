# Support Purchases Compliance Notes

**Document type:** Living release checklist; not application logic
**Created:** 2026-07-28
**Last document review:** 2026-07-28
**Responsible owner:** Product/Operations — named individual not yet assigned
**Review status:** Draft; production release blocked pending the unchecked items below
**Next review:** Before every production release, after any provider/regulator
notice, and at the recurring cadence approved by the responsible owner

> This document is operational guidance, not legal, tax, or accounting
> advice. Commission percentages, service fees, tax rules, refund periods,
> regional availability, product classifications, and provider policies may
> change. They must not be treated as permanent constants in application
> code. Needs current provider-policy verification before production release.

## How to maintain this checklist

- Assign a named owner and reviewer before release.
- Review only current, official provider or regulator sources. Record the
  review date, source version/effective date when one is published, account
  program, legal entity, storefront/region, conclusion, and reviewer.
- Store signed agreements, tax advice, and account-specific provider terms in
  the approved restricted compliance repository, not in this public project.
- Replace placeholders with dated conclusions only after the responsible
  specialist reviews the exact production account and target regions.
- Open a reviewed code/configuration change if a policy finding affects
  product behavior. Do not encode a percentage, tax rate, refund window, or
  regional rule in the application merely because it appears in this file.
- Keep prior conclusions in version history and add a dated change note below.

## Current release status

| Area | Responsible owner | Status | Last source review | Release note |
|---|---|---|---|---|
| Stripe | Payments owner — unassigned | Blocked | 2026-07-28 | Needs current account, country, pricing, tax, and refund-policy verification before production release. |
| Apple App Store | iOS/App Store owner — unassigned | Blocked | 2026-07-28 | Needs current Paid Apps Agreement, product classification, storefront, tax, fee, and refund verification. |
| Google Play | Android/Play owner — unassigned | Blocked | 2026-07-28 | Needs current Payments policy, service-fee program, country, tax, and refund verification. |
| Saudi/regional tax and billing | Finance/legal owner — unassigned | Blocked | 2026-07-28 | Needs advice for the production legal entity, customer locations, invoicing, VAT, and record retention. |
| Provider sandbox sweep | Release owner — unassigned | Blocked | Not run | Follow `specs/017-product-support-purchases/quickstart.md`; live accounts/devices are required. |
| Regression gate | QA owner — unassigned | Passed | 2026-07-28 | T051 complete; recorded results in `specs/017-product-support-purchases/quickstart.md`. Release remains blocked by the provider sandbox sweep (T052). |

## Stripe

**Owner:** Payments owner — unassigned
**Status:** Blocked
**Last source review:** 2026-07-28 (official documentation page content and
link availability only; production-account applicability not verified)

- [ ] Confirm that the production legal entity and target customer regions
  are eligible for the intended Stripe account and payment methods.
- [ ] Confirm the production support tiers use one-time hosted Checkout
  Sessions and the approved price identifiers; no subscription price exists.
- [ ] Review the production account's current pricing, currency settlement,
  cross-border treatment, payout, dispute, refund, and service-fee terms.
- [ ] Decide with tax/legal owners whether Stripe Tax or another process is
  required; document the account-specific decision outside application code.
- [ ] Confirm the hosted Checkout presentation and business descriptor are
  accurate, optional, non-charitable, and do not imply product entitlement.
- [ ] Confirm webhook endpoints, signing-secret rotation, event retention,
  and operational alert ownership for completion, expiry/failure, and full
  refund events.
- [ ] Confirm partial-refund behavior remains consistent with the product
  contract: a partial refund must not mark the entire purchase refunded.
- [ ] Complete the Stripe test-mode checklist in the quickstart.

**Current conclusion:** Needs current provider-policy verification before
production release. No commission percentage, tax rate, regional
availability conclusion, or refund period is approved by this document.

## Apple App Store

**Owner:** iOS/App Store owner — unassigned
**Status:** Blocked
**Last source review:** 2026-07-28 (official documentation page content and
link availability only; the production agreement/account was not reviewed)

- [ ] Have the Account Holder review and accept the current Paid Apps
  Agreement for the exact production legal entity.
- [ ] Confirm App Review accepts the proposed optional, repeatable,
  one-time support product classification and copy; record the review outcome.
- [ ] Confirm every Apple product identifier, price, tax category,
  storefront availability, and localized product name in App Store Connect.
- [ ] Review the exact account's current proceeds/commission program,
  banking, withholding, tax forms, and any Saudi storefront treatment.
- [ ] Confirm the current refund-request path and any cancellation or
  revocation behavior applicable to the configured one-time product type.
- [ ] Confirm App Store Server Notifications V2 production and sandbox URLs,
  certificate-chain verification material, notification retention, and
  operational ownership.
- [ ] Verify the backend's transaction ID/original transaction ID correlation
  against an actual sandbox purchase and refund/revocation notification.
- [ ] Complete the Apple sandbox checklist in the quickstart.

**Current conclusion:** Needs current provider-policy verification before
production release. No commission percentage, tax treatment, storefront
availability conclusion, or refund period is approved by this document.

## Google Play

**Owner:** Android/Play owner — unassigned
**Status:** Blocked
**Last source review:** 2026-07-28 (official documentation page content and
link availability only; the production agreement/account was not reviewed)

- [ ] Review the current Google Play Payments policy for the exact product
  presentation, distribution countries, and production developer account.
- [ ] Confirm the three one-time products, price templates, tax settings,
  localized listings, and country availability in Play Console.
- [ ] Review the production account's current service-fee program,
  payout profile, tax forms, withholding, and regional rules.
- [ ] Confirm internal-testing eligibility, license testers, package name,
  app-account ownership binding, and Google Play Developer API permissions.
- [ ] Confirm the Pub/Sub subscription, authenticated push identity/audience,
  one-time-product notifications, voided-purchase notifications, retention,
  and operational alert ownership.
- [ ] Confirm the currently applicable user/developer refund process and the
  behavior of full versus partial refunds for the configured product.
- [ ] Verify that purchase tokens remain backend-only in responses, logs,
  screenshots, support tickets, and test evidence.
- [ ] Complete the Google Play internal-testing checklist in the quickstart.

**Current conclusion:** Needs current provider-policy verification before
production release. No service-fee percentage, tax treatment, country
availability conclusion, or refund period is approved by this document.

## Taxes and VAT

**Owner:** Finance/tax owner — unassigned
**Status:** Blocked
**Last source review:** 2026-07-28 (official ZATCA guidance located; no legal
entity or transaction analysis performed)

- [ ] Obtain qualified advice for the production legal entity and every
  intended customer region.
- [ ] Determine the supply classification, place-of-supply treatment,
  registration obligations, collection/remittance responsibilities, and
  whether the provider/store acts as merchant, agent, or marketplace for the
  relevant channel and region.
- [ ] Determine invoice/receipt requirements, Arabic content requirements,
  electronic-invoicing applicability, evidence retention, and reconciliation
  obligations.
- [ ] Confirm whether displayed prices include applicable taxes in each
  provider/store channel and how provider settlement reports evidence them.
- [ ] Document approved accounting treatment for gross proceeds, provider
  deductions, refunds, chargebacks, taxes, and payouts outside workspace
  financial records.
- [ ] Record the advice date, adviser, jurisdictions, assumptions, and next
  review trigger in the restricted compliance record.

**Current conclusion:** Needs current legal and tax verification before
production release. This repository contains no legal conclusion or tax
rate.

## Saudi and regional billing considerations

**Owner:** Saudi market legal/operations owner — unassigned
**Status:** Blocked

- [ ] Confirm that each provider/store and selected payment method is
  available to the production legal entity and customers in Saudi Arabia and
  every launch region.
- [ ] Confirm SAR presentation/settlement, customer disclosures, business
  identity, terms, privacy notice, refund contact path, and consumer
  protection obligations.
- [ ] Confirm cross-border settlement, withholding, banking, and data
  transfer/retention requirements with qualified owners.
- [ ] Confirm Arabic/English parity and RTL/LTR rendering for required
  customer-facing disclosures.
- [ ] Record any country-specific exception as release configuration and
  reviewed documentation, never as an assumed universal rule.

**Current conclusion:** Needs current provider-policy and regional legal
verification before production release.

## Commissions and service fees

**Owner:** Finance/commercial owner — unassigned
**Status:** Blocked

| Channel | Applicable program/account | Current percentage or fee | Effective date | Verified by | Status |
|---|---|---|---|---|---|
| Stripe | To be determined from production account | Not recorded | Not verified | Unassigned | Needs current provider-policy verification before production release. |
| Apple | To be determined from signed production agreement | Not recorded | Not verified | Unassigned | Needs current provider-policy verification before production release. |
| Google Play | To be determined from production account/program | Not recorded | Not verified | Unassigned | Needs current provider-policy verification before production release. |

Do not copy a value from a marketing page into code. The responsible owner
must reconcile the signed agreement/account dashboard, tax treatment,
currency, country, product type, program enrollment, and effective date.

## Refund and cancellation windows

**Owner:** Customer operations/legal owner — unassigned
**Status:** Blocked

| Channel | User request route | Cancellation/expiry behavior | Refund window | Last verified | Status |
|---|---|---|---|---|---|
| Stripe | Provider/business process to be approved | Checkout expiry and payment failure are provider-verified | Not recorded | Not verified | Needs current provider-policy verification before production release. |
| Apple | Apple's current request/refund process | Depends on current store decision and notification | Not recorded | Not verified | Needs current provider-policy verification before production release. |
| Google Play | Google's/developer's current refund process | Depends on purchase state and current policy | Not recorded | Not verified | Needs current provider-policy verification before production release. |
| Saudi/regional law | Qualified counsel to define | Jurisdiction-specific | Not recorded | Not verified | Needs current legal verification before production release. |

The application reflects only verified provider outcomes. It does not offer
an in-app refund endpoint. Do not publish a user-facing period until the
responsible owner approves the current provider and legal basis.

## Required periodic re-verification

- [ ] Before every production release, re-open every source in the register
  and compare it with the last recorded conclusion.
- [ ] Re-check immediately after a provider agreement, price, service-fee,
  tax, billing-policy, country-availability, refund, server-notification, or
  security notice.
- [ ] Even without a release or notice, review on the recurring cadence set
  by the named compliance owner; record that cadence and the next due date
  here once approved.
- [ ] Re-check production account dashboards and signed agreements, because
  public help pages may not describe account-specific terms.
- [ ] Re-run the regression and manual provider gates after a finding causes
  code, configuration, catalog, webhook, or copy changes.

**Approved recurring cadence:** Not yet assigned — release blocker
**Next due date:** Before production release; calendar date not yet assigned

## Source links and last-verified dates

“Reviewed” below means the official page was opened and its subject matter
was checked on the listed date. It does **not** mean the production account,
agreement, percentage, legal interpretation, or regional applicability was
approved.

| Authority | Source | Purpose | Last link/content review | Verification status |
|---|---|---|---|---|
| Stripe | [Stripe-hosted Checkout](https://docs.stripe.com/payments/checkout) | Hosted Checkout capability and one-time flow | 2026-07-28 | Page reviewed; production configuration unresolved |
| Stripe | [Checkout fulfillment and webhooks](https://docs.stripe.com/checkout/fulfillment) | Server-side event handling and test-mode listener | 2026-07-28 | Page reviewed; production endpoint unresolved |
| Stripe | [Refunds and cancellations](https://docs.stripe.com/refunds) | Provider refund behavior | 2026-07-28 | Page reviewed; account/legal policy unresolved |
| Stripe | [Stripe pricing](https://stripe.com/pricing) | Account/country pricing starting point | 2026-07-28 | Needs account- and region-specific verification |
| Apple | [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) | In-App Purchase and review requirements | 2026-07-28 | Page reviewed; product review outcome unresolved |
| Apple | [In-App Purchase overview](https://developer.apple.com/in-app-purchase/) | StoreKit, server, and testing overview | 2026-07-28 | Page reviewed; account configuration unresolved |
| Apple | [Set an In-App Purchase price](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/set-a-price-for-an-in-app-purchase/) | Storefront pricing and tax-aware configuration | 2026-07-28 | Page reviewed; production prices unresolved |
| Apple | [Sign and update agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/) | Paid Apps Agreement | 2026-07-28 | Production agreement not reviewed |
| Apple | [App Store Server Notifications](https://developer.apple.com/documentation/AppStoreServerNotifications) | Verified purchase/refund notifications | 2026-07-28 | Page reviewed; live endpoint unresolved |
| Google | [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738) | Billing-policy requirements | 2026-07-28 | Page reviewed; account/region applicability unresolved |
| Google | [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622) | Service-fee program starting point | 2026-07-28 | No percentage approved; account program unresolved |
| Google | [Manage orders and refunds](https://support.google.com/googleplay/android-developer/answer/2741495) | Developer refund operations | 2026-07-28 | Page reviewed; approved customer policy unresolved |
| Google | [Real-time developer notifications](https://developer.android.com/google/play/billing/rtdn-reference) | Purchase/refund notification behavior | 2026-07-28 | Page reviewed; production Pub/Sub unresolved |
| Google | [Test Google Play Billing](https://developer.android.com/google/play/billing/test) | License/internal testing | 2026-07-28 | Manual test not run |
| ZATCA | [VAT guidelines and resources](https://zatca.gov.sa/en/RulesRegulations/VAT/Pages/default.aspx) | Saudi VAT source starting point | 2026-07-28 | Qualified tax review not performed |

## Release-blocking checklist

- [ ] Assign named responsible owners and a final release approver.
- [ ] Resolve every Blocked entry above with dated evidence.
- [ ] Obtain legal/tax/accounting approval for the production legal entity
  and target regions.
- [ ] Confirm current signed Stripe/Apple/Google account terms, fees, taxes,
  regional availability, and refund handling.
- [ ] Confirm provider catalogs, prices, product classifications, and
  customer-facing copy in each production dashboard.
- [ ] Confirm all provider secrets, private keys, JWS data, purchase tokens,
  and webhook payloads remain backend-only and out of logs/evidence.
- [ ] Record successful T051 full regression results using the exact commands
  in the quickstart.
- [ ] Record successful T052 Stripe, Apple, and Google manual sandbox sweeps
  using real authorized accounts and devices.
- [ ] Verify workspace finances, roles, permissions, features, and limits are
  unchanged for every support-purchase state.
- [ ] Verify there are no in-app payment-card fields, recurring products,
  paid entitlements, or charitable framing.
- [ ] Approve a next re-verification date and calendar owner.

Release remains blocked while any required item is unchecked.

## Change log

| Date | Author/owner | Change | Follow-up |
|---|---|---|---|
| 2026-07-28 | Implementation team; compliance owner unassigned | Created the living checklist and official-source register without recording unverified rates or legal conclusions. | Assign owners, verify production accounts/regions, complete T051 and T052. |
