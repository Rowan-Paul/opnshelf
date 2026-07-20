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
