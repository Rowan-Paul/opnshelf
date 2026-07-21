# Plan 005: Terminate the backend after an uncaught exception

> **Executor instructions**: Follow this plan step by step, verify each step, and stop on any STOP condition. Update `plans/README.md` status when done unless told otherwise.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- backend/src/main.ts backend/src/common/process-error-handlers.ts backend/src/common/process-error-handlers.spec.ts`
> If an in-scope file changed, compare the excerpt below; mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

Registering an `uncaughtException` listener disables Node's default termination. The current handler logs and returns, leaving the server alive after an exception may have corrupted process state. The backend should log once and terminate non-zero so Railway can restart it.

## Current state

```ts
// backend/src/main.ts:12-26
// ... for an uncaughtException we log first and then let Node take its default action.
process.on("uncaughtException", (error) => {
  processLogger.error("Uncaught exception", error.stack ?? String(error));
  // Intentionally not calling process.exit ...
});
```

That comment is incorrect: Node does not take the default action once this listener handles the event. There is no current unit test for process-level handlers. `unhandledRejection` is intentionally log-only and must remain so.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused test | `pnpm --filter backend test -- src/common/process-error-handlers.spec.ts` | all pass without terminating Vitest |
| Check/typecheck | `pnpm --filter backend run check && pnpm --filter backend run typecheck` | exit 0 |
| Full tests | `pnpm --filter backend run test` | all pass |

## Scope

**In scope**: `backend/src/main.ts`, new `backend/src/common/process-error-handlers.ts`, new `.spec.ts`, and plan index status.

**Out of scope**: graceful HTTP shutdown, signal handling, changing unhandled-rejection policy, Railway restart settings, logging transport, or exception filters for handled requests.

## Git workflow

- Branch: `codex/improve-005-uncaught-exception-exit`
- Commit: `fix(backend): exit after uncaught exceptions`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Extract an injectable handler installer

Move registration into `common/process-error-handlers.ts` so tests do not import/boot `main.ts`. Accept narrow injectable dependencies (logger and exit function, defaulting to `process.exit`) or export handler factories. Make registration idempotence explicit if it can be invoked twice in tests/hot reload. Preserve the existing unhandled-rejection log behavior.

**Verify**: typecheck passes after `main.ts` calls the extracted installer once.

### Step 2: Exit non-zero after logging an uncaught exception

The handler must synchronously call `logger.error(...)` and then `exit(1)`. Do not throw from inside the handler, schedule a delayed exit, or merely set `process.exitCode`; an undefined process must not continue serving. Avoid logging sensitive request state.

**Verify**: focused tests with a mocked exit function assert log-before-exit ordering and code 1.

### Step 3: Cover the intentional rejection distinction

Test that an unhandled rejection logs but does not call exit, and that non-Error values serialize safely. Restore listeners/mocks after every test so the suite never leaks global process handlers.

**Verify**: focused and full tests pass; `rg -n 'uncaughtException' backend/src` shows one production registration path.

## Test plan

- Uncaught `Error`: logs stack/message then exits 1.
- Uncaught nonstandard error value if the handler type permits it: safe fallback then exits 1.
- Unhandled rejection: logs and does not exit.
- Repeated installer behavior does not create duplicate listeners, if idempotence is implemented.

## Done criteria

- [ ] Uncaught exceptions synchronously cause exit code 1 after logging.
- [ ] Unhandled rejections retain current log-only behavior.
- [ ] Tests never terminate the runner or leak listeners.
- [ ] Focused tests, check, typecheck, and full tests pass.
- [ ] Only in-scope files changed.

## STOP conditions

Stop if production uses an external crash supervisor contract that requires a different exit code, extracting the handler causes `main.ts` to execute twice, or reliable testing requires importing and booting the Nest application.

## Maintenance notes

Railway/container restart policy must remain configured externally. Reviewers should verify logging happens before the exit call and that no async cleanup creates a false promise of recovery.
