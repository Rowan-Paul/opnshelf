# Opnshelf App Shortcuts

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

## Additional actions

| Action | Input | Opens |
| --- | --- | --- |
| Open Up Next | None | Signed-in User’s Up Next |
| Search for a title | Title, 1–200 characters | Search with the title prefilled |
| Pick for my available time | Minutes, 1–1440; Movies, Shows or both | Chooser with that budget and type |
| Open my watchlist | None | Watchlist |
| Add to watchlist | Title or supported link | Existing add sheet, followed by explicit confirmation |

Minutes are a parameter, never a hardcoded 45-minute preset. The default media
type is both; saved streaming-service filters remain in effect. Required values
are prompted by Shortcuts/Siri and can be supplied by variables in a custom
Shortcut. Use Shortcut Input for a shared title or link. Supported links are
Opnshelf movie/show URLs and TMDB movie/TV URLs; their IDs are resolved through
the existing API, never by fetching arbitrary input URLs. Unsupported links are
rejected. Search is public; existing account gates apply to signed-in Users.
The other actions require sign-in. Completing a gate does not automatically
resume the request; rerun the action. A cold batch uses its latest valid action.
Additions happen only after tapping **Add to Watchlist** in the app; cancelling
confirmation performs no write. Existing Watchlist entries cannot be removed by
this action. Failed additions retain confirmation for retry.

Android and Web do not register Apple actions. Mobile Search now supports `q`,
matching Web, and both clients accept the picker `minutes` and `type` URL inputs.
The Watchlist confirmation flow is an iOS action entry point; ordinary manual
list editing on either client keeps its existing behavior.

## Build and release

Changes to native declarations, phrases, inline-module config or the dependency
require a new binary. An OTA cannot install the action. This implementation leaves
the release version unchanged and publishes nothing: bump the version for the
approved store release rather than sending this as an OTA-only feature.
For local verification use Node 24, the repository pnpm version and the
[development-session runbook](../../../docs/runbooks/development-sessions.md).
Build with an embedded bundle to test cold launch; the Expo development launcher
can otherwise intercept a cold start before the action's JavaScript runs.

## Verification of the additional actions

On iPhone 18 Pro / iOS 27.0 Simulator, using an ad-hoc signed Release build
with embedded JavaScript and the loopback `issue-fixes` fixture API:

- All six actions appear under Shortcuts → Apps → Opnshelf.
- Up Next opens the synthetic signed-in User’s episode queue.
- The time action prompts for Minutes; entering 30 opens the chooser at 30
  minutes with both media types. Unit tests exercise 90 → 45 minutes and Shows
  → Movies on repeated requests, preserving saved streaming services.
- Search prompts for a title and prefills the Search screen.
- Open my watchlist opens the Watchlist from a terminated app without Metro.
- Add to watchlist accepts an Opnshelf show link and resolves the exact show ID.
  Selecting it displays title, type and year for explicit confirmation. Cancelling
  produced zero fixture writes; confirming produced exactly one. The row then
  became disabled as Already added. The native pending queue contained `[]`.
- Confirmation layout was inspected on-device. Duplicate submission, title
  resolution, ID resolution and existing-entry behavior are covered by tests.
- Root typecheck/check, 503 Mobile tests and 528 Web tests pass. The native
  Release build and App Intents metadata extraction succeed.

Screenshots are attached to [PR #533](https://github.com/Rowan-Paul/opnshelf/pull/533).
Siri voice recognition, a physical-device Share Sheet, locked-device behavior,
network-error timing and changing the optional media type in Apple’s editor
were not exercised on hardware. Required dialogs are system UI; Simulator
observations do not establish voice recognition quality.

## Original chooser verification

- `pnpm typecheck` and `pnpm check` passed (existing Backend lint warnings).
- Mobile tests: 503 passed, one existing skipped file/test. Seven bridge tests cover
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
