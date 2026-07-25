# Mobile privacy and data-safety declaration

**Owner:** release manager and privacy owner  
**Last reconciled:** 2026-07-25; sources are in store-requirements-verification.md.

## Mandatory release blocker: public privacy policy

The repository does not identify a production public web origin and does not currently expose an in-app privacy-policy link. Before either store submission, publish a comprehensive policy at a stable HTTPS URL and replace this template in both consoles:

https://<PUBLIC_WEB_ORIGIN>/privacy

The policy must name the listed developer or Smart Expense AI, be accessible without sign-in, be linked within the app, and disclose the practices below. A placeholder URL, repository path, or policy omitting optional AI processing must not be submitted.

## Product data facts

| Data | Purpose and handling |
| --- | --- |
| Account email, Supabase user ID, optional display name | Sign-in, account/workspace membership, and identity. Sent to Supabase and the existing backend. Session tokens persist only in iOS Keychain / Android Keystore-backed storage. Authorised workspace members may see member email/display name where the product exposes it. |
| Workspace membership, roles, settings, activity history | Access control and workspace operation. Sent to and stored by the existing backend/Supabase; device cache is memory-only and backend/RLS controls access. |
| Income, expenses, categories, report inputs/outputs | Core financial record keeping and backend-authoritative reporting. Sent to/stored by the existing backend/Supabase, never persistently stored by the app on device. |
| Receipt/invoice images, photos, PDFs, filenames, metadata | Private upload and optional extraction. Sent to private backend/Supabase storage. Native capture creates an in-memory File and does not save to gallery/filesystem. If the user starts optional AI extraction, the relevant content/context is sent to the user's selected OpenAI or Gemini provider. |
| Optional user-supplied AI provider key | Submitted to the backend and stored server-side in Supabase Vault. It is never returned to or persistently stored by the mobile app. |
| Device session token | Secure session continuity only; cleared at sign-out/expiry. Android backup is disabled; iOS Keychain uses a this-device-only accessibility setting. |

The reviewed build has no ads, analytics SDK, crash-reporting SDK, tracking/advertising identifier, location, contacts, microphone, payment-card handling, or in-app purchase. Re-audit every dependency before submission.

## Apple App Privacy working map

Declare every data type in the submitted build and answer the live linkage, tracking, and purpose questions accurately.

| Apple data type | Collected | Linked | Purpose |
| --- | --- | --- | --- |
| Contact Information: Email Address; Name when supplied | Yes | Yes | App functionality; account management |
| Identifiers: User ID | Yes | Yes | App functionality; account management |
| Financial Information | Yes | Yes | App functionality |
| User Content: applicable receipt/invoice photos, files, and other user content | Yes when uploaded | Yes | App functionality; optional user-requested AI extraction |
| Purchases, location, contacts, browsing/search history, diagnostics, usage, advertising data | No in the reviewed build | — | — |

Declare no tracking unless a future build adds Apple's defined cross-app/cross-site tracking. Verify live Apple labels and selected-AI-provider treatment before publish; never reduce a declaration just because a service provider is involved.

## Google Play Data safety working map

Play generally treats data transmitted off-device as collected. Complete the form for all currently distributed artifacts and audit every SDK.

| Play data type | Collected | Shared | Purpose | Required? |
| --- | --- | --- | --- | --- |
| Personal info: email address; name when supplied | Yes | No, except authorised workspace visibility | Account management; app functionality | Email yes for account; name optional |
| Personal info: user IDs | Yes | No | Account management; app functionality | Yes after account creation |
| Financial info | Yes | No | App functionality | User-provided to use feature |
| Photos and videos; Files and docs | Yes when receipt/invoice uploaded | Yes to selected AI provider only when the user explicitly starts optional AI extraction; otherwise no external sharing beyond service providers operating the app | App functionality; optional extraction | Optional |
| App activity, device IDs, location, contacts, messages, audio, payment-card/bank data | No in reviewed build | No | — | — |

Set production transport-security answers only after confirming every production API, Supabase, and AI endpoint uses HTTPS. Do not declare account-creation compliance until the app offers and verifies a clear account-deletion path, required by Google Play for account-creation apps.

## Final audit

- [ ] Publish and test the public HTTPS policy without authentication.
- [ ] Link the same policy from the shipped app.
- [ ] Verify the account-deletion path/request.
- [ ] Audit production SDKs, endpoints, Supabase settings, and enabled AI providers.
- [ ] Reconcile live form labels, purposes, linkage, optionality, security, and sharing with final binary and policy.
