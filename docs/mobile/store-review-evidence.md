# Store minimum-functionality evidence

**Purpose:** Evidence for Apple Guideline 4.2 and Google Play Functionality, Content, and User Experience. This is source/test evidence, not a claim that the required device review has already happened.

| Claim | Implemented evidence | Repeatable verification |
| --- | --- | --- |
| Locally bundled installable shell, not remote wrapper | capacitor.config.ts sets webDir to www and has no server.url; build-web-bundle.mjs builds apps/web into apps/mobile/www. | Run mobile sync and test:e2e. install-launch.spec.mjs asserts local www/index.html/no remote shell URL. Launch device with network disabled to confirm shell renders. |
| Useful finance workflow | Signed-in users manage income, expenses, categories, receipts, and reports; backend remains authoritative for totals and roles. | Follow reviewer-guide.md using synthetic Owner account; compare dashboard/report totals. |
| Native camera | camera.ts uses Capacitor Camera takePhoto, feeds existing upload, and sets saveToGallery false. | Allow camera on signed build, capture non-sensitive sample, preview/upload, and confirm no gallery copy. capture-upload.spec.mjs covers native wiring. |
| Secure native session | secure-session.ts uses iOS Keychain/Android Keystore-backed storage; Android backup disabled; iOS uses this-device-only Keychain setting. | Sign in/restart, then sign out/relaunch. Inspect storage in manual sweep; secure-storage.spec.mjs rejects plain storage/persistent financial data paths. |
| Native capabilities beyond rendering | Status/safe-area, Android back, deep-link, splash/icons, camera, and secure-storage plugin integration. | Verify startup, safe areas, back, deep link, camera, restore, and sign-out on Android/iOS per feature quickstart. |
| Meaningful Android experience | Installable financial workflow with capture, reports, Arabic/English, and secure sessions; not static content or link collection. | Complete native smoke/reviewer path on signed candidate before promotion. |

## Reviewer summary

Smart Expense AI is not a repackaged remote website. It packages its shell locally, adds platform camera and hardware-backed session storage, and provides a focused financial record-keeping workflow. It is free and has no IAP, subscription, trial, or payment flow.

## Evidence still required

- [ ] Android device/emulator camera and secure-storage observation.
- [ ] iOS device/simulator camera and Keychain observation.
- [ ] Signed-build offline shell, deep-link, sign-in/sign-out, RTL manual sweep record.
- [ ] Store-console images/attachments captured from the same signed build.
