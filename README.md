# OpnShelf

Track what you watch and discover what others are watching. A personal media tracker built on the AT Protocol that keeps you in control of your data.

## Features

- **Track Movies & TV Shows** - Log movies and episodes you've watched with timestamps
- **Custom Lists** - Create and manage lists (Want to Watch, Favorites, Custom collections)
- **Social Discovery** - Follow friends and see what they're watching
- **Release Calendar** - Track upcoming releases and never miss a premiere
- **Trakt Import** - Import your watch history from Trakt.tv
- **AT Protocol OAuth** - Secure authentication with Bluesky/AT Protocol accounts
- **Cross-Platform** - Web app and mobile apps (iOS/Android) with synced data

## Tech Stack

- **Backend**: NestJS + Prisma + PostgreSQL + AT Protocol (TAP)
- **Web**: React + TanStack Start (SSR) + TanStack Router + Vite + Tailwind CSS v4
- **Mobile**: Expo + React Native + React Native Paper
- **Protocol**: AT Protocol (decentralized storage via `xyz.opnshelf.*` lexicons)
- **Design**: Material You (dynamic theming based on poster colors)
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

- Node.js 18+
- pnpm 10+
- Docker (for local TAP)

### Setup

```bash
# Install dependencies
pnpm install

# Start PostgreSQL and TAP
docker-compose up -d

# Configure backend/.env
DATABASE_URL="postgresql://opnshelf:opnshelf@127.0.0.1:5432/opnshelf"
TMDB_API_KEY="your-tmdb-key"
TAP_URL="http://localhost:2480"

# Run migrations
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
- `xyz.opnshelf.follow` - Social follows
- `xyz.opnshelf.profile` - User profiles

The backend subscribes to the AT Protocol firehose via TAP to index public records for social discovery.

## Development Commands

```bash
# Individual services
pnpm dev:backend    # Backend API (port 3001)
pnpm dev:web        # Web app (port 3000)
pnpm dev:mobile     # Mobile app (Expo)

# Code quality
pnpm check          # Lint + format all packages
pnpm check:write    # Auto-fix issues

# Database
pnpm prisma:migrate
pnpm prisma:generate
pnpm generate:api   # Regenerate API client from OpenAPI
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `TMDB_API_KEY` | TMDB API key for movie data |
| `TRAKT_API_KEY` | Trakt.tv API key for imports |
| `TAP_URL` | TAP ingestion service URL |
| `PDS_URL` | Personal Data Server (e.g., `https://opnshelf.social`) |
| `BACKEND_PUBLIC_URL` | Public URL for OAuth callbacks |
| `FRONTEND_URL` | Frontend URL for redirects |

### Web (`apps/web/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_PUBLIC_POSTHOG_KEY` | PostHog analytics key |
| `VITE_PUBLIC_POSTHOG_HOST` | PostHog host URL |

## License

MIT
