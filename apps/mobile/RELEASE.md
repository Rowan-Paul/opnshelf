# Releasing the mobile app

This covers shipping Opnshelf to TestFlight (iOS) and Play internal testing
(Android) via EAS. The repo-side config (`eas.json`, the `EAS Build` workflow,
`store/`, icons in `assets/images/`) is committed; the steps below are the
external, credentialed parts that can't live in git.

## One-time setup

### 1. Expo / EAS project
```bash
cd apps/mobile
eas login                # an Expo account with the Opnshelf project
eas init                 # links the project, writes extra.eas.projectId to app.config.ts
```
Commit the `extra.eas.projectId` that `eas init` adds.

### 2. Build-time environment variables (EAS)
`build.preview.env` in `eas.json` holds the whole Staging environment: the API
and site URLs, a placeholder analytics key, the Turnstile site key, and both
Google client ids. It has to be complete, because `eas update` does not read
the EAS-hosted environments and publishes whatever this block contains — a
value that lives only in the EAS `preview` environment reaches builds and never
reaches an update, which is how Staging lost first its Google button and then
its captcha.

Set the production values in the EAS `production` environment instead:
```bash
eas env:set --environment production --name EXPO_PUBLIC_API_URL     --value "https://api.opnshelf.xyz"
eas env:set --environment production --name EXPO_PUBLIC_POSTHOG_KEY --value "<posthog key>" --visibility sensitive
```
(`eas env:create` is deprecated in favour of `env:set`.) Production updates are
safe to resolve that way because `release.yml` publishes with `--environment
production`; the Staging workflow deliberately does not.

PostHog is disabled on Staging, even if a real key is supplied. It requires a
non-development build using `https://api.opnshelf.xyz` and a configured key.

The production build also uploads its source maps to PostHog (see "Source maps"
below). That needs a PostHog **personal** API key with the "Source map upload"
preset (PostHog → Settings → Personal API keys), plus the project id from the
project's settings page:
```bash
eas env:create --environment production   --name POSTHOG_CLI_API_KEY    --value "<personal api key>" --visibility secret
eas env:create --environment production   --name POSTHOG_CLI_PROJECT_ID --value "<project id>"
eas env:create --environment production   --name POSTHOG_CLI_HOST       --value "https://eu.posthog.com"
```
The `development` and `preview` profiles set `POSTHOG_CLI_DRY_RUN=true` in
`eas.json` instead: the upload step runs but writes nothing, so those builds
need no PostHog credentials.

### 3. CI secrets
Add an Expo access token (`eas whoami`-capable, Personal/Robot token) as the
`EXPO_TOKEN` GitHub Actions secret so the **EAS Build** workflow can run.

The **Release** workflow's OTA job uploads source maps after `eas update`. Give
it the same PostHog values as GitHub Actions secrets: `POSTHOG_CLI_API_KEY` and
`POSTHOG_CLI_PROJECT_ID` (the host is in the workflow). Until they exist the
step logs a warning and skips, so a release is never blocked on telemetry.

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

## Source maps

PostHog's exception autocapture and the mutation-failure reports (ADR 0031)
arrive with Hermes stack traces. Without source maps those are byte offsets in
a minified bundle. Two pieces turn them back into TypeScript:

- `metro.config.js` builds on `getPostHogExpoConfig`, which stamps every bundle
  with a debug id. PostHog matches an exception to its map through that id.
- `posthog-react-native/expo` in `app.config.ts` hooks the Xcode and Gradle
  bundle phases and runs `posthog-cli hermes upload` after each native build.
  The phase fails the build when it cannot find the CLI or, without
  `POSTHOG_CLI_DRY_RUN`, when credentials are missing. The lookup runs before
  the dry-run check, so even a dry-run build needs the CLI on disk.

`@posthog/cli` is a devDependency of this app **and of the repository root**.
The Xcode phase locates the CLI through `npm root`, and because the root
`package.json` declares `workspaces`, npm answers with the root `node_modules`
rather than this app's. pnpm only creates a `.bin/posthog-cli` shim where the
package is a direct dependency, so without the root entry every iOS build ends
in `posthog-cli not found` (EAS build d44d5f1b, Sept 2026). The Gradle phase
checks the app's own `node_modules/.bin` first and never had the problem. Keep
both entries on the same version.

An OTA update is a JS-only export, so nothing native runs. The Release
workflow's OTA job uploads `dist/` itself right after `eas update`. Publishing
an update by hand needs the same step:
```bash
cd apps/mobile
eas update --channel production --environment production --message "..."
POSTHOG_CLI_API_KEY=... POSTHOG_CLI_PROJECT_ID=... POSTHOG_CLI_HOST=https://eu.posthog.com \
  pnpm exec posthog-cli hermes upload --directory dist \
    --release-name com.rowanpaul.opnshelf --release-version "<app version>"
```
Staging publishes no maps: PostHog is off there (ADR 0021).

Every event also carries `eas/update_id`, `eas/channel`, and
`eas/runtime_version` as super properties (`src/lib/posthog.ts`), so PostHog
links an exception to the exact update or build on expo.dev. They are null on
the embedded bundle of a fresh store build and on development builds.

Local release builds (`expo run:ios --configuration Release`, `expo run:android
--variant release`) hit the same upload phase. Keep `POSTHOG_CLI_DRY_RUN=true`
in `.env` (as in `.env.example`) so the phase is a no-op.

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
