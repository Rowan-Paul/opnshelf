# Plan 012: Clear account-scoped caches at every mobile identity transition

> **Executor instructions**: Execute stepwise and run every gate. Stop on any STOP condition. Update the plan index row when finished unless the reviewer owns it.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- apps/mobile/src/lib/auth-context.tsx apps/mobile/src/lib/auth-context.test.tsx apps/mobile/src/lib/query-client.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/010-propagate-secure-storage-failures.md`
- **Category**: security
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

The shared mobile QueryClient outlives auth sessions. Explicit sign-out clears it, but expiry cleanup removes only `me`, and login/register install a new credential without first removing data fetched under the previous identity. On a shared device, the next account can briefly receive cached lists, settings, library, notes, mutations, or social data from the previous account.

## Current state

- `apps/mobile/src/lib/query-client.ts:8-20` exports one process-wide `QueryClient`.
- `apps/mobile/src/lib/auth-context.tsx:98-105` expiry cleanup removes only the `me` query:

```ts
const meKey = authControllerMeQueryKey();
queryClient.setQueryData(meKey, null);
queryClient.removeQueries({ queryKey: meKey });
```

- `completeSession` at lines 126-148 and `register` at lines 188-218 save a new session and fetch `me` without clearing data from a prior identity.
- Explicit sign-out at lines 220-227 already calls `queryClient.clear()`, but does not first cancel in-flight requests; a late response may repopulate data.
- Generated query keys are inconsistent in whether they contain a DID, so a selective allow/deny list is brittle. The safe identity boundary is cancel then clear all cached queries and mutations; public data can be refetched.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Tests | `pnpm --filter @opnshelf/mobile test -- auth-context.test.tsx` | all pass |
| Typecheck | `pnpm --filter @opnshelf/mobile typecheck` | exit 0 |
| Check | `pnpm --filter @opnshelf/mobile check` | exit 0 |

## Scope

**In scope**:
- `apps/mobile/src/lib/auth-context.tsx`
- `apps/mobile/src/lib/auth-context.test.tsx`
- `apps/mobile/src/lib/query-client.ts` only if a small exported reset helper is necessary

**Out of scope**:
- Persisting public queries, changing generated query keys, web caches, storage semantics, server revocation, or adding a second QueryClient/provider.

## Git workflow

- Branch: `codex/improve-012-mobile-identity-cache-boundary`
- Commit message: `Clear mobile caches across identity changes`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Define one account-state reset operation

Within auth context (or a small helper in `query-client.ts`), implement an awaited operation that first calls `queryClient.cancelQueries()` and then `queryClient.clear()`. It must clear both query and mutation caches. Keep PostHog reset and credential storage outside this helper so their ordering stays visible.

**Verify**: a unit test seeds at least an account query, a public query, and mutation state, then confirms all are absent after reset; a deferred in-flight query is cancelled before clear.

### Step 2: Apply the boundary to every exit

Use the operation for centralized 401 expiry and explicit sign-out. Credential deletion must succeed per Plan 010 before presenting sign-out success, then cancel/clear, set auth state, and navigate. Ensure concurrent 401 callbacks cannot perform duplicate navigation after the first clear (guard with current token/transition state, not a module global).

**Verify**: tests cover explicit sign-out and unauthorized cleanup and assert cancellation precedes clearing/navigation.

### Step 3: Apply the boundary before every new identity

Before `completeSession` and `register` install/fetch a new identity, cancel and clear prior cached work. Do not clear after the new `me` fetch, which would erase the just-established account. If new-session persistence or `me` fetch fails, do not restore stale prior-account cache data.

**Verify**: seed cache as account A, complete/register account B, and assert account-A data is absent before B's `me` fetch executes.

## Test plan

- Extend the Plan 010 AuthProvider harness with a real isolated QueryClient and mocks for API, router, storage, and analytics.
- Cover four transitions: restored-session 401, explicit sign-out, OAuth `completeSession`, and native registration.
- Include a deferred in-flight query to prove cancel-before-clear and an account-A sentinel that never survives into B.
- Run the full mobile suite plus typecheck/check.

## Done criteria

- [ ] Every exit/new-identity path uses cancel-then-clear.
- [ ] Queries and mutation cache entries from account A cannot survive account B login.
- [ ] No late cancelled response repopulates the cache in tests.
- [ ] New B `me` data is not accidentally cleared.
- [ ] All mobile gates pass and only Scope files changed.

## STOP conditions

- Plan 010 has not landed or its auth-context excerpts materially changed.
- A transition path is owned outside the in-scope auth context and cannot be invoked from it.
- React Query cancellation cannot be made deterministic in the test harness without production-wide changes.
- Verification fails twice.

## Maintenance notes

Any future account-switch, delete-account, or token-replacement flow must call the same identity boundary. Reviewers should reject selective cache-key lists unless all generated keys become explicitly identity-scoped.

