# Releasing the mobile app

Staging runs the same two routes off `develop`, aimed at the `preview` channel:
push mobile changes and they go out as a preview update, bump `version` and you
get a new sideloadable preview build instead
(`.github/workflows/staging.yml`). Nothing below is needed to test a change.

Two release paths, and pushing to `main` picks one for you. `version` in
`app.config.ts` is the switch:

| `version` on this release | What ships | How long |
|---|---|---|
| unchanged | OTA update, `production` channel | next app launch |
| bumped | store build and submit, both platforms | hours to days |

So bump the version when the change needs a new binary — native code, a config
plugin, a dependency with native parts — and leave it alone otherwise.

They are exclusive because they have to be. The runtime version policy is
`appVersion` (see `app.config.ts`) and an update only loads on a binary whose
runtime string matches exactly, so an OTA published right after a bump would
target a version nobody has installed. Not bumping is what makes it land.

## OTA update by hand

```sh
cd apps/mobile
eas update --channel production --environment production --message "what changed"
```

Same rule applies: this reaches the installed base only when `version` in the
tree you publish from matches the store build people are running. If `develop`
is already a version ahead, check out the tag the stores are serving first.

**A store binary only receives OTA updates if it was built after commit
`0729ba0` (2026-05-30, "Enable Expo updates for mobile app").** The Play Store
release from April 2026 predated it; updates published against it were inert
until a new binary shipped (July 2026, vc 57). If in doubt, check adoption
with the EAS update insights before assuming an update landed.

## Where the app's environment comes from

`EXPO_PUBLIC_*` values are inlined into the JavaScript bundle as it is built or
published. Nothing reads them at runtime, so a wrong value is baked in and only
a new build or update replaces it.

Two places define them, and they are not the same place:

1. **`eas.json`, `build.<profile>.env`** - in git, reviewed, the source of
   truth.
2. **The EAS environments** (`development` / `preview` / `production`) - edited
   by hand in the dashboard or with `eas env:set`. Read with `eas env:list
   preview`.

`eas update` does not read a build profile's `env` at all, which is why the
staging workflow parses `eas.json` itself rather than passing
`--environment preview`. With `--environment`, EAS uses the server-side
environment and [ignores your `.env` files][expo-env-faq].

**Keep the two from disagreeing.** Expo does not document which one wins when
both define a name, so a disagreement is a value you cannot predict from the
repo. Two have bitten already:

- The Google client ids went into `eas.json` and not into the dashboard copy,
  and staging shipped without a Google button.
- The `preview` environment held `EXPO_PUBLIC_API_URL=https://api.opnshelf.xyz`
  - the *production* API - until 2026-09-12. Per ADR 0021 staging shares the
  production PDS, so a preview build resolving that variable writes real data.

When you add an `EXPO_PUBLIC_*` value, put it in `eas.json` and then check
`eas env:list <environment>` for a stale copy of the same name.

[expo-env-faq]: https://docs.expo.dev/eas/environment-variables/faq/

## Store build (native changes, config-plugin changes, version bumps)

```sh
cd apps/mobile
eas build --platform android --profile production   # versionCode auto-increments
eas submit --platform android --latest               # → Play production, 10%
```

Android submissions land on the **production track** at a 10% staged rollout
(`rollout` in `eas.json`), so once Google approves it they are live for real
users with no further gate. Ramp to 100%, or halt, in Play Console.

iOS: same commands with `--platform ios`, but `eas submit` only uploads to App
Store Connect. The build reaches TestFlight from there; releasing to the App
Store is a manual submit-for-review in the console, with phased release as the
staged-rollout equivalent.

These commands are the manual path. The automatic one runs on every push to
`main` and nowhere else: it tags the release `v<version>` straight from
`app.config.ts`, publishes the GitHub release, and builds and submits both
platforms (see `.github/workflows/release.yml`).

So bump `version` on `develop` as part of the work, then merge. Editing it on
`develop` builds nothing on its own. Merging without having bumped it fails the
release, which is what keeps the GitHub version and the store version equal.

## Apple credentials (App Store Connect API key)

EAS authenticates to Apple with an **App Store Connect API key**, not an Apple
ID. The Apple ID path is not a fallback: signing in through it fails with
`Authentication with Apple Developer Portal failed! iTunes service key is
empty`, which comes from fastlane failing to read Apple's `olympus` config
endpoint before the password is ever checked. Retrying does not help.

The key lives in App Store Connect → Users and Access → Integrations → App
Store Connect API → Team Keys, needs the **Admin** role to manage provisioning
profiles, and its `.p8` downloads exactly once. Pass it as environment
variables:

```sh
export EXPO_ASC_API_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
export EXPO_ASC_KEY_ID=XXXXXXXXXX
export EXPO_ASC_ISSUER_ID=0780dfb2-c5c0-4287-a748-8350badf8be3
export EXPO_APPLE_TEAM_ID=FNW3B5Q58G
export EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
```

The last two matter for `--non-interactive`: without them EAS still stops on
`Select your Apple Team Type:` and fails with "Input is required, but stdin is
not readable", which reads like a credentials problem and is not one.

### Adding a capability to an existing App ID

Enabling a capability in the Apple Developer portal — Sign in with Apple, say —
does **not** update the provisioning profile EAS already has. The build then
fails in Xcode with:

> Provisioning profile "\*[expo] com.rowanpaul.opnshelf AdHoc …" doesn't include
> the com.apple.developer.applesignin entitlement

`eas build` will not fix this on its own. It prints "All credentials are ready
to build" and proceeds with the stale profile, because non-interactive builds
validate credentials rather than change them. Force a refresh:

```sh
eas build --platform ios --profile preview \
  --non-interactive --refresh-ad-hoc-provisioning-profile
```

Check the output: the Provisioning Profile block prints an `Updated` time and a
Developer Portal ID. `Updated 24 days ago` with an unchanged ID means it reused
the old one and the build will fail again; a fresh timestamp and a new ID mean
it actually minted one. That is the only signal before the Xcode step.

`--refresh-ad-hoc-provisioning-profile` covers ad-hoc profiles, which is what
the `preview` profile uses. A production/App Store profile needs the
capability synced through `eas credentials` instead.

### Gotchas (all learned the hard way)

- **"You must let us know whether your app includes any health features"** on
  submit, even though the Play Console health declaration is complete:
  `expo-sensors` merges `ACTIVITY_RECOGNITION` (for its pedometer) into the
  Android manifest, and Google classifies that permission as a health feature.
  Fixed by `android.blockedPermissions` in `app.config.ts` — keep that entry
  as long as `expo-sensors` is a dependency. The error message never mentions
  the permission; don't waste time re-saving console declarations.
- **Play Console "App optimization: Low"** on the bundle's Details tab (1%
  obfuscation, no shrink or optimization percentage, "R8 configuration: -"):
  Expo ships R8 switched off, so the release DEX goes out unminified. Fixed by
  `expo-build-properties` in `app.config.ts` (`enableMinifyInReleaseBuilds`,
  `enableShrinkResourcesInReleaseBuilds`). Two consequences: it is native
  config, so it only takes effect in a store build, never an OTA update; and
  R8 breakage shows up as runtime crashes in release builds only, never in
  development. After touching native dependencies, run a `preview` build on a
  device and walk sign-in, deep links, shake-to-feedback, and a PostHog event
  before promoting. If a library loses classes it needs at runtime, add a
  `-keep` rule through the plugin's `extraProguardRules` rather than editing
  the generated `android/` directory. The "Upgrade to AGP 9.0" line on that
  tab is Google's generic advice; the AGP version is pinned by React Native's
  Gradle plugin and is not ours to bump.
- **Gradle hangs in `minifyReleaseWithR8` spewing `OutOfMemoryError:
  Metaspace`:** Expo's template caps the daemon at a 512 MB Metaspace and R8
  needs more; the daemon dies instead of failing the task. Raised to 1 GB (and
  a 4 GB heap) by `plugins/with-gradle-jvm-args.js`. If it comes back after a
  dependency bump, raise the values there, never in the generated
  `android/gradle.properties`.
- **Android credentials:** the Play service-account key must live at
  `apps/mobile/google-service-account.json` — exactly that name, referenced
  from `eas.json`. Not committed.
- **iOS submit:** `$EXPO_APPLE_ID` etc. in the `submit` profile are NOT
  interpolated by EAS — inline the real values temporarily and revert after
  submitting.
- **`iTunes service key is empty`** on any `eas` command that talks to Apple:
  the Apple ID login path is broken, not your password. Use the App Store
  Connect API key above.
- **`doesn't include the com.apple.developer.applesignin entitlement`** (or any
  other capability) after enabling it in the portal: stale provisioning
  profile. See "Adding a capability to an existing App ID" above.
- **pnpm/babel build failures** ("transformFile undefined"): any babel/metro
  preset referenced by bare string must be declared as a real dependency in
  `apps/mobile/package.json` (pnpm isolated node_modules).
