# Pick for me iOS Shortcut — throwaway prototype (#526)

Question: can a user-created iOS Shortcut open the existing `/pick-for-me`
destination, with the app retaining control of authentication and Onboarding?

## Try it

On an iPhone with Opnshelf installed, open Shortcuts, tap **+**, and name the
shortcut **Pick for me in Opnshelf**. Add these two actions in order:

1. **URL**: `opnshelf://pick-for-me`
2. **Open URLs**: use the URL from the previous action.

Run it from Shortcuts, optionally add it to the Home Screen, or ask Siri to run
its name. The shortcut opens the chooser; it does not select a Media Item or
create a Watch. It takes no input and includes no account/session information.

`Pick for me.shortcut` is the signed importable prototype.
`Pick for me.unsigned.shortcut` is its editable XML property-list source.
To regenerate the signed file after editing, run on macOS from the repository root:

```sh
shortcuts sign --mode anyone \
  --input 'apps/mobile/prototypes/pick-for-me-shortcut/Pick for me.unsigned.shortcut' \
  --output 'apps/mobile/prototypes/pick-for-me-shortcut/Pick for me.shortcut'
```

Transfer the signed file to an iPhone and open it in Shortcuts. Signing/import
may require Apple services; the manual two-action recipe avoids that prerequisite.
The unsigned source is not a directly importable signed distribution artifact.

## Decision and limits

As assessed on 2026-10-19, [Expo SDK 58 AppIntents documentation](https://docs.expo.dev/versions/v58.0.0/sdk/app-intents/)
recommends `~0.5.9` and explicitly labels the package **alpha**, with frequent
breaking changes. SDK 58 being stable does not make this package stable.
It uses Swift declarations, a config plugin and native invocation delivery.
There is no need to adopt that queue or add a native dependency just to open a
screen. Revisit it if automatic App Shortcut discovery or app-provided Siri
phrases become a requirement.

Apple documents [URL + Open URLs for another app's URL scheme](https://support.apple.com/guide/shortcuts/apd68802640c/ios)
and [running a named shortcut with Siri](https://support.apple.com/guide/shortcuts/apd07c25bb38/ios).
This prototype requires the user to create/import the shortcut. It does not
register a discoverable Opnshelf action in the App Shortcuts catalog. Siri,
locked-device unlock prompts and voice cancellation require a physical iPhone.

The existing `opnshelf` scheme is reused; custom schemes are not exclusive to
an app. No secrets are passed in this link. This does not expand Universal Link
capture or change the Android or Web destination. Web already gates Onboarding
at its root; Android shares Mobile's guarded picker screen.

Direct picker links previously checked sign-in but relied on the tab layout
for email verification and Onboarding. Since the picker lives outside that
layout, the prototype adds those checks to the shared picker screen, covering
both the chooser and result routes. Preference reads wait for the gates too.
After sign-in or Onboarding, existing navigation takes the user to Home; run
the shortcut again. Automatic return to the chooser is outside this prototype.

Opening is read-only. Cancelling before Open URLs should deliver no URL;
cancelling after delivery cannot undo navigation. Duplicate delivery must be
checked for navigation behavior even though it cannot itself create a Watch.

## Verification

2026-10-19, iPhone 18 Pro simulator, iOS 27.0, native build fingerprint and
route inputs matching this checkout; synthetic API on 3391 and Metro on 8084.
No real account or PDS was used.

- **Import:** downloaded the signed file through Safari and Files, added it in
  Shortcuts, inspected both actions. The first export lacked an explicit output
  reference and failed with “No URL Specified”. The final source connects the URL
  action UUID to Open URLs through `WFInput`; the re-signed/imported file runs.
  The simulator names the second download “Pick for me 2”; the shipped file is
  still named “Pick for me.shortcut”.
- **Warm launch:** running the imported Shortcut, then allowing the system's
  open-app prompt, opens the populated chooser at `/pick-for-me` with the existing
  synthetic session. See [chooser](evidence/warm-picker.png) and
  [Shortcut actions](evidence/shortcut-actions.png).
- **Cancellation:** choosing “Don’t Allow” at the open-app prompt stops execution
  with an access-denied message. The next run prompts again and can be allowed.
  No chooser was opened by the denied run. The URL-based run also showed an
  output-sharing permission prompt for the URL after navigation. Voice/unlock
  cancellation is untested.
- **Repeated delivery:** two consecutive direct deliveries of the same URL reach
  the chooser. After manually generating a result, another URL delivery navigates
  to the chooser; a transition snapshot includes both outgoing result and incoming
  chooser. This does not establish back-stack deduplication or simultaneous
  delivery behavior. No Watch action was invoked.
- **Onboarding:** switching the fixture to incomplete Onboarding, restarting the
  app bundle and delivering the picker URL redirects to “Welcome to Opnshelf”.
  See [Onboarding gate](evidence/onboarding-gate.png).
- **Cold launch:** after terminating Opnshelf, the imported Shortcut opens Expo's
  development-server picker rather than the chooser. Loading the bundle with the
  development-client URL restores operation. An installed build with an embedded
  bundle is still required to establish production cold-launch behavior.
- **Authentication:** unit tests cover signed-out, verification-before-Onboarding,
  incomplete Onboarding, pending session restoration, both picker routes and
  disabled preference queries. Signed-out/expired-session native behavior and
  email verification were not established in this fixture run.

Required follow-up on an installed build/physical iPhone: cold launch with an
embedded bundle; signed-out and expired sessions; Siri name invocation, locked
unlock/cancellation; simultaneous delivery and back-stack/filter behavior.
These remain limitations of this prototype, not passing device checks.

The earlier iPhone 17e attempt failed to attach to device support and its native
build was unverified. The resumed run above uses the existing iPhone 18 Pro.

Checks run:

- `pnpm typecheck`: passed.
- `pnpm check`: passed, with 48 existing Backend warnings.
- `pnpm --filter mobile run test`: 462 passed, one existing skipped test/file.
- `pnpm --filter mobile exec vitest run src/app-tests/watch-picker.test.tsx`:
  all 11 passed in the initial run.
- `plutil -lint` on the unsigned source, action-order/destination/output-reference
  assertions, and `git diff --check`: passed.

No release is required to install this user-created Shortcut. The picker gate
change is JavaScript-only (version unchanged) and would use an OTA update after
operator approval. No OTA update or store build was published.
