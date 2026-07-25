# Store-requirements verification — 2026-07-25

This records T062's implementation-time policy check. Re-open these official sources immediately before submission because store consoles and policies change independently.

| Topic | Checked requirement | Reconciliation |
| --- | --- | --- |
| Apple minimum functionality | Apps need features/content/UI beyond a repackaged website and adequate utility. | store-review-evidence.md identifies local assets, camera, secure storage, and workflow; reviewer-guide.md demonstrates them. |
| Apple privacy | Privacy-policy URL is required; App Privacy declarations must be accurate and updated. | privacy-data-safety.md maps actual data and makes missing public/in-app policy link a blocker. |
| Apple screenshots/review access | One to ten JPEG/PNG screenshots; App Review supports contact/demo-account details. | Listing storyboard and reviewer guide are ready; credential stays outside git. |
| Apple export compliance | Every iOS submission must answer the encryption/export-compliance question, or preset `ITSAppUsesNonExemptEncryption`. | release-runbook.md flags this as a required submission step; the app uses only HTTPS/TLS + Keychain, so the standard exemption is expected but must be confirmed for the shipped build. |
| Google functionality | Apps must be stable/responsive and provide meaningful mobile functionality. | Evidence/runbook require signed-device validation. |
| Google listing | Title max 30 chars; short description max 80; full description max 4,000. | English/Arabic metadata is within checked limits and avoids misleading claims. |
| Google Data safety/privacy | Accurate Data safety form and privacy policy are required; audit all SDKs. | Privacy map covers collection, optional AI sharing, secure storage/non-collection, public policy, final SDK audit. |
| Google restricted access | Sign-in-restricted apps must provide valid test credentials/instructions. | Reviewer guide requires synthetic active Owner account and path. |
| Google identity | Applicable developer identity verification is required. | Runbook lists it as a prerequisite. |

## Official sources checked

- [Apple App Review Guidelines — 4.2](https://developer.apple.com/app-store/review/guidelines/)
- [Apple app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Apple app information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)
- [Apple previews and screenshots](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots)
- [Apple export compliance overview](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance)
- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Google Play functionality](https://support.google.com/googleplay/android-developer/answer/9898783?hl=en)
- [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Google Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [Google Play store listing](https://support.google.com/googleplay/android-developer/answer/13393723?hl=en)
- [Google Play App access](https://support.google.com/googleplay/android-developer/answer/9214102?hl=en)
- [Google developer identity verification](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)

## Submission-time recheck

- [ ] Record date, reviewer, and policy/form changes after re-opening every source.
- [ ] Compare final iOS archive/Android AAB permissions, SDKs, endpoints, pricing, and data flows with declarations.
- [ ] Do not submit until every blocker in the privacy, reviewer, and release documents is resolved.
