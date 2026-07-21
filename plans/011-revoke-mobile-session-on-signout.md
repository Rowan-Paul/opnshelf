# Plan 011: Revoke mobile bearer sessions during sign-out

> **Executor instructions**: Follow every step and verification. Stop rather than expanding scope. Update the plan index when done unless told otherwise.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- backend/src/auth/auth.controller.ts backend/src/auth/auth.controller.spec.ts backend/src/auth/auth.guard.ts backend/src/auth/auth.guard.spec.ts backend/src/auth/session-id.ts backend/src/auth/session-id.spec.ts apps/mobile/src/lib/auth-context.tsx apps/mobile/src/lib/auth-context.test.tsx`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/010-propagate-secure-storage-failures.md`
- **Category**: security
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

Mobile sign-out deletes only the device copy of its bearer session ID. The server logout endpoint revokes only a cookie value, so the bearer remains replayable until expiry. Logout must extract the same bearer-or-cookie credential as authentication, and mobile must call it before removing the local token.

## Current state

- `backend/src/auth/auth.guard.ts:19-29` prefers `Authorization: Bearer …`, then falls back to the `session` cookie.
- `backend/src/auth/auth.controller.ts:787-796` reads only the cookie:

```ts
const cookies = req.cookies as Record<string, string | undefined>;
const sessionId = cookies?.[SESSION_COOKIE_NAME];
if (sessionId) await this.authService.revokeBySessionId(sessionId);
```

- `apps/mobile/src/lib/auth-context.tsx:220-227` never calls `authControllerLogout` before deletion:

```ts
await saveSessionToken(null);
setHasSessionToken(false);
queryClient.clear();
router.replace("/login");
```

- The generated `@opnshelf/api` package already exports `authControllerLogout`; do not hand-build a fetch call.
- Existing controller tests at `backend/src/auth/auth.controller.spec.ts:835-879` characterize cookie revoke and no-cookie behavior.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Backend auth tests | `pnpm --filter backend test -- auth.controller.spec.ts auth.guard.spec.ts session-id.spec.ts` | all pass |
| Mobile auth tests | `pnpm --filter @opnshelf/mobile test -- auth-context.test.tsx` | all pass |
| Typecheck | `pnpm --filter backend typecheck && pnpm --filter @opnshelf/mobile typecheck` | exit 0 |
| Check | `pnpm --filter backend check && pnpm --filter @opnshelf/mobile check` | exit 0 |

## Scope

**In scope**:
- `backend/src/auth/session-id.ts` and `session-id.spec.ts` (create shared pure extractor)
- `backend/src/auth/auth.guard.ts` and its spec
- `backend/src/auth/auth.controller.ts` and its spec
- `apps/mobile/src/lib/auth-context.tsx` and its test

**Out of scope**:
- Session lifetime/rotation, all-session logout, auth schema changes, generated API files, web logout behavior, or secure-storage semantics from Plan 010.

## Git workflow

- Branch: `codex/improve-011-mobile-session-revocation`
- Commit message: `Revoke mobile sessions on sign out`
- Do not regenerate the API client: endpoint shape is unchanged.

## Steps

### Step 1: Centralize strict session-ID extraction

Create a pure helper accepting the request fields it needs and returning a trimmed bearer token when the scheme is exactly case-insensitive `Bearer` with one non-empty credential; otherwise fall back to the cookie. Reject empty/malformed authorization values rather than sending them to persistence. Refactor `AuthGuard` to use it without changing bearer-first semantics.

**Verify**: helper/guard tests cover bearer precedence, cookie fallback, missing, empty, malformed, and case handling.

### Step 2: Revoke either presented credential at logout

Use the same helper in `AuthController.logout`. Preserve cookie clearing for every request and the existing 200 response. Add controller tests for bearer-only revoke, bearer-over-cookie precedence, cookie-only revoke, and neither. Never log the credential.

**Verify**: `pnpm --filter backend test -- auth.controller.spec.ts auth.guard.spec.ts session-id.spec.ts` → all pass.

### Step 3: Call logout before local credential deletion

Import and await `authControllerLogout({ throwOnError: true })` in mobile `signOut` while the bearer token is still installed in the shared client. After server success, run the existing local cleanup and navigation. If the server returns an expected already-invalid 401, treat the session as already revoked and still clear locally; for network/5xx failures, preserve the local credential and reject so the user can retry. Encode this distinction with the API error shape already used elsewhere; do not match error strings.

**Verify**: mobile tests assert call order (logout before delete), success cleanup, 401 cleanup, and network/5xx preservation/no navigation.

## Test plan

- Add pure extractor tests and extend existing controller/guard tests rather than replacing them.
- In mobile tests, mock the generated logout function, SecureStore wrapper, router, and QueryClient effects. Do not assert credential values.
- Full backend auth and mobile suites must pass.

## Done criteria

- [ ] Bearer-only logout calls `revokeBySessionId` once.
- [ ] Cookie logout remains unchanged and the cookie is always cleared.
- [ ] Mobile calls logout before local deletion.
- [ ] 401 clears locally; retryable server failure preserves the credential and does not navigate.
- [ ] No generated file changed; all listed checks pass; only Scope files changed.

## STOP conditions

- The logout endpoint shape changed since `e6b9e04` and generated client regeneration is required.
- API errors cannot distinguish 401 from retryable failure without changing shared generated code.
- Revocation requires logging or returning the credential.
- A fix requires session-schema or all-device logout changes.

## Maintenance notes

Keep authentication and logout on the same extractor to prevent drift. Review ordering carefully: clearing the shared token before the request silently turns this regression back on.
