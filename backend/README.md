# Opnshelf backend

The backend workspace is the NestJS API for Opnshelf. Prisma persists indexed
data in PostgreSQL, while the ingester subscribes through Tab to AT Protocol
records defined by the repository's lexicons. The API serves the Shelf, Watch,
Activity Feed, Discover, authentication, and supporting media features used by
the web and mobile clients.

See the [repository README](../README.md) for prerequisites, local services,
initial setup, and the full environment-variable reference.

## Structure

- `src/` contains NestJS modules, controllers, services, DTOs, and generated
  Prisma and lexicon bindings.
- `prisma/` contains the database schema and migrations.
- [`../lexicons`](../lexicons) contains the source AT Protocol record
  definitions.
- `scripts/` contains maintenance and lexicon publication utilities.

Files under `src/generated/` and `src/lexicons/` are generated outputs. Update
their source schema or lexicon and regenerate them instead of editing generated
code by hand. The shared TypeScript API client is generated into
[`packages/api`](../packages/api) from the backend OpenAPI document.

## Environment

Configure `backend/.env` with values appropriate to the local environment:

- `DATABASE_URL` connects Prisma to PostgreSQL.
- `TMDB_API_KEY` and `TRAKT_API_KEY` enable external media and import data.
- `TAB_URL` locates the Tab ingestion service; `TAB_ADMIN_PASSWORD` supplies
  its matching administrator password.
- `PDS_URL` selects the Personal Data Server.
- `BACKEND_PUBLIC_URL` supplies the externally reachable OAuth callback base.
- `FRONTEND_URL` supplies the allowed frontend origin and redirect target.

Additional feature-specific variables are documented in the
[root environment tables](../README.md#environment-variables). Do not commit
local `.env` files.

## Commands

Run commands from the repository root:

```bash
pnpm dev:backend
pnpm --filter backend run build
pnpm --filter backend run check
pnpm --filter backend run typecheck
pnpm --filter backend run test
pnpm --filter backend run test:cov
```

Database and generated-client commands are also exposed at the root:

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm generate:api
```

`pnpm dev:backend` starts the API on port 3001 by default. Outside production,
Swagger UI is available at `/api` and its OpenAPI document at `/api-json`.
`pnpm generate:api` generates and reads the checked `backend/openapi.json`
specification offline; generated client code should not be edited by hand.
