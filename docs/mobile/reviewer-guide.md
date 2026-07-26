# Store reviewer access guide

**Use for:** Apple App Review information and Google Play App access. Keep actual credentials only in the store console or an approved secret manager — never in git, screenshots, tickets, or email.

## Access configuration

Core functionality requires authentication. Before submission, create a dedicated active review account in production Supabase and enter this only in both store consoles:

Review account email: <STORE_REVIEW_ACCOUNT_EMAIL>  
Review account password: <STORE_REVIEW_ACCOUNT_PASSWORD>  
Sign-in method: email and password

The account must be an Owner of a dedicated review workspace with synthetic, non-sensitive data. It must remain active throughout review and require no one-time code, real-user device, paid entitlement, invite, separate app, or optional AI-provider key. Email/password is the current enabled method; do not instruct reviewers to use an unavailable provider.

## Reviewer path

1. Install and open Smart Expense AI. It launches locally bundled assets; network is needed for account and financial data.
2. At Sign in, use the dedicated review account. English launches by default; Arabic is selected in Settings and displays RTL.
3. On Dashboard, review synthetic income, expense, remaining-balance, recent-record, and category data.
4. In Expenses, add, edit, and delete a small synthetic expense. In Incomes, add, edit, and delete a synthetic income. The review account is an Owner.
5. Open Categories and Reports to review category management and backend-provided totals.
6. Open Files or receipt attachment. Tap camera capture, allow while-in-use access, capture a non-sensitive sample, preview it, then upload it. Gallery/PDF selection also works.
7. Optional: start receipt extraction only if the review workspace has a permitted test AI-provider setup. Manual income and expense entry works fully without an AI key.
8. Switch to Arabic in Settings, then sign out to verify return to sign-in.

## Review notes

- The app is free: no payment, subscription, trial, advertising, or IAP flow.
- Native functions are camera capture, Keychain/Keystore-backed sessions, deep-link handling, status/safe-area handling, and a locally bundled shell.
- Financial records and permissions remain backend-authoritative. Offline mode is read-only and never queues/replays writes.
- If camera permission was previously denied, re-enable it in device settings and repeat step 6.

## Submission checks

- [ ] Test these exact credentials on each submitted iOS and Android build.
- [ ] Enter credentials and instructions in Apple App Review Information and Google Play App access.
- [ ] Confirm no MFA, payment, regional, invitation, or time restriction blocks review.
- [ ] Rotate/revoke the review password and remove the review workspace according to retention policy after review.
