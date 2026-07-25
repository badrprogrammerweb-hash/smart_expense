# Mobile release runbook

This runbook releases the Capacitor package com.smartexpense.ai as a free iOS and Android app. It does not use a remote WebView shell, billing surface, or over-the-air bundle update path.

## Prerequisites

- Organisation-owned Apple Developer Program account, appropriate App Store Connect roles, completed agreements and required organisation/contact information.
- Organisation-owned Google Play account, required identity verification, completed payments-profile details, least-privilege access, and two-step verification.
- Store records for package/bundle ID com.smartexpense.ai.
- A public HTTPS privacy policy, in-app policy link, account-deletion path, and reviewer account as defined in privacy-data-safety.md and reviewer-guide.md.
- Production FastAPI, Supabase, auth redirect, and CORS configuration verified for final public origins. Never embed server secrets.

Developer memberships are organisational publishing prerequisites; the user-facing app remains free.

## Signing and secrets

| Platform | Required material | Handling |
| --- | --- | --- |
| iOS | Distribution certificate, App ID/provisioning profile, App Store Connect access | Approved CI secret store/organisation keychain only; never commit certificates, profiles, API keys, or passwords. |
| Android | Google Play App Signing, protected upload keystore/alias/password | Use Play App Signing; retain upload-key recovery material in approved secret storage; never commit it. |

Record owner, recovery contact, secret location, and rotation date in the organisation secret inventory, not this repository.

## Versioning

Current projects start at version 1.0/build 1:

| Platform | Visible version | Upload number | Source |
| --- | --- | --- | --- |
| iOS | MARKETING_VERSION | CURRENT_PROJECT_VERSION | apps/mobile/ios/App/App.xcodeproj/project.pbxproj |
| Android | versionName | versionCode | apps/mobile/android/app/build.gradle |

For each upload select one release version (for example 1.0.1) and increment both Apple CURRENT_PROJECT_VERSION and Android versionCode to unused, monotonic values. Record version, build numbers, commit SHA, source branch, signing reference, and rollout decision. Never reuse an uploaded build number.

## Build and verification

1. Start at a reviewed commit with clean worktree; confirm no unintended apps/api or supabase change.
2. Install pinned dependencies, produce local assets, and run required native checks:

   npm --prefix apps/mobile run sync  
   npm --prefix apps/mobile run test:types  
   npm --prefix apps/mobile run test:e2e

3. Run required web/backend regression suites. Install signed candidates on at least one Android device/emulator and one iOS device/simulator; complete the feature quickstart manual sweep.
4. Confirm webDir is www with no server.url; launch with network disabled to prove local shell, then validate production-like sign-in, data, camera, deep links, session restore/sign-out, English/Arabic, and offline read-only behaviour.
5. Verify identity, icon, splash, versions, privacy URL, free price, and no IAP/billing in the exact archive/AAB.

## Deliverables

### Android

1. Open apps/mobile/android in Android Studio with supported JDK/SDK; update versionName/versionCode.
2. Create a signed Android App Bundle (.aab) with protected upload key; verify com.smartexpense.ai.
3. Upload to internal testing first, run reviewer path from installed artifact, then progress through testing tracks.

### iOS

1. On macOS/Xcode, open apps/mobile/ios/App/App.xcworkspace; update marketing version/build number.
2. Archive/validate signed build and upload to App Store Connect.
3. Distribute through TestFlight, run reviewer path, resolve warnings, then submit for App Review.

## Metadata and compliance

1. Enter English/Arabic listings and signed-build screenshots.
2. Complete live Apple App Privacy and Google Data safety using privacy-data-safety.md, including optional AI-provider transmission.
3. Complete live ratings, App access/reviewer information, permissions, target audience, and required app-content fields.
4. Answer Apple's Export Compliance / encryption question (App Store Connect blocks submission until it is answered, or until `ITSAppUsesNonExemptEncryption` is set in `apps/mobile/ios/App/App/Info.plist`, which is not set today). The app uses only standard HTTPS/TLS and the platform Keychain and typically qualifies for the exemption ("does not use non-exempt encryption"), but confirm this legally for the shipped build before declaring it — do not assume.
5. Set Free and confirm no IAP/subscription/trial/billing item or entitlement exists.
6. Recheck official policy links in store-requirements-verification.md immediately before submission.

## Rollout and monitoring

1. Start with TestFlight and Play internal testing using synthetic data only.
2. Promote to a limited staged Play rollout and measured App Store release after feedback plus crash/ANR/review checks; document owner and observation window for each increase.
3. Monitor review status, launch health, crashes/ANRs, sign-in, camera/upload errors, and privacy/support reports. Do not put financial records in incident tickets.
4. To stop distribution, halt/unpublish the Play release and remove App Store availability as appropriate. A binary cannot be silently replaced; ship a higher build number for fixes.

## Final gate

- [ ] Public policy URL, in-app link, account-deletion path, and review account are live/tested.
- [ ] Signed Android/iOS artifacts pass device validation.
- [ ] Store forms/listings match final artifact and policy.
- [ ] Release owner approves staged rollout and monitoring.
