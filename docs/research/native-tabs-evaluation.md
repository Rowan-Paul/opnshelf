# Mobile native tabs evaluation

Decision: **defer production adoption** for [#528](https://github.com/Rowan-Paul/opnshelf/issues/528). The evaluation is complete; keep the existing JavaScript tabs. Native tabs can support the required destinations, guest action and Profile image. Adoption needs screen-inset work, a supported Android original-color image path, and the remaining verification below. This optional follow-up to #320 does not block SDK 58 acceptance.

## Trial and scope

Evaluated on 19 October 2026 from `develop` commit `e511865d`, using Expo Router 58.0.23 and react-native-screens 4.30.0. Devices: iPhone 18 Pro / iOS 27.0 and isolated Opnshelf528 emulator / Android 17.0. Native fingerprints and route inputs passed `dev:doctor`; matching development builds were used. Local scenario data supplied synthetic authentication and content. No real account/PDS writes were performed.

The temporary trial used `expo-router/native-tabs`, hidden guest Home/Social, a disabled Profile trigger whose `tabPress` listener pushes `/login`, and Android `backBehavior="history"`. The root Stack, URLs, gates, Trakt Sync Banner and feedback wrapper remained. Android `md` icons require absent `expo-symbols`, so the trial used static image assets without adding dependencies.

Web deliberately remains unchanged: this concerns the Mobile App renderer. ADR 0006 onboarding parity and ADR 0023 URL shapes remain the shared product contracts.

## Findings

| Requirement | iOS | Android |
| --- | --- | --- |
| Guest `/` | Discover selected; Sign in available; Home/Social absent. | Same outcome. |
| Authenticated `/` | Home and four tabs, including after synthetic callback. | Same outcome, including live sign-out → guest → synthetic sign-in without process restart. |
| Guest Sign in | First-tap test initially failed with a development LogBox overlay present. Suppressing only two router warnings produced 10/10 first-tap passes, including six cold launches. See diagnosis below. | Opened login; hardware Back restored Discover without selecting Profile. Repeated after live sign-out. |
| Email Verification / Onboarding | Verification wins when both are required; each gate has no tabs. | Same outcome. |
| Tab state | Discover query `retention trial` survived Home and return. | Same outcome; tab Back history also returned from Discover to Profile. |
| Root Stack / URLs | In-app public Profile opens `/profile/synthetic.test`. Gesture Back remains unverified. | Public Profile opens; hardware Back restores Profile tab. Guest scheme link to the same public Profile also opens. |
| Profile image | Bounded 28-point sources, circular crop, selected ring and failed-URI fallback render correctly. | Same appearance requires explicit Android `tinting: "original"` via `unstable_nativeProps`. Missing and failed-URI fallbacks render correctly. |
| Screen reader | Actual iOS 27 XCTest VoiceOver output identifies all four tab names, ordinal positions and selected Profile. | Accessibility tree exposes names and selected state. TalkBack speech/activation remains unverified. |
| Enlarged text | Requested accessibility-extra-large, but the captured live screen did not visibly scale; this is not a verified large-text pass. | Guest Discover/Sign in labels remained readable at accessibility-extra-large. |
| Bottom clearance | **Profile’s final Find people action remains under the floating bar.** Reproduced with manual insets disabled and with native automatic insets enabled, including cold launch and a direct swipe. The existing JS bar clears it. | Final action clears the bar after scrolling fully to the bottom. |

### Guest first-tap diagnosis

An XCTest launched the guest app, tapped the native Sign in button once, and asserted the login Handle field. The initial run failed. The accessibility snapshot afterward showed a LogBox Console Error overlay for unhandled `PRELOAD` (`profile`); Metro also reported unhandled `ROUTE_NAMES_CHANGED` during tab reconfiguration. Dismissing the overlay allowed the unchanged listener to open login. A diagnostic repeat suppressed only those two development warnings: all ten attempts passed (rounds 1 and 6–10 cold, rounds 2–5 warm).

This implicates the development overlay in the observed first-tap failure; it does **not** establish that the underlying router warnings are harmless. No deferred press workaround, SDK patch, warning suppression or debug logging is retained. Resolve the warnings and repeat in a release-like build before adoption. [Red/green and VoiceOver excerpts](../review-assets/native-tabs/ios-accessibility-and-signin.txt).

### Avatar implementation cost

Custom images work on iOS 27; the first trial’s unbounded 1024-pixel source was a prototype defect. The corrected experiment rasterizes the circular crop and selected ring with the already-installed SVG module into two 84 × 84 transparent PNGs, supplied as `width: 28, height: 28, scale: 3`. A missing or failed image keeps a person fallback. This demonstrates feasibility, not a production-ready cache/lifecycle implementation.

On Android, the installed screens image loader defaults to tinting, while Expo’s converter omits the original-color flag. Supplying that flag through `unstable_nativeProps.android.icon/selectedIcon` preserves colors. Prefer a supported converter path before adoption; avoid committing to an unstable override solely for this optional migration. [API findings](native-tabs-sdk58-api.md), [image research](native-tab-images-ios27.md).

## Evidence

- Correct avatar: [iOS circular image](../review-assets/native-tabs/ios-native-avatar-circle.png), [Android original-color image](../review-assets/native-tabs/android-native-avatar-original.png), failed-image fallback [iOS](../review-assets/native-tabs/ios-native-avatar-broken.png) / [Android](../review-assets/native-tabs/android-native-avatar-broken.png), [Android missing-image fallback](../review-assets/native-tabs/android-native-avatar-fallback.png).
- Insets: [iOS manual inset trial](../review-assets/native-tabs/ios-native-profile-bottom.png), [iOS automatic inset trial](../review-assets/native-tabs/ios-native-profile-auto-insets.png), [direct-gesture confirmation](../review-assets/native-tabs/ios-native-profile-gesture-bottom.png), [existing JS bottom clearance](../review-assets/native-tabs/ios-js-profile-bottom.png), [Android full bottom](../review-assets/native-tabs/android-native-profile-bottom.png).
- Authentication: guest [iOS](../review-assets/native-tabs/ios-native-guest.png) / [Android](../review-assets/native-tabs/android-native-guest.png), [Android live sign-out](../review-assets/native-tabs/android-native-live-signout.png), Email Verification [iOS](../review-assets/native-tabs/ios-verify-email.png) / [Android](../review-assets/native-tabs/android-verify-email.png), Onboarding [iOS](../review-assets/native-tabs/ios-onboarding.png) / [Android](../review-assets/native-tabs/android-onboarding.png).
- State: retained query [iOS](../review-assets/native-tabs/ios-native-retention.png) / [Android](../review-assets/native-tabs/android-native-retention.png); [Android enlarged guest text](../review-assets/native-tabs/android-native-guest-large-text.png).
- Baseline: [existing iOS Home](../review-assets/native-tabs/ios-js-home.png), [restored Android Discover](../review-assets/native-tabs/android-js-discover.png).

Screenshots include development-client Tools controls. iOS is dark and Android light; this is platform evidence, not a controlled theme comparison. Earlier automation timeouts coincided with a full disk and are not attributed to native tabs.

## Adoption criteria

1. Adapt iOS screen padding/insets so final actions clear the floating bar, without duplicate top padding; cover every tab’s long content and keyboard states.
2. Resolve router preload/reconfiguration warnings and use a supported Android original-color image path; choose `expo-symbols` or maintained static Android icons.
3. Complete TalkBack speech/activation, guest VoiceOver activation, effective iOS Dynamic Type/contrast, iOS gesture Back, tab reselection/scroll-to-top, pull-to-refresh, and media/notification cold-link checks. Check authentication transitions on iOS and restoration expectations when hidden tabs change. Current scheme/in-app links do not prove OS Universal/App Link associations.

These remaining checks gate a future migration, not completion of this defer evaluation.

## Reproduction and verification

The [unapplied prototype patch](native-tabs-prototype.patch) contains the trial layout, SVG image helper and fixture modes. Its static icons live in the evidence directory. Apply in a disposable checkout at the recorded baseline; follow [development sessions](../runbooks/development-sessions.md), start `pnpm dev:scenarios mobile native-tabs-avatar`, and connect a matching development client to Metro 8084. Android also needs reverse ports 3391/8084. The scenario controller offers `native-tabs-guest`, `native-tabs-verify`, `native-tabs-avatar`, `normal` (Onboarding) and `issue-fixes` (completed Onboarding, no avatar). The synthetic callback is only for this local fixture. Restart after changing modes when testing session restoration; use the callback/UI sign-out for live transitions.

- Prototype Mobile TypeScript, focused Biome checks and fixture `node --check` passed. iOS VoiceOver XCTest passed; initial guest test failed, diagnostic repeat passed 10/10 as qualified above.
- Restored Mobile TypeScript and test suite passed: 61 files / 458 tests, one pre-existing skipped file/test.
- Saved patch applicability and whitespace were checked after restoring production sources.
- Production source, dependencies, versions, Backend and Web are unchanged. Publication pre-commit passed root `pnpm typecheck` and `pnpm check`; Backend emitted existing lint warnings. Web/Backend tests were not run because only documentation, an unapplied patch and evidence remain.

Cleanup completed: the local scenario runner is stopped, both task device claims released, and the task-created Opnshelf528 AVD, XCTest runner and temporary APK/test-build files removed. Device text sizes were restored. Existing iPhone simulators and the other Android session were retained.

No release is needed for this evaluation. A later native dependency requires a store build; a renderer-only change on a compatible installed runtime could use OTA after verification and operator approval. This evaluation changes no application behavior and publishes no application release.
