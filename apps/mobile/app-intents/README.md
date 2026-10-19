# Pick for me App Shortcut

After installing a build containing these native declarations, open Opnshelf once.
In Apple's Shortcuts app, find Opnshelf's **Pick for me** action. It opens the
chooser; it never selects a Media Item, logs a Watch or performs a background write.
The App Shortcut phrases are “Pick for me in Opnshelf” and
“Choose what to watch in Opnshelf”. Siri handles device unlocking.

`PickForMeIntent` opens the app and records an `openPickForMe` invocation. The
root bridge waits for session restoration and navigation, then navigates to
`/pick-for-me`. That screen enforces sign-in, email verification and Onboarding.
Completing a gate uses existing navigation to Home; run the action again to open
the chooser. Native invocations are acknowledged after navigation. Duplicate
snapshots reuse the chooser, and a pending batch is combined into one navigation.
A failure to navigate retains the pending invocations; failed acknowledgements
can be retried on another invocation or mount. Cancelling before `perform()`
dispatches records no action; after dispatch, opening may already be underway.

The package is deliberately pinned to `expo-app-intents` 0.5.10. As the
[Expo documentation](https://docs.expo.dev/versions/v58.0.0/sdk/app-intents/) states,
it is **alpha**,
including its persisted queue and bridge APIs. Swift declarations compile into
the application target through Expo inline modules so Apple's metadata extractor
can discover them; keeping an App Intent only inside a static pod is insufficient.
`AppIntentsSetup` also refreshes the app-provided phrases on startup.

Android and Web keep the existing `/pick-for-me` destination. The bridge mounts
only on iOS. The original user-created URL Shortcut is preserved as a
[prototype primary source](https://github.com/Rowan-Paul/opnshelf/tree/877cecc3/apps/mobile/prototypes/pick-for-me-shortcut)
and on the local `prototype/526-pick-for-me-url-shortcut` branch.

## Build and release

Changes to native declarations, phrases, inline-module config or the dependency
require a new binary. An OTA cannot install the action. This implementation leaves
the release version unchanged and publishes nothing: bump the version for the
approved store release rather than sending this as an OTA-only feature.
For local verification use Node 24, the repository pnpm version and the
[development-session runbook](../../../docs/runbooks/development-sessions.md).
Build with an embedded bundle to test cold launch; the Expo development launcher
can otherwise intercept a cold start before the action's JavaScript runs.

## Verification

- `pnpm typecheck` and `pnpm check` passed (existing Backend lint warnings).
- Mobile tests: 468 passed, one existing skipped file/test. Six bridge tests cover
  readiness, cold queued snapshots, duplicates, result navigation, navigation
  failure, acknowledgement retry and unsupported platforms. Picker tests cover
  the three account gates and waiting for session restoration.
- `pnpm test:scripts`: 21 passed. Native fingerprints now include app-intents
  sources, so changing Swift invalidates a recorded device build.
- iOS Release simulator build succeeded with Xcode 27.1, including
  ExtractAppIntentsMetadata and phrase training. Built both arm64 and x86_64.
  Installed the ad-hoc signed build with its embedded JavaScript on iPhone 18 Pro,
  iOS 27.0, against the loopback fixture API. No real account or PDS was used.
- The action appears under Shortcuts → Apps → Opnshelf, without importing a file.
  See [native action](evidence/app-shortcut.png).
- Running it while signed out opens sign-in. After fixture sign-in, warm launch
  opens the chooser. Terminated Opnshelf, ran the same native action, and observed
  the chooser on cold launch without starting Metro. See
  [cold chooser](evidence/cold-picker.png).
- Ran the action again from a result: it returns to the chooser. Repeated actions
  did not generate Watches. Duplicate batches and replay/removal failures are
  covered by the bridge tests; simultaneous Siri invocations were not exercised.
- Switched the fixture to incomplete Onboarding, terminated Opnshelf, and ran the
  action: the app opens Onboarding instead of the chooser. See
  [Onboarding gate](evidence/onboarding-gate.png).
- After sign-in-gate, cold-chooser and Onboarding runs, read only the named native
  invocation-queue preference in the app's sandbox: it contained `[]`, confirming
  acknowledgement. No account tokens or other preferences were inspected.
- Initial unsigned simulator build could not use SecureStore (missing Keychain
  entitlement). Rebuilt with local ad-hoc signing and reran authentication/cold
  launch successfully. This was a verification-build issue, not a sign-in change.
- Email-verification priority and waiting for authentication are tested in code;
  native email verification, expired-session timing and voice cancellation were
  not exercised. Cancellation is checked before native dispatch. Once dispatched,
  navigation can already occur and is not undone by cancelling Siri.

Physical-device Siri recognition and locked-device cancellation require hardware;
no Simulator result should be read as evidence for those.
