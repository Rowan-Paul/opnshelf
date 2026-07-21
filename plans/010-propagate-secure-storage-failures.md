# Plan 010: Propagate secure-storage failures and synchronize token state safely

> **Executor instructions**: Follow each step and verification gate. Stop on any STOP condition; do not improvise. Update the plan index row when done unless the reviewer owns it.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- apps/mobile/src/lib/api.ts apps/mobile/src/lib/api.test.ts apps/mobile/src/lib/auth-context.tsx apps/mobile/src/lib/auth-context.test.tsx`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/009-establish-mobile-test-baseline.md`
- **Category**: security
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

SecureStore read/write/delete failures are swallowed, so callers report login or sign-out success while the persisted bearer credential may not match the API client's in-memory credential. In particular, failed deletion can leave a credential on disk while navigation proceeds to login. Storage operations must be authoritative: update memory only after persistence succeeds, propagate failures, and let initialization settle safely without hanging the app.

## Current state

- `apps/mobile/src/lib/api.ts:19-44` catches every SecureStore error and returns success-like values:

```ts
try {
	const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
	if (token) setSessionToken(token);
	return token;
} catch (error) {
	console.error("Failed to load session token:", error);
	return null;
}
```

```ts
try {
	await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
	setSessionToken(null);
} catch (error) {
	console.error("Failed to save session token:", error);
}
```

- `apps/mobile/src/lib/auth-context.tsx:90-105` initializes via `.then` only and assumes `clearSession` succeeded after `await saveSessionToken(null)`.
- `completeSession`, `register`, and `signOut` already await `saveSessionToken`; preserving rejection gives their UI callers an honest failure signal.
- The API client exposes `setSessionToken`; it should always reflect the last successfully persisted state. Never log or assert a credential value.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Focused tests | `pnpm --filter @opnshelf/mobile test -- api.test.ts auth-context.test.tsx` | all pass |
| Typecheck | `pnpm --filter @opnshelf/mobile typecheck` | exit 0 |
| Check | `pnpm --filter @opnshelf/mobile check` | exit 0 |

## Scope

**In scope**:
- `apps/mobile/src/lib/api.ts`
- `apps/mobile/src/lib/api.test.ts` (create)
- `apps/mobile/src/lib/auth-context.tsx`
- `apps/mobile/src/lib/auth-context.test.tsx` (create if needed for initialization behavior)

**Out of scope**:
- Backend logout/revocation (Plan 011), query-cache identity boundaries (Plan 012), UI toast redesign, token key migration, and package/test configuration.

## Git workflow

- Branch: `codex/improve-010-secure-storage-errors`
- Commit message: `Propagate mobile secure storage failures`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Make load behavior explicit and non-stale

Remove the catch-and-return-null behavior from `loadSessionToken`. On a successful read, call `setSessionToken(token)` for both a string and `null`; this clears a stale module-level token when storage has no credential. On read rejection, clear the in-memory token defensively and rethrow the original error. Keep error presentation out of this helper and never include a token in logs.

**Verify**: focused API tests prove present, absent, and rejected reads; rejected read rejects and the API client receives `null`.

### Step 2: Persist first, update memory second, and reject failures

For writes, await `setItemAsync` or `deleteItemAsync` first and call `setSessionToken(token)` only after success. Remove the swallowing catch. On failure the function rejects and must not claim the requested new in-memory state. Tests must cover successful set/delete and failed set/delete, including call ordering.

**Verify**: `pnpm --filter @opnshelf/mobile test -- api.test.ts` → all cases pass.

### Step 3: Settle initial auth restoration on failure

Change the mount effect in `AuthProvider` to handle both resolution and rejection without updating unmounted state. A storage read failure must leave the app initialized and signed out, while preserving a diagnostic that does not contain credentials. Do not route or show a success state. Keep interactive methods (`completeSession`, `register`, `signOut`, and `clearSession`) awaiting and propagating storage failures; state/cache/navigation changes that imply success must remain after the awaited storage operation.

**Verify**: test a rejected restore and assert initialization completes without an authenticated `me` request; test failed sign-out storage deletion and assert it does not navigate or clear auth state as if successful.

## Test plan

- Mock `expo-secure-store` and `setSessionToken`.
- Never use a production-looking credential and never snapshot/log token content.
- Cover eight storage cases: read present/absent/reject, write success/reject, delete success/reject, and ordering.
- Cover AuthProvider restore rejection and sign-out rejection if the harness can mount it without broad native mocks.
- Full gate: `pnpm --filter @opnshelf/mobile test && pnpm --filter @opnshelf/mobile typecheck && pnpm --filter @opnshelf/mobile check`.

## Done criteria

- [ ] No SecureStore error is converted into a successful return.
- [ ] In-memory token changes only after successful persistence, except defensive clearing on read failure.
- [ ] Initial restoration always settles and does not fetch `me` after storage failure.
- [ ] Failed deletion does not navigate as a successful sign-out.
- [ ] All mobile tests/typecheck/check pass and only Scope files changed.

## STOP conditions

- Plan 009 is not complete or cannot mock Expo SecureStore deterministically.
- Correct behavior would require changing server session semantics or exposing credential content.
- Existing callers intentionally depend on swallowed storage errors and cannot be updated within `auth-context.tsx`.
- Drift or a verification command fails twice.

## Maintenance notes

Future token-key migrations must retain the persistence-before-memory invariant. Review all new callers to ensure they await and handle rejection rather than fire-and-forget a credential write.

