# AGENTS.md - Coding Guidelines for OpnShelf

## Project Overview

OpnShelf is a monorepo with pnpm workspaces containing:
- **apps/web**: React + TanStack Router + Vite frontend
- **apps/mobile**: Expo/React Native mobile app
- **backend**: NestJS API server with Prisma
- **packages/api**: OpenAPI-generated API client with TanStack Query support
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

#### TanStack Query Anti-patterns

**Avoid using simple string keys with generated API clients:**
The API client generates complex query key objects. Using simple string arrays won't match:

```typescript
// DON'T do this - wrong query key structure
queryClient.setQueryData(["authControllerMe"], null);
queryClient.removeQueries({ queryKey: ["authControllerMe"] });

// DO this instead - use the generated query key function
import { authControllerMeQueryKey } from "@opnshelf/api";
const meQueryKey = authControllerMeQueryKey();
queryClient.setQueryData(meQueryKey, null);
queryClient.removeQueries({ queryKey: meQueryKey });
```

## Backend Testing

The backend uses **Jest** for testing with comprehensive test coverage for services, controllers, and guards.

### Test Structure

```
backend/src/
├── auth/
│   ├── auth.service.spec.ts      # Service logic tests
│   ├── auth.controller.spec.ts   # Controller/HTTP tests
│   └── auth.guard.spec.ts        # Auth guard tests
├── movies/
│   ├── movies.service.spec.ts    # Movie business logic
│   ├── movies.controller.spec.ts # Movie API endpoints
│   └── color-extraction.service.spec.ts  # Color extraction tests
├── ingester/
│   └── ingester.service.spec.ts  # Firehose ingester tests
└── prisma/
    └── prisma.service.spec.ts    # Database service tests
```

### Running Tests

```bash
cd backend

# Run all tests
pnpm test

# Run with watch mode for development
pnpm test:watch

# Run specific test file
pnpm test -- auth.service.spec.ts

# Run tests matching a pattern
pnpm test -- --testNamePattern="should create"

# Run with coverage
pnpm test -- --coverage
```

### Test Patterns

#### 1. Service Testing

Services are tested with mocked dependencies:

```typescript
describe('MoviesService', () => {
  let service: MoviesService;
  
  const mockPrismaService = {
    movie: { findUnique: jest.fn(), upsert: jest.fn() },
    trackedMovie: { findMany: jest.fn(), upsert: jest.fn() }
  };
  
  const mockColorExtraction = {
    extractColorsFromPoster: jest.fn()
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MoviesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ColorExtractionService, useValue: mockColorExtraction },
        { provide: ConfigService, useValue: { get: jest.fn() } }
      ]
    }).compile();

    service = module.get<MoviesService>(MoviesService);
  });

  it('should find movie by ID', async () => {
    const mockMovie = { movieId: '123', title: 'Test Movie' };
    mockPrismaService.movie.findUnique.mockResolvedValue(mockMovie);
    
    const result = await service.getMovieByTMDBId('123');
    
    expect(result).toEqual(mockMovie);
    expect(mockPrismaService.movie.findUnique).toHaveBeenCalledWith({
      where: { movieId: '123' }
    });
  });
});
```

#### 2. Controller Testing

Controllers are tested with mocked services:

```typescript
describe('MoviesController', () => {
  let controller: MoviesController;
  
  const mockMoviesService = {
    searchMovies: jest.fn(),
    getMovieDetails: jest.fn(),
    markWatched: jest.fn()
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MoviesController],
      providers: [{ provide: MoviesService, useValue: mockMoviesService }]
    }).compile();

    controller = module.get<MoviesController>(MoviesController);
  });

  it('should search movies', async () => {
    const mockResults = { results: [{ id: 1, title: 'Movie' }] };
    mockMoviesService.searchMovies.mockResolvedValue(mockResults);
    
    const result = await controller.searchMovies({ query: 'test' });
    
    expect(result).toEqual(mockResults);
  });
});
```

#### 3. Guard Testing

Guards test authentication logic:

```typescript
describe('AuthGuard', () => {
  let guard: AuthGuard;
  
  const mockAuthService = {
    getSessionById: jest.fn(),
    restore: jest.fn()
  };

  it('should allow access with valid session', async () => {
    mockAuthService.getSessionById.mockResolvedValue({ userDid: 'did:123' });
    mockAuthService.restore.mockResolvedValue({ did: 'did:123' });
    
    const context = createMockExecutionContext({ session: 'valid-session' });
    const result = await guard.canActivate(context);
    
    expect(result).toBe(true);
  });

  it('should deny access without session', async () => {
    const context = createMockExecutionContext({});
    
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException
    );
  });
});
```

### Mocking External Dependencies

#### AT Protocol Modules

```typescript
// Mock @atproto modules before imports
jest.mock('@atproto/oauth-client-node', () => ({
  NodeOAuthClient: jest.fn().mockImplementation(() => ({
    authorize: jest.fn(),
    callback: jest.fn(),
    restore: jest.fn()
  }))
}));

jest.mock('@atproto/api', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    getProfile: jest.fn(),
    com: { atproto: { repo: { putRecord: jest.fn(), deleteRecord: jest.fn() } } }
  }))
}));

jest.mock('@atproto/sync', () => ({
  Firehose: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    destroy: jest.fn()
  }))
}));
```

#### Prisma Service

```typescript
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn()
}));

// Then provide mock values in test module
const mockPrisma = {
  user: { findUnique: jest.fn(), upsert: jest.fn() },
  movie: { findUnique: jest.fn(), upsert: jest.fn() },
  trackedMovie: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() }
};

{ provide: PrismaService, useValue: mockPrisma }
```

### Testing Best Practices

1. **Mock External Services**: Always mock Prisma, external APIs, and AT Protocol
2. **Test Service Boundaries**: Focus on public methods and their interactions
3. **Clear Mocks**: Use `jest.clearAllMocks()` in `beforeEach`
4. **Test Error Cases**: Verify proper error handling and edge cases
5. **Type Safety**: Use proper typing for mock values and return values
6. **Isolated Tests**: Each test should be independent and not rely on test order

### Creating New Tests

When creating tests for a new service:

1. Create a `.spec.ts` file alongside the service file
2. Mock all dependencies using `jest.mock()` before imports
3. Set up the testing module in `beforeEach`
4. Write tests for:
   - Happy path (successful operations)
   - Error cases (exceptions, missing data)
   - Edge cases (null values, empty arrays)
   - Boundary conditions
5. Verify mock interactions with `expect(mock).toHaveBeenCalledWith()`

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

## Wrapping Up Tasks

**When finishing work on any task, always run the project's typecheck and lint commands to ensure code quality before submitting.**

### Web App
```bash
cd apps/web
pnpm check        # Run Biome lint + format checks
npx tsc --noEmit  # TypeScript type check
```

### Backend
```bash
cd backend
pnpm lint         # ESLint + Prettier (includes type checking)
```

### Mobile
```bash
cd apps/mobile
pnpm tsc --noEmit    # TypeScript check only
```

**Note**: If any checks fail, fix the issues before considering the task complete.

## Key Files

- `/apps/web/biome.json` - Web linting/formatting rules
- `/backend/eslint.config.mjs` - Backend linting rules
- `/turbo.json` - Build pipeline configuration
- `/pnpm-workspace.yaml` - Workspace definitions

## API Client (@opnshelf/api)

The API client is generated using `@hey-api/openapi-ts` with TanStack Query support.

### Generated Code Structure

- `src/generated/` - Auto-generated SDK and types
- `src/generated/@tanstack/react-query.gen.ts` - TanStack Query hooks (queryOptions, mutationOptions)
- `src/client.ts` - Custom client wrapper with auth interceptors

### Using TanStack Query Hooks

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { moviesControllerSearchMoviesOptions, moviesControllerMarkWatchedMutation } from '@opnshelf/api';

// Query example
const { data, isLoading } = useQuery({
  ...moviesControllerSearchMoviesOptions({
    query: { query: 'Inception' }
  })
});

// Mutation example
const markWatched = useMutation({
  ...moviesControllerMarkWatchedMutation(),
  onSuccess: () => {
    // Handle success
  }
});

markWatched.mutate({
  body: { movieId: '123' }
});
```

### Regenerating API Client

```bash
# Ensure backend is running on port 3001, then:
pnpm generate:api
```

## Cursor Rules

The following Cursor rules apply:
1. Use `pnpm dlx shadcn@latest add <component>` for adding shadcn components
2. Finish with typecheck, not full build (unless build artifacts needed)
