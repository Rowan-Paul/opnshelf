# OpnShelf

A personal media tracker built on the AT Protocol. Track movies you've watched and discover what others are watching - all while owning your data.

## Tech Stack

- **Backend**: NestJS + Prisma + PostgreSQL + AT Protocol (TAP/Firehose)
- **Web**: React + TanStack Start (SSR) + TanStack Router + Vite + Tailwind CSS
- **Mobile**: Expo / React Native + Tailwind CSS
- **Protocol**: AT Protocol (decentralized data storage with OAuth authentication)
- **Monorepo**: pnpm workspaces + Turbo

## Project Structure

```
opnshelf/
├── apps/
│   ├── web/          # TanStack Start web app (port 3000)
│   └── mobile/       # Expo mobile app
├── packages/
│   ├── api/          # Shared API client (OpenAPI generated types + TanStack Query hooks)
│   └── types/        # Shared TypeScript types
└── backend/          # NestJS API + Firehose indexer (port 3001)
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 10+
- Docker & Docker Compose (for local TAP development)

### Setup

1. Clone and install dependencies:
```bash
pnpm install
```

2. Start the local database and TAP:
```bash
docker-compose up -d
```

3. Configure environment variables:
```bash
# backend/.env
DATABASE_URL="postgresql://opnshelf:opnshelf@127.0.0.1:5432/opnshelf"
TMDB_API_KEY="your-tmdb-api-key"
BACKEND_PUBLIC_URL="http://127.0.0.1:3001"
FRONTEND_URL="http://127.0.0.1:3000"
PORT=3001

# Local TAP (development)
TAP_URL="http://localhost:2480"
TAP_ADMIN_PASSWORD="y29d6b572f17af0f150cd4b480bec85cf"
```

4. Run database migrations:
```bash
pnpm prisma:migrate
```

5. Generate the Prisma client:
```bash
pnpm prisma:generate
```

6. Start development servers:
```bash
# All services
pnpm dev

# Or individually
pnpm dev:backend    # Backend API (port 3001)
pnpm dev:web        # Web app (port 3000)
pnpm dev:mobile     # Mobile app (Expo)
```

### Generate API Types

After backend changes, regenerate the shared API client:
```bash
pnpm generate:api
```

This generates TypeScript types and TanStack Query hooks from the OpenAPI spec.

## Local TAP Development

TAP (The AT Protocol ingestion service) syncs user movie records from the AT Protocol network. For local development, you can run your own TAP instance using Docker Compose.

### Start TAP Locally

```bash
# Start TAP and PostgreSQL
docker-compose up -d

# Check TAP is running
curl http://localhost:2480/health
```

This will start:
- **TAP** on port 2480 (WebSocket for AT Protocol events)
- **PostgreSQL** on port 5432 (for your app data)

### Environment Configuration

The backend `.env` is already configured to use the local TAP instance:

```bash
TAP_URL="http://localhost:2480"
TAP_ADMIN_PASSWORD="y29d6b572f17af0f150cd4b480bec85cf"
```

### Switching Between Environments

Comment/uncomment the appropriate lines in `backend/.env` to switch between:
- **Local development**: `http://localhost:2480` (isolated, no interference with production)
- **Production**: Your deployed TAP instance

### Stop TAP

```bash
docker-compose down

# To also remove data volumes:
docker-compose down -v
```

## Development Commands

### Web App (apps/web)

```bash
cd apps/web
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm test             # Run Vitest tests
pnpm lint             # Run Biome linter
pnpm format           # Format code with Biome
pnpm check            # Run both lint and format checks
```

### Backend

```bash
cd backend
pnpm dev              # Start dev server with watch
pnpm build            # Production build
pnpm test             # Run Jest tests
pnpm test:watch       # Watch mode
pnpm test:cov         # Coverage report
pnpm lint             # ESLint + Prettier
pnpm format           # Format with Prettier
pnpm lex:build        # Build AT Protocol lexicons
```

### Mobile App

```bash
cd apps/mobile
pnpm start            # Start Expo development server
pnpm android          # Run on Android
pnpm ios              # Run on iOS
pnpm typecheck        # TypeScript check
```

## Workspace Commands

Run commands in specific packages:

```bash
pnpm --filter web <command>
pnpm --filter backend <command>
pnpm --filter mobile <command>
pnpm --filter @opnshelf/api <command>
```

## Features

- **Movie Search**: Search movies via TMDB API
- **Track Watched Movies**: Store watched movies as AT Protocol records in your personal data repository
- **Browse Trending/Popular**: Discover movies without logging in
- **AT Protocol OAuth**: Secure authentication with Bluesky/AT Protocol accounts
- **Social Discovery**: Browse what others are watching (public records indexed via Firehose)
- **Dark Mode**: Material You inspired design system

## Architecture

Users track movies which are stored as AT Protocol records in their personal data repository (`xyz.opnshelf.movie` lexicon). The backend subscribes to the AT Protocol firehose via TAP to index public records, enabling discovery and social features while users maintain ownership of their data.

### Database Schema

- **User**: AT Protocol users (DID, handle, profile info)
- **Movie**: Movie metadata from TMDB (with extracted poster colors)
- **TrackedMovie**: Links users to movies they track (with AT Protocol record URI/CID)
- **AuthSession/AuthState**: OAuth session storage for AT Protocol authentication

## Testing

### Backend Tests

```bash
cd backend
pnpm test             # Run all tests
pnpm test -- auth.service.spec.ts      # Single test file
pnpm test -- --testNamePattern="should create"  # Pattern matching
```

### Web Tests

```bash
cd apps/web
pnpm test             # Run Vitest
pnpm test -- src/routes/index.test.tsx # Single file
```

## Lint & Type Check

Before committing, ensure code quality:

```bash
# Web
cd apps/web && pnpm check && pnpm tsc --noEmit

# Backend
cd backend && pnpm check && pnpm tsc --noEmit

# Mobile
cd apps/mobile && pnpm check && pnpm tsc --noEmit
```

## License

MIT
