# Plan 002: Keep raw session identifiers out of backend logs

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` unless told otherwise.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts`
> If an in-scope file changed, compare the excerpts below; mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

`AuthSession.id` is the opaque cookie/Bearer credential. Logging it turns ordinary application logs into a credential store and can enable replay while a session remains valid. Diagnostics need the event and safe user context, never the raw identifier.

## Current state

- `backend/prisma/schema.prisma:111-128` documents `AuthSession.id` as the opaque cookie/Bearer value.
- `backend/src/auth/auth.service.ts:586-590` logs the credential slot during expiry: ``Credential session expired for ${did}; revoking device ${slot}``.
- `backend/src/auth/auth.service.ts:701-715` catches best-effort touch failures but logs ``Failed to touch session ${sessionId}``.
- The auth tests use Vitest/Nest mocks in `backend/src/auth/auth.service.spec.ts`; extend that file and spy on the service logger using `vi.spyOn((service as any).logger, "warn")` or the narrowest typed equivalent.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `pnpm --filter backend test -- src/auth/auth.service.spec.ts` | all pass |
| Check | `pnpm --filter backend run check` | exit 0 |
| Typecheck | `pnpm --filter backend run typecheck` | exit 0 |

## Scope

**In scope**: `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.service.spec.ts`, and `plans/README.md` status only.

**Out of scope**: changing session generation/storage/TTL, hashing database keys, changing API or cookie formats, or logging any derived stable fingerprint of the credential.

## Git workflow

- Branch: `codex/improve-002-redact-session-identifiers`
- Commit: `fix(auth): keep session identifiers out of logs`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Add log-redaction regressions

Exercise `touchSession` with a rejected Prisma update and the credential-session expiry callback. Assert warnings retain useful context (event and DID where already available) while the serialized logger arguments do not contain the test session ID. Use a conspicuous sentinel credential and assert it is absent from every argument.

**Verify**: focused test → new tests fail against the current interpolated messages.

### Step 2: Remove credentials from log messages

Change the touch warning to a constant event message. Change the expiry warning to identify the DID/event but not `slot`. Do not log prefixes, hashes, lengths, or thrown objects that embed request credentials. Preserve cleanup and best-effort behavior exactly.

**Verify**: focused test → all pass.

### Step 3: Audit auth logging

Run `rg -n 'logger\.(debug|log|warn|error).*?(sessionId|slot)|\$\{(sessionId|slot)\}' backend/src/auth`. Inspect each match; raw credential-bearing values must never reach logs.

**Verify**: `pnpm --filter backend run check && pnpm --filter backend run typecheck` → exit 0.

## Test plan

- Add failure-path log assertions beside existing `touchSession` tests and credential session tests.
- Cover raw ID absence, useful event text presence, cleanup still invoked, and touch errors still swallowed.
- Verification: focused auth suite passes.

## Done criteria

- [ ] No raw session ID/slot is passed to auth loggers.
- [ ] Touch remains best-effort and expiry still revokes only the device session.
- [ ] Focused tests, check, and typecheck pass.
- [ ] Only in-scope files changed.

## STOP conditions

Stop if the excerpts drift, logger error objects are found to contain the raw session ID, safe logging requires changing authentication behavior, or a test would require real credentials.

## Maintenance notes

Treat `AuthSession.id`, cookie values, and mobile Bearer tokens as secrets in future logs. Reviewers should check structured metadata as well as message strings.
