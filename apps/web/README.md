# Opnshelf web

The web workspace is the server-rendered Opnshelf frontend. It uses React,
TanStack Start and TanStack Router, Vite, TanStack Query, and Tailwind CSS.
See the [repository README](../../README.md) for prerequisites, initial setup,
and the complete environment-variable reference.

## Structure

- `src/routes/` contains TanStack Router file-based routes. The generated
  `src/routeTree.gen.ts` file is updated by the router tooling and should not be
  edited by hand.
- `src/components/` contains shared application and UI components.
- `src/lib/` contains API setup, hooks, and frontend utilities.
- `src/integrations/` contains framework integrations such as TanStack Query
  and PostHog.

The frontend imports request helpers and types from the generated
`@opnshelf/api` workspace in [`packages/api`](../../packages/api). Regenerate
that client from the backend OpenAPI document instead of editing generated
client code directly:

```bash
pnpm generate:api
```

## Environment

Create `apps/web/.env` when local values are needed:

- `VITE_API_URL` sets the backend API URL.
- `VITE_POSTHOG_KEY` enables PostHog analytics when present.
- `SSR_RATE_LIMIT_SECRET` is a server-only runtime secret shared with the API.
  Leave it unset locally. A configured value must have at least 32 characters;
  the Web env schema rejects shorter values. Never use a `VITE_` prefix or a
  Docker build argument. Complete the [trusted-edge spoof test](../../docs/runbooks/ssr-rate-limiting.md)
  before activation in each environment.

Server variables are validated by `src/env.ts` using `process.env` only in the
SSR build. The signing helper is dynamically imported inside
`createIsomorphicFn().server(...)`; that compiler boundary, not its `.server.ts`
filename, excludes it from browser output.

Refer to the [root environment documentation](../../README.md#environment-variables)
for the corresponding backend and mobile settings.

## Source maps

Production builds upload source maps to PostHog when both
`POSTHOG_CLI_API_KEY` and `POSTHOG_CLI_PROJECT_ID` are set in the build
environment. The API key must be a personal API key with Error Tracking write
and Organization read scopes, not the public `VITE_POSTHOG_KEY`.
`POSTHOG_CLI_HOST` defaults to `https://eu.posthog.com`.
Railway's `RAILWAY_GIT_COMMIT_SHA` build argument supplies the release version;
the Docker build has no Git checkout from which PostHog could infer it.

Set these variables on the Railway Web service before its next deployment;
the Dockerfile accepts them as build arguments. Docker ARGs alone do not persist
as runtime environment variables, but Railway also injects service variables
into the running container. The Docker command removes `POSTHOG_CLI_API_KEY`
before starting Node so the SSR process does not inherit the upload credential.
Keep the key out of `VITE_` variables. For local builds, export it only in the
build shell; Vite does not load `.env` into `process.env` while evaluating this
config. Local server launches must not inherit the upload key either.

The Vite plugin injects chunk IDs before asset hashing, uploads the matching
maps, and deletes them before Nitro copies and compresses the public assets.
An independent build guard fails if any maps remain in the client output.
Builds without credentials skip source map generation and uploading. Once
configured, upload failures fail the build so it cannot silently ship missing
maps. Existing deployed bundles need a new build; this does not repair maps
for older releases. Mobile has its own native and OTA upload configuration
documented in [Mobile releases](../mobile/RELEASE.md#source-maps).

See [PostHog's Vite setup](https://posthog.com/docs/error-tracking/upload-source-maps/vite).

## Commands

Run commands from the repository root:

```bash
pnpm dev:web
pnpm --filter "./apps/web" run build
pnpm --filter "./apps/web" run check
pnpm --filter "./apps/web" run typecheck
pnpm --filter "./apps/web" run test
```

`pnpm dev:web` starts Vite on port 3000. Routes are defined by files under
`src/routes/`; add or change route files there and let TanStack Router refresh
the generated route tree.
