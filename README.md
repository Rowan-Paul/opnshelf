# Opnshelf

Track what you watch and discover what others are watching. A personal media tracker built on the AT Protocol that keeps you in control of your data.

Logo masters, palette guidance, and the pre-launch clearance note live in [design/branding](design/branding/BRAND.md).

## Features

- **Track Movies & TV Shows** - Log movies and episodes you've watched with timestamps
- **Custom Lists** - Create and manage lists (Want to Watch, Favorites, Custom collections)
- **Social Discovery** - Follow friends and see what they're watching
- **Release Calendar** - Track upcoming releases and never miss a premiere
- **Trakt Import** - Import your watch history from Trakt.tv
- **AT Protocol OAuth** - Secure authentication with Bluesky/AT Protocol accounts
- **Cross-Platform** - Web app and mobile apps (iOS/Android) with synced data

## Tech Stack

- **Backend**: NestJS + Prisma + PostgreSQL + AT Protocol (Tab)
- **Web**: React + TanStack Start (SSR) + TanStack Router + Vite + Tailwind CSS v4
- **Mobile**: Expo + React Native + Expo Router + Uniwind + local UI components
- **Protocol**: AT Protocol (decentralized storage via `xyz.opnshelf.*` lexicons)
- **Design**: Dynamic theming derived from poster colors
- **Analytics**: PostHog
- **Monorepo**: pnpm workspaces + Turbo

## Project Structure

```
opnshelf/
├── apps/
│   ├── web/          # TanStack Start web app (port 3000)
│   └── mobile/       # Expo mobile app
├── backend/          # NestJS API (port 3001)
├── packages/
│   └── api/          # Shared API client (OpenAPI generated)
└── lexicons/         # AT Protocol record definitions
```

## Quick Start

### Prerequisites

- Node.js 24+
- pnpm 11.1.2+
- Docker (for local Tab)

### Setup

```bash
# Install dependencies
pnpm i

# Start PostgreSQL and Tab
docker-compose up -d

# Configure backend/.env
DATABASE_URL="postgresql://opnshelf:opnshelf@127.0.0.1:5432/opnshelf"
TMDB_API_KEY="your-tmdb-key"
TAB_URL="http://localhost:2480"
REDIS_URL="redis://127.0.0.1:6379"
TAB_ADMIN_PASSWORD="y29d6b572f17af0f150cd4b480bec85cf"

# Run migrations. This is `prisma migrate dev` against DATABASE_URL, so make
# sure backend/.env points at the local Postgres above, never at a hosted one.
pnpm prisma:migrate

# Start all services
pnpm dev
```

## AT Protocol Lexicons

User data is stored as AT Protocol records in their personal repository:

- `xyz.opnshelf.movie` - Tracked movies
- `xyz.opnshelf.episode` - Tracked TV episodes
- `xyz.opnshelf.list` - Custom lists
- `xyz.opnshelf.list.item` - Items in lists
- `xyz.opnshelf.rating` - Ratings for movies/episodes
- `xyz.opnshelf.review.like` - Likes on reviews
- `xyz.opnshelf.note` - Notes attached to media
- `xyz.opnshelf.mediaLink` - Links between records and media
- `xyz.opnshelf.follow` - Social follows
- `xyz.opnshelf.profile` - User profiles

The backend subscribes to the AT Protocol firehose via Tab to index public records for social discovery.

## Development Commands

```bash
# Individual services
pnpm dev:backend    # Backend API (port 3001)
pnpm dev:web        # Web app (port 3000)
pnpm dev:mobile     # Mobile app (Expo)

# Code quality
pnpm check          # Lint + format all packages
pnpm check:write    # Auto-fix issues
pnpm typecheck      # Type-check all packages

# Database
pnpm prisma:migrate
pnpm prisma:generate
pnpm generate:api   # Regenerate API client from OpenAPI
```

## Testing the mobile app on a physical device

The native app authenticates via AT Protocol OAuth, which needs an **HTTPS** URL the
phone can reach — `localhost`/LAN IPs won't work for the OAuth callback. The simplest
way is a Cloudflare quick tunnel pointed at the local backend.

```bash
# 1. Start a quick tunnel to the backend (leave it running)
cloudflared tunnel --url http://localhost:3001
# → prints a URL like https://random-words.trycloudflare.com
#   (the API returns a transient 1101 error now and then — just rerun)

# 2. Point both env files at that URL, then restart the affected service:
#    backend/.env       BACKEND_PUBLIC_URL=https://random-words.trycloudflare.com   → restart backend
#    apps/mobile/.env   EXPO_PUBLIC_API_URL=https://random-words.trycloudflare.com  → restart `expo start`
```

Notes:

- **Quick tunnels are ephemeral.** The URL changes every time `cloudflared` restarts, so
  you must re-edit both env files and restart backend + Expo each time. For a stable URL,
  use a named tunnel with a DNS route instead.
- **One auth domain at a time.** The backend advertises a single `BACKEND_PUBLIC_URL`, and
  the login cookie binds to it. So you get a working session on *either* the tunnel (native
  mobile) *or* `http://127.0.0.1:3001` (web browser) — not both at once. Switch
  `BACKEND_PUBLIC_URL` (and restart the backend) depending on which you're testing.
- CORS only allows the localhost web origins, which doesn't affect the native app (no
  browser origin check). `eas.json` keeps the `127.0.0.1` default — the tunnel URL belongs
  only in your local `apps/mobile/.env`.

## Environment Variables

### Backend (`backend/.env`)

<!-- backend-env:start -->
| Variable | Requirement | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Defaulted | Runtime mode; defaults to development. |
| `PORT` | Defaulted | HTTP listening port; defaults to 3001. |
| `DATABASE_URL` | Required in production | PostgreSQL connection string. |
| `TMDB_API_KEY` | Required in production | TMDB API key for catalogue reads. |
| `PDS_URL` | Required in production | Tranquil Personal Data Server URL. |
| `PDS_HANDLE_DOMAIN` | Required in production | Handle domain served by the PDS. |
| `PDS_ADMIN_IDENTIFIER` | Required in production | PDS admin account used for account management. |
| `PDS_ADMIN_PASSWORD` | Required in production | PDS admin account password. |
| `BACKEND_PUBLIC_URL` | Required in production | Public API URL for OAuth callbacks and avatars. |
| `BACKEND_URL` | Optional | Legacy fallback base URL for avatar links. |
| `FRONTEND_URL` | Required in production | Web origin for CORS, redirects and notification links. |
| `TAB_URL` | Required in production | Tab ingestion service URL; local fallback is http://localhost:2480. |
| `TAB_ADMIN_PASSWORD` | Required in production | Tab admin password; must match its container. |
| `TAP_URL` | Optional | Deprecated alias for TAB_URL; accepted for one transition release. |
| `TAP_ADMIN_PASSWORD` | Optional | Deprecated alias for TAB_ADMIN_PASSWORD; accepted for one transition release. |
| `REDIS_URL` | Optional | Optional TMDB cache; absence uses process memory, including on Staging (ADR 0041). |
| `GOOGLE_CLIENT_ID` | Required in production | Google OAuth client ID shared with the PDS. |
| `GOOGLE_CLIENT_SECRET` | Required in production | Google OAuth client secret shared with the PDS. |
| `APPLE_CLIENT_ID` | Required in production | Apple Service ID shared with the PDS. |
| `APPLE_TEAM_ID` | Required in production | Apple developer team ID (10 characters). |
| `APPLE_KEY_ID` | Required in production | Apple signing key ID (10 characters). |
| `APPLE_PRIVATE_KEY` | Required in production | Apple P-256 private signing key; escaped newlines are accepted. |
| `PROVIDER_STATE_SECRET` | Required in production | CSRF signing secret for provider callbacks; at least 32 characters. |
| `SSR_RATE_LIMIT_SECRET` | Optional | Optional Web/API forwarding secret; enable only after trusted-edge verification (ADR 0025). |
| `TURNSTILE_SECRET_KEY` | Required in production | Cloudflare Turnstile server secret for signup captcha. |
| `CLOUDFLARE_API_TOKEN` | Required in production | Cloudflare Email Sending API token for notifications. |
| `CLOUDFLARE_ACCOUNT_ID` | Required in production | Cloudflare account ID for notification delivery. |
| `TRAKT_API_KEY` | Required in production | Trakt API key for history imports. |
| `FEEDBACK_GITHUB_TOKEN` | Optional | Optional GitHub token for feedback issues; absent configuration saves feedback only (ADR 0007). |
| `FEEDBACK_GITHUB_REPOSITORY` | Optional | Optional owner/repository receiving feedback issues. |
| `PDS_MAINTENANCE_MODE` | Defaulted | Pause PDS writes and authentication; true/false, 1/0, yes/no or on/off; defaults to false. |
| `PDS_MAINTENANCE_RETRY_AFTER_SECONDS` | Defaulted | Maintenance Retry-After header in seconds; defaults to 300. |
<!-- backend-env:end -->

The table is generated from `backend/src/config/env.schema.ts`; run
`pnpm --filter backend run env:docs` after changing the schema. Backend tests
check it for drift. Empty values count as absent; supplied values are validated
in every mode. Production requirements also apply to Staging, which runs
`NODE_ENV=production`. Redis remains optional under ADR 0041. Local integrations
may be disabled, but real local API usage still needs a database, TMDB and a PDS.

Validation runs before Nest boots and reports only missing/invalid variable
names. The backend uses plain Zod so conditional production requirements, value-free
aggregate errors and generated documentation share one schema. A typed global
Nest provider replaces ConfigModule loading; no T3 wrapper is needed. Node 24 loads `backend/.env` when commands run in the backend workspace;
already-set deployment variables take precedence.

`TAB_URL` and `TAB_ADMIN_PASSWORD` are canonical. For the transition release,
`TAP_URL` and `TAP_ADMIN_PASSWORD` remain accepted with a deprecation warning;
nonempty canonical values win. Before removing aliases in the following release,
rename legacy variables on each Railway Server service to `TAB_*`, retaining the
same environment-specific values/references. First verify a Staging deploy with
its current names unchanged, then rename and verify again. Do not change the
Tab service's own upstream variable names or share Tab between environments.
Deployment and Railway changes require operator approval.

`backend/.env.example` provides local setup examples. Deployed values live in
Railway service variables on the `Server` service and are never checked in.

### Web (`apps/web/.env`)

| Variable | Description |
|----------|-------------|
| `SSR_RATE_LIMIT_SECRET` | Server-only shared Web/API signing secret, at least 32 characters. Leave unset until the [trusted-edge verification](docs/runbooks/ssr-rate-limiting.md) passes; use separate values per environment |
| `VITE_API_URL` | Backend API URL |
| `VITE_POSTHOG_KEY` | PostHog analytics key |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for the signup captcha (public, domain-locked) |

### Mobile (`apps/mobile/.env`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API URL — the Cloudflare tunnel URL when testing on a device (see [Testing the mobile app on a physical device](#testing-the-mobile-app-on-a-physical-device)) |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for the signup captcha |
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog analytics key |

## Test data

There is no seed script and no fixture database. Everything the API serves is
indexed from AT Protocol records, so you get test data by producing records and
letting the ingester index them:

1. `docker-compose up -d` starts a local Postgres (`opnshelf`/`opnshelf` on
   `5432`) and a local Tab on `2480` filtered to `xyz.opnshelf.*`.
2. Point `DATABASE_URL`, `TAB_URL` and `TAB_ADMIN_PASSWORD` in `backend/.env`
   at those containers (the Quick Start values), run `pnpm prisma:migrate`,
   then `pnpm dev`.
3. Sign in on the Web App with an AT Protocol handle. On every sign-in and
   signup the backend calls `IngesterService.addRepo(did)`
   (`backend/src/ingester/ingester.service.ts`), Tab backfills that repo's
   history and streams new records over a WebSocket channel, and the ingester
   writes them to your local Postgres. Log a Watch or a Rating and it shows up
   in the database within seconds.

Things to know before you do that:

- **PDS writes are real.** The default `PDS_URL` is the production PDS, and
  there is no test PDS: Staging shares it too (ADR 0021). Anything you log from
  a local backend is a public record on that account and federates. Use a
  throwaway account or the Staging Account, not your own.
- **Use your own Tab.** Never point `TAB_URL` at Staging's or production's Tab.
  Tab channels share one cursor, so a second consumer acks events the real
  backend never sees (ADR 0021).
- **Never migrate a hosted database from your machine.** `pnpm prisma:migrate`
  is `prisma migrate dev`. Shared databases only ever get
  `prisma migrate deploy`, with explicit operator approval.
- **No dumps.** Do not copy Staging or production data locally; there is no
  sanctioned export, and none is needed for the flow above.
- `TMDB_API_KEY` is required for any Media Item to resolve. Get a free key from
  TMDB. `TRAKT_API_KEY` is only needed to exercise Trakt Import.

## External dependencies

Derived from the env var reads in `backend/src` and the client `env` modules.
Deployed backend values are Railway service variables on the `Server` service,
per environment; web values are Railway variables on the `Web` service; mobile
values are baked in per EAS build profile (`apps/mobile/eas.json` `env` blocks).
Locally they live in the `.env` files. Values themselves are never in the repo.

| System | Purpose | Connection | Env vars |
| --- | --- | --- | --- |
| TMDB | Movie, show, season, episode and Person metadata; search; Discover sections | HTTPS to `api.themoviedb.org/3` from `backend/src/tmdb/tmdb-http.ts` and the `*-tmdb.service.ts` files | `TMDB_API_KEY` |
| Trakt | Trakt Import source | HTTPS to `api.trakt.tv` from `backend/src/users/trakt-api.client.ts` | `TRAKT_API_KEY` |
| Tranquil PDS | Hosts Opnshelf handles; OAuth sign-in; all `xyz.opnshelf.*` record writes; email verification. The backend signs in as a PDS admin to mint a single-use invite code per signup (`com.atproto.server.createInviteCode`) | AT Protocol OAuth and XRPC from `backend/src/auth/auth.service.ts` and `backend/src/pds/tranquil-admin.service.ts`. Runs in the separate `opnshelf-pds` Railway project (ADR 0019) | `PDS_URL`, `PDS_HANDLE_DOMAIN`, `PDS_ADMIN_IDENTIFIER`, `PDS_ADMIN_PASSWORD`, `BACKEND_PUBLIC_URL` |
| Tab | Indexes `xyz.opnshelf.*` records from tracked repos and delivers them to the backend | WebSocket channel via `@atproto/tap` from `backend/src/ingester/ingester.service.ts`; repos are added on sign-in and signup, events are acked only after indexing. Local: docker-compose. Deployed: one `tap` service per environment, never shared (ADR 0021) | `TAB_URL`, `TAB_ADMIN_PASSWORD` |
| Cloudflare Turnstile | Human check before an invite code is minted at signup | Server-side verify against `challenges.cloudflare.com` in `backend/src/pds/captcha.service.ts`; widget in `apps/web/src/components/TurnstileWidget.tsx` and the Mobile App signup WebView | `TURNSTILE_SECRET_KEY` (backend), `VITE_TURNSTILE_SITE_KEY` (web), `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (mobile) |
| Cloudflare Email Sending | Feedback notification email to an admin inbox (ADR 0007). The PDS sends its own mail through `services/mail-relay` | REST call from `backend/src/email/email.service.ts`, used by `backend/src/feedback/feedback.service.ts` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `FEEDBACK_NOTIFICATION_EMAIL` |
| Google OAuth | "Continue with Google" signup. Same OAuth client as the PDS's own Google SSO, with the backend callback added as a second redirect URI | Consent and token exchange in `backend/src/pds/google-oauth.service.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Sign in with Apple | "Continue with Apple" signup. Same Apple Service ID as the PDS's own Apple SSO, with the backend callback added as a second Return URL. The Service ID must have the iOS App ID as its primary app, or native and browser sign-ins produce different Apple subjects and one person gets two accounts | Authorize URL, ES256 client secret and token exchange in `backend/src/pds/apple-oauth.service.ts` | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |
| Bluesky public API | Follow suggestions and Bluesky follow import (`app.bsky.graph.getFollows`), handle typeahead on sign-in, profile lookups | Unauthenticated HTTPS to `public.api.bsky.app/xrpc` from `backend/src/social/social.service.ts`, `backend/src/users/users.service.ts`, `backend/src/auth/auth.service.ts` | none |
| PostHog | Product analytics, clients only; the backend does not report | `apps/web/src/integrations/posthog/provider.tsx` (initialises only on the production origin), `apps/mobile/src/lib/posthog.ts` | `VITE_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` |
| PostgreSQL | Index of everything above plus sessions, jobs and local-only state such as Circles | Prisma from `backend/src/prisma/prisma.service.ts`. Local: docker-compose. Deployed: one Railway Postgres per environment | `DATABASE_URL` |

## Testing a change

The verification matrix in [`AGENTS.md`](AGENTS.md#verification-matrix) says
which gates a change must pass; `.github/workflows/ci.yml` runs the same
commands. Type and lint checks for every workspace:

```bash
pnpm typecheck
pnpm check
```

Each workspace's `test` script is `vitest run`. Run the whole suite, or a
single file by passing its path to `vitest` directly:

```bash
# Backend (picks up src/**/*.spec.ts)
pnpm --filter backend run test
pnpm --filter backend exec vitest run src/auth/auth.guard.spec.ts

# Web (*.test.tsx under jsdom)
pnpm --filter web run test
pnpm --filter web exec vitest run src/components/StoreBadges.test.tsx

# Mobile (*.test.ts(x) with src/test/setup.ts)
pnpm --filter mobile run test
pnpm --filter mobile exec vitest run src/lib/relative-time.test.ts
```

Drop `run` from the `vitest` invocation for watch mode. Backend changes also
need `pnpm --filter backend run build`; API contract changes need
`pnpm generate:api` and a review of the generated diff.

To check a change against the real app, follow [Test data](#test-data), then
`pnpm dev`. The Web App is on `http://127.0.0.1:3000`, the API on
`http://127.0.0.1:3001` with Swagger at `/api`. For the Mobile App on a
device, see [Testing the mobile app on a physical device](#testing-the-mobile-app-on-a-physical-device).

## Documentation

[`docs/README.md`](docs/README.md) indexes the ADRs, product briefs, runbooks
and implementation plans. Working rules are in [`AGENTS.md`](AGENTS.md) and
vocabulary in [`CONTEXT.md`](CONTEXT.md).

## License

MIT
