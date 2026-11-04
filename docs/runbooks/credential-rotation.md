# Credential rotation

A credential usually has more than one copy: a Railway variable, a GitHub
Actions secret, an EAS environment variable. Rotating it means replacing every
copy, and a missed copy stays invisible until the build that reads it. On
2026-11-02 a new PostHog upload key went into Railway and GitHub but not into
EAS, and the next release's iOS and Android production builds both failed at
the source-map upload, after the native build had already run.

This page lists every copy the repository can account for. Names only: values
live in Railway, GitHub and EAS, never here. Do not verify a rotation by
printing deployed values (`railway variables`, `eas env:list` with values,
`gh secret` output); use the preflight below.

## Rotating a credential

1. Find its row below. Replace the value in every consumer listed, plus any
   item in [To confirm with Rowan](#to-confirm-with-rowan) that names it.
   Pipe values through stdin (`railway variable set NAME --stdin`,
   `gh secret set NAME < file`), never as a command argument.
2. For an upload/build credential, run the preflight with the new value in the
   environment: `node scripts/release-preflight.mjs`. It prints `ok`,
   `invalid`, `not set` or `unchecked` per credential, never the value, and
   exits non-zero on `invalid`.
3. Revoke the old value at the provider only after every copy is replaced.
   Railway variables apply on the next deploy (`--skip-deploys` defers them).

### Where the preflight runs

| Copy | Checked by | When |
| --- | --- | --- |
| GitHub secrets `EXPO_TOKEN`, `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID` | `Check release credentials` step in `.github/workflows/release.yml` (`validate` job) | On the `develop` → `main` release PR and before the release job publishes, dispatches EAS builds or uploads OTA maps |
| EAS `POSTHOG_CLI_API_KEY` | `eas-build-pre-install` in `apps/mobile/package.json` | First step of every EAS build, before dependencies install and the native compile. The build is already queued and counts against the plan's build quota |
| Railway `Web` `POSTHOG_CLI_API_KEY` | `apps/web/Dockerfile`, before `vite build` | Every Web deploy |

`unchecked` means the provider was unreachable or returned an unexpected
status; the preflight does not fail on it, and the real upload step will.
A PostHog key that authenticates but lacks read scopes reports `ok`, because
the upload preset may not grant `project:read`.

## Build and deploy credentials

| Credential | Provider | Railway (service / environment) | GitHub Actions secret (workflow) | EAS environment variable (profile) | Preflight |
| --- | --- | --- | --- | --- | --- |
| `POSTHOG_CLI_API_KEY`: personal API key, "Source map upload" preset | PostHog (EU) | `Web` / production (Docker build arg for `@posthog/rollup-plugin`, unset before the server starts) | `POSTHOG_CLI_API_KEY` (`release.yml`: `validate` preflight, `ota` source-map upload) | `POSTHOG_CLI_API_KEY`, environment `production` (profile `production`; read by `posthog-react-native/expo` during the native bundle phase). `development` and `preview` set `POSTHOG_CLI_DRY_RUN=true` in `eas.json` instead | yes |
| `POSTHOG_CLI_PROJECT_ID` (identifier, rotate with the key if the project changes) | PostHog | `Web` / production | `POSTHOG_CLI_PROJECT_ID` (`release.yml`) | `POSTHOG_CLI_PROJECT_ID`, `production` | used by the PostHog check |
| `EXPO_TOKEN`: Expo personal or robot access token | Expo | none | `EXPO_TOKEN` (`release.yml` `validate` + `ota`, `staging.yml` `update`, `eas-build.yml` `build`) | none | yes (GitHub copy) |
| Store signing and submission: iOS distribution certificate and provisioning profiles, App Store Connect access for `eas submit`, Android upload keystore, Google Play service-account key | Apple, Google | none | none | Stored in EAS credentials (`eas credentials`), not environment variables. The Play service-account key is assigned under EAS → Credentials → Android → `com.rowanpaul.opnshelf` (`apps/mobile/RELEASE.md`) | no |
| `EXPO_APPLE_ID`, `EXPO_ASC_APP_ID`, `EXPO_APPLE_TEAM_ID` (identifiers for `eas submit`, not secrets) | Apple | none | same names (`eas-build.yml` `build`) | none | no |
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | Docker Hub | none | same names (`pds-operator-image.yml`, `tranquil-image.yml`) | none | no |

Public, domain-locked keys are not secrets, but they also have several copies
and are baked in at build time, so a change needs every copy and a rebuild or
OTA update:

| Key | Railway | EAS / `eas.json` |
| --- | --- | --- |
| PostHog project key | `VITE_POSTHOG_KEY` on `Web` (build arg) | `EXPO_PUBLIC_POSTHOG_KEY` in EAS `production`; `eas.json` `preview` holds a placeholder |
| Cloudflare Turnstile site key | `VITE_TURNSTILE_SITE_KEY` on `Web` (build arg) | `EXPO_PUBLIC_TURNSTILE_SITE_KEY` in `eas.json` `preview` and EAS `production` |
| Google OAuth client ids | `GOOGLE_CLIENT_ID` on `Server` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `eas.json` `preview` and EAS `production` |

## Runtime credentials

Read by deployed services at runtime. None has a GitHub or EAS copy. `Server`
and `Web` live in the Opnshelf Railway project with `production` and `staging`
environments; `tranquil-pds` and `mail-relay` live in the separate
`opnshelf-pds` project (ADR 0019). Use a distinct value per environment where
the column says so.

| Variable | Provider | Railway consumers | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Railway Postgres | `Server` / production, staging | One database per environment |
| `TMDB_API_KEY` | TMDB | `Server` / production, staging | |
| `TRAKT_API_KEY` | Trakt | `Server` / production, staging | |
| `PDS_ADMIN_PASSWORD` | Tranquil PDS admin account | `Server` / production, staging | Must match the admin account on `tranquil-pds`; Staging shares the production PDS |
| `TAB_ADMIN_PASSWORD` | Tab | `Server` / each environment, as a reference to that environment's `tap` service | Rotate on `tap`; the reference follows |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | `Server` / production, staging; the PDS's own Google SSO uses the same client | |
| `APPLE_PRIVATE_KEY` | Apple (.p8) | `Server` / production, staging; `SSO_APPLE_PRIVATE_KEY` on `tranquil-pds` / production | `scripts/push-apple-secrets.sh` sets all three from one file |
| `PROVIDER_STATE_SECRET` | self-generated | `Server` / production, staging (distinct values) | Rotating breaks Apple signups in flight; `push-apple-secrets.sh` only writes it when absent |
| `SSR_RATE_LIMIT_SECRET` | self-generated | `Server` and `Web` / production, staging (same value within an environment, distinct between them) | See [SSR rate limiting](ssr-rate-limiting.md) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile | `Server` / production, staging | |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Email Sending | `Server` / production, staging; `mail-relay` / production | `mail-relay` needs a user-owned token (`services/mail-relay/README.md`) |
| `FEEDBACK_GITHUB_TOKEN` | GitHub fine-grained token | `Server` / production, staging | Issues read/write on one repository |
| `REDIS_URL` | Railway Redis | `Server`, where set | Optional (ADR 0041) |
| `LHCI_BASIC_AUTH_PASSWORD` | self-generated | the Lighthouse dashboard service (`services/lighthouse`) | Clients read `LHCI_SERVER_URL`, `LHCI_BUILD_TOKEN`, `LHCI_BASIC_AUTH_*` in `lighthouserc.cjs` |
| `LEXICON_PUBLISHER_PASSWORD` | PDS account | none; local shell for `backend/scripts/publish-lexicons.ts` | |

## To confirm with Rowan

The repository cannot answer these. Update the tables above once confirmed.

- Whether `POSTHOG_CLI_API_KEY` / `POSTHOG_CLI_PROJECT_ID` are set on `Web` /
  staging, or production only.
- Whether the EAS `preview` or `development` environments hold a
  `POSTHOG_CLI_API_KEY` copy (the profiles dry-run, so a stale copy would not
  fail a build, but it would still be a stale secret).
- Which `EXPO_TOKEN` it is (personal or robot) and whether any other place
  holds it, such as a local shell profile.
- How `eas submit` authenticates to App Store Connect: an ASC API key stored in
  EAS credentials, or an Apple ID session.
- Whether the Google Play service-account key or the ASC API key has a copy
  outside EAS credentials.
- The variable names `tranquil-pds` uses for the shared Google OAuth client
  secret, and any other PDS-side credential (S3 bucket keys, PLC rotation key,
  JWT secrets) that `tranquil-pds` reads.
- Whether `Server` and `mail-relay` share one Cloudflare token or hold two.
- Where the Lighthouse dashboard service runs and where `LHCI_BUILD_TOKEN` is
  kept.
- Whether any credential lives only in a Railway shared variable, which the
  per-service names above would not show.
