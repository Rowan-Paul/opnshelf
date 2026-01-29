# OpnShelf

A personal media tracker built on the AT Protocol. Track movies you've watched and discover what others are watching - all while owning your data.

## Tech Stack

- **Backend**: NestJS + OpenAPI + PostgreSQL
- **Web**: TanStack Start
- **Mobile**: Expo / React Native
- **Protocol**: AT Protocol (decentralized data storage)
- **Monorepo**: pnpm workspaces + Turbo

## Project Structure

```
opnshelf/
├── apps/
│   ├── web/          # TanStack Start web app
│   └── mobile/       # Expo mobile app
├── packages/
│   ├── api/          # Shared API client (OpenAPI generated types)
│   └── types/        # Shared TypeScript types
└── backend/          # NestJS API + Firehose indexer
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL (Railway recommended)

### Setup

1. Clone and install dependencies:
```bash
pnpm install
```

2. Configure environment variables:
```bash
# backend/.env
DATABASE_URL="postgresql://..."
TMDB_API_KEY="..."
```

3. Run database migrations:
```bash
pnpm prisma:migrate
```

4. Start development servers:
```bash
# All services
pnpm dev

# Or individually
pnpm dev:backend
pnpm dev:web
pnpm dev:mobile
```

### Generate API Types

After backend changes:
```bash
pnpm generate:api
```

## MVP Features

- Movie search (TMDB)
- Track watched movies (stored in AT Protocol)
- Browse trending/popular movies (no login required)
- AT Protocol OAuth authentication
- Dark mode with Material You inspired design

## Architecture

Users track movies which are stored as AT Protocol records in their personal data repository. The backend subscribes to the AT Protocol firehose to index public records, enabling discovery and social features while users maintain ownership of their data.

## License

MIT
