# Mobile native tabs

Decision: adopt `expo-router/native-tabs` for the Mobile App (#528), with the
integration fixes below. This replaces the defer-only evaluation in closed
[PR #530](https://github.com/Rowan-Paul/opnshelf/pull/530).
Web navigation is deliberately unchanged. ADR 0006 account gates and ADR 0023
URL shapes remain shared contracts.

## Integration choices

- Guest `/` reaches Discover, with Home/Social hidden and a Sign in action.
  The native Profile trigger prevents selection while its press listener opens
  `/login`; Back returns to Discover. Authenticated `/` reaches Home with four
  tabs. The native navigator remounts across guest/authenticated boundaries,
  clearing account-only scene state; ordinary tab switches retain their state.
- Root Stack details keep their existing URLs and presentation. Email
  Verification still precedes Onboarding; neither gate displays the tab bar.
- iOS scenes reserve their native provider's bottom safe-area inset. Existing
  manual top padding stays, and automatic scroll insets are disabled on iOS to
  avoid adding it twice. Android retains native automatic bottom insets. This
  clears final actions on both platforms without a hard-coded bar height.
- Profile images are clipped and rasterized with the already-installed SVG
  module into bounded 28-point default/selected sources, with a selected ring.
  Both variants must finish loading before publication; cleanup discards late
  exports. Missing images use a person placeholder; loading/failed remote images
  keep the native person icon. No image processing dependency or new native
  module is added.
- Expo Router 58.0.23 omits Android's original-color image flag. A typed
  `unstable_nativeProps.android` override supplies `tinting: "original"` for the
  avatar only. Keep this override local and remove it when Expo's converter
  supports original-color images directly. Recheck avatar colors on SDK updates.
- Android icons are transparent exports of the existing ISC-licensed Lucide set;
  iOS uses SF Symbols. All Android tab labels remain visible. A darker selected
  gold improves contrast against the light tab bar.

## Verification

Local synthetic scenario data only; no real account, PDS or database writes.
Devices: iPhone 18 Pro / iOS 27.0 and isolated Opnshelf528 / Android 17.0,
with matching development builds and recorded route inputs.

| Check | Result |
| --- | --- |
| Guest Sign in | iOS XCTest: three cold-launch first taps passed without warning suppression; VoiceOver announced both guest tabs and activated Sign in. Android opens login and hardware Back restores Discover. |
| Authenticated state and Back | iOS XCTest: Discover's entered query survives Home and return; edge Back from public Profile restores Profile; the final Find people action clears the native bar. Android public Profile and hardware Back work. Live UI sign-out on both clients returns to login; guest `/` shows Discover/Sign in and the synthetic callback restores Home without restarting. |
| Email Verification / Onboarding | Both platforms show verification first when both flags are required, then Onboarding when only that gate is required; no tabs. |
| Media URL | The existing `/shows/1399/game-of-thrones` shape opens the synthetic Show. Android cold-link delivery uses the development-client wrapper; iOS direct cold links initially open the development launcher, so production cold dispatch remains a release-build check. |
| Enlarged text | Accessibility-extra-large visibly scales content on both cold-launched clients; all four tab actions remain usable. Device settings restored afterward. |
| Profile image | Circular full-color image and selected ring render on both platforms. Unit tests cover both-image readiness and late-export cancellation. |
| Workspace gates | `pnpm typecheck`, `pnpm check`, `pnpm --filter mobile run test` (463 passed, one existing skip), and `pnpm test:scripts` (22 passed). Existing Backend lint warnings remain. |

[Native interaction test excerpts](../review-assets/native-tabs/ios-interaction-checks.txt)
and screenshots: existing [iOS bar](../review-assets/native-tabs/ios-before.png),
guest tabs [iOS](../review-assets/native-tabs/ios-guest.png) /
[Android](../review-assets/native-tabs/android-guest.png),
new [iOS Profile](../review-assets/native-tabs/ios-profile.png),
[Android Profile](../review-assets/native-tabs/android-profile.png),
Email Verification [iOS](../review-assets/native-tabs/ios-verification.png) /
[Android](../review-assets/native-tabs/android-verification.png),
Onboarding [iOS](../review-assets/native-tabs/ios-onboarding.png) /
[Android](../review-assets/native-tabs/android-onboarding.png), enlarged text
[iOS](../review-assets/native-tabs/ios-large-text.png) /
[Android](../review-assets/native-tabs/android-large-text.png).

TalkBack was enabled and focus observed, with login reachable while enabled;
exact speech output was not captured. The automation helper suppresses services
while inspecting Android, so it was stopped for that check. This is simulator
verification, not a complete physical-device accessibility certification.
Development Fast Refresh can still report SDK router preload/reconfiguration
warnings when the tab configuration changes during editing. No warning
suppression or SDK patch is shipped; cold-launch interaction checks pass.

For reproduction, follow [development sessions](../runbooks/development-sessions.md),
start `pnpm dev:scenarios mobile native-tabs-avatar`, and connect a matching dev
client to Metro 8084. The local controller also offers `native-tabs-guest`,
`native-tabs-verify`, `normal` (Onboarding), and `issue-fixes` (no avatar).
Restart after changing modes to clear session caches; use UI sign-out and the
local synthetic auth callback to check live transitions.

No native dependency, application version, Backend or Web change is included.
This is eligible for an OTA update on a compatible installed SDK 58 runtime;
no update or store release is published by this PR.
