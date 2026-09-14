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
