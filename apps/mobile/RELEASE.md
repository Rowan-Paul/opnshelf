# Releasing the mobile app

This covers shipping OpnShelf to TestFlight (iOS) and Play internal testing
(Android) via EAS. The repo-side config (`eas.json`, the `EAS Build` workflow,
`store/`, icons in `assets/images/`) is committed; the steps below are the
external, credentialed parts that can't live in git.

## One-time setup

### 1. Expo / EAS project
```bash
cd apps/mobile
eas login                # an Expo account with the OpnShelf project
eas init                 # links the project, writes extra.eas.projectId to app.config.ts
```
Commit the `extra.eas.projectId` that `eas init` adds.

### 2. Build-time environment variables (EAS)
`eas.json` no longer hardcodes the production API URL. Set these as EAS
environment variables, scoped to the `preview` and `production` environments,
so cloud builds pick them up:
```bash
eas env:create --environment preview     --name EXPO_PUBLIC_API_URL    --value "https://<prod-backend-host>"
eas env:create --environment production   --name EXPO_PUBLIC_API_URL    --value "https://<prod-backend-host>"
eas env:create --environment production   --name EXPO_PUBLIC_POSTHOG_KEY --value "<posthog key>"  --visibility sensitive
```
(Repeat `EXPO_PUBLIC_POSTHOG_KEY` for `preview` if you want analytics there.)
The `<prod-backend-host>` is the Railway backend URL — **not** `opnshelf.xyz`,
which is the web frontend.

### 3. CI secret
Add an Expo access token (`eas whoami`-capable, Personal/Robot token) as the
`EXPO_TOKEN` GitHub Actions secret so the **EAS Build** workflow can run.

### 4. Store credentials
- **iOS:** an Apple Developer account ($99/yr). `eas submit` / `eas credentials`
  will create the App Store Connect app and manage signing. Fill the
  `submit.production.ios` env vars (`EXPO_APPLE_ID`, `EXPO_ASC_APP_ID`,
  `EXPO_APPLE_TEAM_ID`) — locally via shell env, in CI via secrets.
- **Android:** a Google Play Developer account ($25 once). Create the app in the
  Play Console, then download a service-account JSON with release permissions to
  `apps/mobile/google-service-account.json` (git-ignored — never commit it).

## Cutting a build

Builds are **manual only** (no auto-build on PRs) — run from the Actions tab →
**EAS Build** → *Run workflow*, or locally:
```bash
cd apps/mobile
eas build --platform all --profile preview        # internal distribution
eas build --platform all --profile production --auto-submit
```
The workflow's `submit: true` + `profile: production` does the same `--auto-submit`.

## Store listings & privacy
- iOS listing copy lives in `store/store.config.json`; push it with
  `eas metadata:push`.
- Google Play has no EAS metadata equivalent yet — paste fields from
  `store/listing.md` into the Play Console by hand.
- Complete **App Privacy** (iOS) and **Data safety** (Play) from
  `store/data-safety.md`. Keep both in sync with https://opnshelf.xyz/privacy.
- Provide a demo atproto account (handle + app password) in each store's review
  notes — sign-in requires an account.

## Testing tracks
- **iOS:** production builds auto-appear in TestFlight after processing; add
  internal/external testers in App Store Connect.
- **Android:** `submit` uploads to the `internal` track (see `eas.json`); promote
  to closed/open testing in the Play Console when ready.
