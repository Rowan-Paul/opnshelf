# Releasing the mobile app

Two release paths. Pick the cheapest one that ships your change.

## OTA update (JS/asset changes only)

```sh
cd apps/mobile
eas update --channel production --environment production --message "what changed"
```

Users pick it up on their next app launch. The runtime version policy is
`appVersion` (see `app.config.ts`), so an update only reaches binaries whose
app version matches the one you publish from — bump `version` and the OTA
audience becomes the *next* store build.

**A store binary only receives OTA updates if it was built after commit
`0729ba0` (2026-05-30, "Enable Expo updates for mobile app").** The Play Store
release from April 2026 predated it; updates published against it were inert
until a new binary shipped (July 2026, vc 57). If in doubt, check adoption
with the EAS update insights before assuming an update landed.

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

### Gotchas (all learned the hard way)

- **"You must let us know whether your app includes any health features"** on
  submit, even though the Play Console health declaration is complete:
  `expo-sensors` merges `ACTIVITY_RECOGNITION` (for its pedometer) into the
  Android manifest, and Google classifies that permission as a health feature.
  Fixed by `android.blockedPermissions` in `app.config.ts` — keep that entry
  as long as `expo-sensors` is a dependency. The error message never mentions
  the permission; don't waste time re-saving console declarations.
- **Android credentials:** the Play service-account key must live at
  `apps/mobile/google-service-account.json` — exactly that name, referenced
  from `eas.json`. Not committed.
- **iOS submit:** `$EXPO_APPLE_ID` etc. in the `submit` profile are NOT
  interpolated by EAS — inline the real values temporarily and revert after
  submitting.
- **pnpm/babel build failures** ("transformFile undefined"): any babel/metro
  preset referenced by bare string must be declared as a real dependency in
  `apps/mobile/package.json` (pnpm isolated node_modules).
