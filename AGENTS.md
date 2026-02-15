# OpnShelf - Agent Guidelines

## Repository Overview

OpnShelf is a personal media tracker built on AT Protocol. It's a monorepo with:
- `apps/web` - React web app (TanStack Router + Vite)
- `apps/mobile` - React Native app (Expo)
- `backend` - NestJS API server
- `packages/api` - Shared API client

## Package Manager

**Always use pnpm** (v10.28.2)

```bash
# Install dependencies
pnpm install

# Add dependency to specific package
pnpm --filter @opnshelf/web add <package>
```

## Build Commands

```bash
# Build all packages
pnpm build

# Development servers
pnpm dev:web          # Web app (port 3000)
pnpm dev:mobile       # Mobile app (Expo)
pnpm dev:backend      # Backend (NestJS watch mode)

# Backend specific
pnpm --filter backend build
pnpm --filter backend start:dev
```

## Lint/Format Commands

All packages use **Biome** for linting and formatting:

```bash
# Web app
pnpm --filter @opnshelf/web lint
pnpm --filter @opnshelf/web format
pnpm --filter @opnshelf/web check      # Lint + format check

# Mobile app
pnpm --filter @opnshelf/mobile lint
pnpm --filter @opnshelf/mobile format
pnpm --filter @opnshelf/mobile typecheck

# Backend
pnpm --filter backend lint
pnpm --filter backend format
pnpm --filter backend check
```

## Test Commands

### Backend (Jest)
```bash
# Run all tests
pnpm --filter backend test

# Run single test file
pnpm --filter backend test -- lists.service.spec.ts

# Run tests matching pattern
pnpm --filter backend test -- --testNamePattern="createList"

# Watch mode
pnpm --filter backend test:watch

# Coverage
pnpm --filter backend test:cov
```

### Web (Vitest)
```bash
# Run all tests
pnpm --filter @opnshelf/web test

# Run single test file
pnpm --filter @opnshelf/web test -- src/components/Button.test.tsx
```

## Code Style Guidelines

### Formatting
- **Indentation**: Tabs (configured in biome.json)
- **Quotes**: Double quotes
- **Trailing commas**: All
- **Line width**: Default (80)
- Organize imports automatically (web/mobile)

### TypeScript
- **Strict mode enabled** in all packages
- Use explicit return types on public functions
- Prefer `type` over `interface` for object shapes
- Backend: `noImplicitAny: false` (more lenient)

### Naming Conventions

**Files:**
- React components: PascalCase (e.g., `Button.tsx`, `MovieCard.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useFormattedDate.ts`)
- Utilities: camelCase (e.g., `utils.ts`)
- Backend services: `[name].service.ts`
- Backend controllers: `[name].controller.ts`
- Backend modules: `[name].module.ts`
- DTOs: `[name].dto.ts`
- Tests: `[name].spec.ts` (backend) or `[name].test.ts` (web)

**Code:**
- Components: PascalCase (e.g., `function Button()`)
- Hooks: camelCase with `use` prefix (e.g., `useAuth()`)
- Constants: UPPER_SNAKE_CASE for true constants
- Variables/functions: camelCase
- Private methods: prefix with `_` or use `private` keyword

### Imports

**Order (web/mobile - auto-organized):**
1. External libraries (React, etc.)
2. Internal aliases (`@/components`, `@/lib`)
3. Relative imports

**Backend:**
- Group: NestJS imports → External → Internal (`../`) → Relative (`./`)
- Use type imports where possible

### Path Aliases

**Web:**
```typescript
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

**Mobile:**
```typescript
import { Button } from "@/components/ui/Button";
import { colors } from "@/constants/theme";
```

**Backend:**
```typescript
import { ListsService } from "../lists/lists.service";
import { PrismaService } from "../prisma/prisma.service";
```

## Component Patterns

### Web (shadcn/ui)
Use latest shadcn for new components:
```bash
pnpm dlx shadcn@latest add button
```

- Use `cn()` utility for class merging
- Use `cva` for variant-based components
- Use `Slot` from Radix for polymorphic components
- Tailwind CSS v4 with `@tailwindcss/vite`

### Mobile
- Custom components in `@/components/ui/`
- Use StyleSheet for styling
- Theme constants in `@/constants/theme`

### Backend (NestJS)
- Use dependency injection
- Controllers handle HTTP layer
- Services contain business logic
- DTOs validate input with `class-validator`
- Use Prisma for database access

## Error Handling

**Backend:**
- Throw NestJS exceptions (`NotFoundException`, `BadRequestException`)
- Use Logger for logging (injected)
- Return proper HTTP status codes

**Frontend:**
- Use try/catch for async operations
- TanStack Query for server state
- Sonner for toast notifications (web)

## Testing Best Practices

**Backend:**
- Mock external services (Prisma, APIs)
- Mock AT Protocol (`@atproto/api`, `@atproto/common`)
- Use `jest.mock()` at top of file before imports
- Structure: `describe("ServiceName", () => { describe("methodName", () => { it("should...") }) })`

**Web:**
- Use `@testing-library/react`
- Mock API calls
- Test user interactions

## Database (Prisma)

```bash
# Generate client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate
```

## API Generation

```bash
# Regenerate API client from OpenAPI
pnpm generate:api
```

## Environment Variables

- Web: Uses `.env` files, Vite handles `VITE_` prefix
- Backend: Uses `@nestjs/config`, check `ConfigService`
- Mobile: Uses `expo-constants`

## Git Workflow

- Biome checks run on files in `src/` only
- Generated files (`src/lexicons/`, `src/generated/`, `src/routeTree.gen.ts`) are ignored
- Pre-commit: Run `pnpm check` in affected packages
