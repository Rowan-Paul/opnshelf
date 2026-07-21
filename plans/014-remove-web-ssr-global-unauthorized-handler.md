# Plan 014: Keep the web unauthorized callback out of SSR request rendering

> **Executor instructions**: Run all steps and checks in order. Stop on a listed condition; do not alter mobile callback behavior. Update the index when done unless instructed otherwise.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts apps/web/src/lib/auth-context.tsx apps/web/src/lib/auth-context.test.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

`@opnshelf/api` stores one module-global unauthorized callback. Web router/bootstrap and AuthProvider currently write it during SSR/render, so concurrent renders can overwrite request-specific QueryClient closures and retain them after a request. The web app should configure only stable request-independent API state on the server; unauthorized lifecycle handling belongs in a browser effect with cleanup.

## Current state

- `packages/api/src/client.ts:9-17` has a single callback slot; mobile intentionally uses it and is out of scope.
- `apps/web/src/lib/api.ts:19-39` says shared client base URL setup is concurrency-safe, but also calls `setOnUnauthorized` during `setupApiClient()`, which `router.tsx#getRouter()` invokes for every SSR request.
- `apps/web/src/lib/auth-context.tsx:76-80` calls `setOnUnauthorized` directly during render:

```ts
setOnUnauthorized(() => {
	queryClient.setQueryData(authControllerMeOptions().queryKey, undefined);
});
```

- Unlike mobile's `useEffect`, this has no cleanup and captures the request's QueryClient during SSR.
- Web Vitest is configured in `apps/web/vitest.config.ts` with jsdom, globals, React dedupe, and Testing Library dependencies; follow existing component tests.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Focused tests | `pnpm --filter @opnshelf/web test -- api.test.ts auth-context.test.tsx` | all pass |
| Web suite | `pnpm --filter @opnshelf/web test` | all pass |
| Typecheck | `pnpm --filter @opnshelf/web typecheck` | exit 0 |
| Check | `pnpm --filter @opnshelf/web check` | exit 0 |

## Scope

**In scope**:
- `apps/web/src/lib/api.ts` and `api.test.ts` (create)
- `apps/web/src/lib/auth-context.tsx` and `auth-context.test.tsx` (create)

**Out of scope**:
- `packages/api/src/client.ts`, mobile auth, changing the interceptor API, SSR cookie forwarding, route beforeLoad auth policy, logout semantics, or QueryClient construction.

## Git workflow

- Branch: `codex/improve-014-web-unauthorized-lifecycle`
- Commit message: `Keep unauthorized handling out of web SSR`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Make bootstrap configuration request-independent

Remove the `setOnUnauthorized` import and registration from `apps/web/src/lib/api.ts`. Preserve configure-once base URL behavior and `ssrAuthOptions` cookie forwarding exactly. Add/extend a unit test proving repeated setup configures the stable URL once and never registers a callback.

**Verify**: `pnpm --filter @opnshelf/web test -- api.test.ts` → passes.

### Step 2: Register unauthorized handling only after browser mount

In `AuthProvider`, import `useEffect` and register the callback inside an effect keyed by `queryClient`. Return cleanup that calls `setOnUnauthorized(null)`. The callback should preserve current behavior: invalidate/remove only current-user auth data and allow route policy to control redirects. No callback registration may occur during server render.

**Verify**: component test asserts registration happens after mount, callback affects that mounted provider's QueryClient, and unmount clears it.

### Step 3: Characterize SSR isolation

Use `renderToString` (without effects) with the necessary QueryClient/router/API mocks and prove two independent server renders do not call `setOnUnauthorized` or capture either QueryClient. Then mount in jsdom and prove the browser effect still works. Avoid testing module internals from `packages/api`.

**Verify**: `pnpm --filter @opnshelf/web test -- auth-context.test.tsx` → SSR and client cases pass.

## Test plan

- Mock generated queries narrowly; provide QueryClientProvider and router navigation context as existing tests do.
- Cases: setup repeated, SSR render A/B no registration, browser mount registration, callback clears auth data, rerender does not leak registrations, unmount cleanup.
- Run the full existing 19+ web tests after focused tests.

## Done criteria

- [ ] `rg -n 'setOnUnauthorized' apps/web/src/lib/api.ts` returns no matches.
- [ ] `AuthProvider` registration occurs only in `useEffect` with cleanup.
- [ ] SSR isolation test proves no request QueryClient is captured globally.
- [ ] Full web test/typecheck/check pass; only Scope files changed.

## STOP conditions

- AuthProvider must redirect during SSR to preserve a documented route contract.
- A correct test requires changing shared package callback semantics or router construction.
- Existing web behavior depends on bootstrap's console-warning callback.
- Drift or verification fails twice.

## Maintenance notes

The shared callback remains a browser singleton, appropriate for one mounted app provider. If multiple browser roots become supported, replace the package singleton in a separate API-design plan rather than extending this SSR fix.

