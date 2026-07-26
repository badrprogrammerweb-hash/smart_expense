# Contract: Store Readiness

**Type**: Compliance / documentation contract (not an HTTP API). Binding for the
release gate.

## Purpose

Define what each store submission must contain to pass review and ship free,
without expanding scope beyond the constitution.

## Rules

1. **Truthful listings (both locales)**: Each store listing (title, description,
   screenshots, category, content rating) MUST be complete and truthful in Arabic
   and English and MUST declare the app **free with no in-app purchases**.
2. **Privacy & data-safety accuracy**: Privacy-policy link and data-safety /
   privacy-nutrition declarations MUST accurately reflect what the app stores on
   device (secure session only) and transmits (to the existing backend/Supabase),
   with no undisclosed collection.
3. **Reviewer access**: A sign-in path (credentials or instructions) MUST let a
   store reviewer exercise core functionality.
4. **Minimum functionality (Apple 4.2 / Google Play policy)**: The app MUST
   demonstrate genuine native functionality — camera capture, secure on-device
   storage, and a locally-bundled installable shell — sufficient to clear
   minimum-functionality review. This MUST be achieved through those genuine
   integrations, NOT by adding features outside constitution scope.
5. **No billing surface**: No in-app purchase, subscription, or payment surface
   is present (Phase 17 defers all billing).
6. **Reproducible release**: Developer-account setup, signing/key management,
   version numbering, and staged/test-track rollout MUST be documented and
   reproducible. Developer-account memberships are an organizational dependency,
   not a user-facing charge.
7. **Verify at submission time**: Exact store requirements, review guidelines,
   and data-safety form fields MUST be verified against current store
   documentation at implementation time (they change independently of this spec).

## Verification

- Both submissions reviewed against current Google Play and App Store
  requirements: listings/metadata/declarations complete and truthful; free/no-IAP
  declared; reviewer guidance present.
- The app demonstrates camera capture, secure storage, and local-shell behaviour
  to reviewers.
- A maintainer reproduces a submission for either platform from the
  `release-runbook.md` with no undocumented steps.
