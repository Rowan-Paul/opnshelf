# AGENTS.md - Coding Guidelines for OpnShelf

## Project Overview

OpnShelf is a monorepo with pnpm workspaces containing:
- **apps/web**: React + TanStack Router + Vite frontend
- **apps/mobile**: Expo/React Native mobile app
- **backend**: NestJS API server with Prisma
- **packages/api**: OpenAPI-generated API client
- **packages/types**: Shared TypeScript types

## Build Commands

```bash
# Development
pnpm dev              # Start all dev servers
pnpm dev:web          # Web app only (port 3000)
pnpm dev:mobile       # Mobile app only
pnpm dev:backend      # Backend only (port 3001)

# Building
pnpm build            # Build all packages

# Database
pnpm prisma:generate  # Generate Prisma client
pnpm prisma:migrate   # Run Prisma migrations
pnpm generate:api     # Generate API types from OpenAPI
```

## Lint & Format Commands

### Web App (apps/web)
Uses **Biome** for linting and formatting:

```bash
cd apps/web
pnpm lint             # Run linter
pnpm format           # Format code
pnpm check            # Run both lint and format checks
```

**Running a single test:**
```bash
cd apps/web
pnpm test -- src/routes/index.test.tsx    # Run specific test file
pnpm test -- --grep "HomePage"            # Run tests matching pattern
```

### Backend
Uses **ESLint + Prettier**:

```bash
cd backend
pnpm lint             # Lint and auto-fix
pnpm format           # Format with Prettier
```

**Running a single test:**
```bash
cd backend
pnpm test -- auth.service.spec.ts         # Run specific test file
pnpm test -- --testNamePattern="should"   # Run tests matching pattern
pnpm test:watch       # Watch mode
```

### Mobile App
```bash
cd apps/mobile
pnpm typecheck        # TypeScript check only
```

## Type Checking

**Important**: When finishing work, run typecheck instead of full build:

```bash
# Web app
cd apps/web && npx tsc --noEmit

# Backend (has type checking built into lint)
cd backend && pnpm lint

# Mobile
cd apps/mobile && pnpm typecheck
```

## Code Style Guidelines

### TypeScript
- **Strict mode**: Enabled in all packages
- **Types**: Always define return types on public functions
- **Any**: Avoid `any`; use `unknown` with type guards when needed
- **Enums**: Prefer union types over enums

### Imports & Organization
- **Order**: External imports first, then internal (workspace packages), then relative
- **Workspace imports**: Use `@opnshelf/api` and `@opnshelf/types` for shared code
- **Biome**: Auto-organizes imports on format (source.organizeImports: on)

### Formatting
- **Web**: Biome with tabs, double quotes
- **Backend**: Prettier with ESLint, single quotes
- **Line endings**: Auto-detected (Prettier: endOfLine: auto)

### Naming Conventions
- **Files**: kebab-case (e.g., `auth.service.ts`, `button.tsx`)
- **Components**: PascalCase (e.g., `HomePage`, `AuthGuard`)
- **Services/Controllers**: PascalCase with descriptive suffix (e.g., `AuthService`, `MoviesController`)
- **DTOs**: Suffix with `Dto` (e.g., `UserDto`)
- **Interfaces**: Prefix with `I` optional, prefer descriptive names
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Private members**: Use `private readonly` for injected services

### Error Handling
- **Backend**: Use NestJS built-in exceptions (`BadRequestException`, `NotFoundException`)
- **Logger**: Use NestJS `Logger` with context: `new Logger(AuthService.name)`
- **Try/catch**: Log errors with context before re-throwing or returning error responses
- **Frontend**: Handle errors at component level with user-friendly messages

### Backend (NestJS)
- **Decorators**: Use Swagger decorators for API documentation (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)
- **Guards**: Implement authentication guards for protected routes
- **DTOs**: Use class-validator decorators for input validation
- **Controllers**: Keep thin, delegate logic to services
- **Services**: Handle business logic, database operations via Prisma

### Frontend (React)
- **Router**: Use TanStack Router with file-based routing
- **Components**: Prefer functional components with hooks
- **Styling**: Tailwind CSS with `className` utility
- **Icons**: Lucide React
- **Query**: TanStack Query for data fetching
- **shadcn/ui**: Use `pnpm dlx shadcn@latest add <component>` for UI components

### Testing
- **Backend**: Jest with `.spec.ts` suffix
- **Web**: Vitest with `.test.tsx` suffix
- **Mocking**: Use proper dependency injection for testability

## Workspace Commands

```bash
# Run command in specific package
pnpm --filter web <command>
pnpm --filter backend <command>
pnpm --filter mobile <command>

# Add dependency to specific package
pnpm --filter web add <package>
pnpm --filter backend add -D <package>
```

## Environment Variables

- **Web**: Use `@t3-oss/env-core` with Zod validation
  - Client vars must start with `VITE_`
  - Define in `src/env.ts`
- **Backend**: Use `@nestjs/config` with validation
- **Mobile**: Use Expo environment handling

## Git Workflow

- **Commits**: Write clear, descriptive commit messages
- **PRs**: Ensure typecheck passes before submitting
- **Pre-commit**: Biome/ESLint runs on staged files

## Key Files

- `/apps/web/biome.json` - Web linting/formatting rules
- `/backend/eslint.config.mjs` - Backend linting rules
- `/turbo.json` - Build pipeline configuration
- `/pnpm-workspace.yaml` - Workspace definitions

## Cursor Rules

The following Cursor rules apply:
1. Use `pnpm dlx shadcn@latest add <component>` for adding shadcn components
2. Finish with typecheck, not full build (unless build artifacts needed)
