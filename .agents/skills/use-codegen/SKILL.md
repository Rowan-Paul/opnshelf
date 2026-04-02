# Use Codegen for API Clients

When working with API clients in this repository, always use the auto-generated SDK from `@hey-api/openapi-ts` rather than creating manual implementations.

## Rule

**NEVER create manual API client files.** Always regenerate the API client using the code generator.

## Why

1. **Single source of truth**: The OpenAPI/Swagger spec is the source of truth for all API contracts
2. **Type safety**: Generated types are always in sync with the backend
3. **Consistency**: All API calls follow the same pattern (error handling, request/response formats)
4. **React Query integration**: Generated hooks include proper caching, error handling, and loading states
5. **Maintenance**: When backend changes, just regenerate - no manual updates needed

## How to Regenerate

### Prerequisites
- Backend must be running on `http://127.0.0.1:3001` with Swagger docs available at `/api-json`

### Command
```bash
pnpm generate:api
```

This will:
1. Fetch the OpenAPI spec from `http://127.0.0.1:3001/api-json`
2. Generate TypeScript types
3. Generate API client functions
4. Generate TanStack Query hooks (queryOptions, mutationOptions, etc.)

## What Gets Generated

The generator creates:
- `packages/api/src/generated/sdk.gen.ts` - API client functions
- `packages/api/src/generated/types.gen.ts` - TypeScript types
- `packages/api/src/generated/@tanstack/react-query.gen.ts` - React Query hooks
- `packages/api/src/generated/index.ts` - Exports

## Usage Examples

### Query (GET request)
```typescript
import { peopleControllerGetPersonDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";

const { data } = useQuery({
  ...peopleControllerGetPersonDetailsOptions({
    path: { personId: "40462" },
  }),
});
```

### Mutation (POST/PUT/DELETE)
```typescript
import { moviesControllerMarkWatchedMutation } from "@opnshelf/api";
import { useMutation } from "@tanstack/react-query";

const mutation = useMutation({
  ...moviesControllerMarkWatchedMutation(),
});
```

### Direct API Call (rarely needed)
```typescript
import { peopleControllerGetPersonDetails } from "@opnshelf/api";

const { data } = await peopleControllerGetPersonDetails({
  path: { personId: "40462" },
});
```

## Workflow for New Backend Endpoints

1. **Create backend endpoint** with proper Swagger decorators
2. **Start backend** and verify Swagger docs at `http://127.0.0.1:3001/api-json`
3. **Run codegen**: `pnpm generate:api`
4. **Use generated code** in frontend/mobile

## Anti-Patterns to Avoid

❌ **DON'T** create manual client files:
```typescript
// BAD - packages/api/src/people-client.ts
export const peopleControllerGetPersonDetails = async (options) => {
  const { path, ...config } = options;
  const url = `/people/tmdb/${path.personId}`;  // ❌ Don't do this
  const response = await client.request({ ...config, method: "GET", url });
  return response.json();
};
```

❌ **DON'T** create manual query options:
```typescript
// BAD - packages/api/src/people-queries.ts
export const peopleControllerGetPersonDetailsOptions = (options) =>
  queryOptions({
    queryFn: async ({ queryKey }) => {
      const { data } = await peopleControllerGetPersonDetails({ ...options, ...queryKey[0] });
      return data;
    },
    queryKey: createQueryKey("peopleControllerGetPersonDetails", options),
  });
```

✅ **DO** use generated code:
```typescript
import { peopleControllerGetPersonDetailsOptions } from "@opnshelf/api";
```

## Troubleshooting

### "Cannot find exported name" error
The API hasn't been regenerated. Run:
```bash
pnpm generate:api
```

### OpenAPI spec fetch fails
Backend isn't running. Start it first:
```bash
pnpm dev:backend
```

### Types are out of sync
Backend DTOs changed. Regenerate:
```bash
pnpm generate:api
```

## When to Create Manual Types

Only create manual types in `packages/api/src/` when:
- The backend endpoint is not yet ready but you need types for development
- You're working on a feature branch and can't regenerate yet

**Always add a TODO comment** to regenerate when the backend is ready:
```typescript
// TODO: Regenerate API client when backend endpoint is ready
export type MyManualType = { ... };
```
