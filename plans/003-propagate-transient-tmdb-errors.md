# Plan 003: Redeliver library and list-item events after transient TMDB failures

> **Executor instructions**: Follow this plan step by step, verify each step, and stop on any STOP condition. Update `plans/README.md` status when done unless told otherwise.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- backend/src/library/library.service.ts backend/src/library/library.service.spec.ts backend/src/lists/lists.service.ts backend/src/lists/lists.service.spec.ts backend/src/ingester/ingester.service.spec.ts backend/src/tmdb/tmdb-http.ts`
> If an in-scope file changed, compare the excerpts below; mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

The ingester retries and refuses to acknowledge transient failures, but library/list-item service indexers currently catch every TMDB error and return success. An outage can therefore permanently omit an otherwise valid record until a manual backfill. Typed transient errors must propagate while permanent invalid IDs remain logged-and-dropped.

## Current state

- `backend/src/tmdb/tmdb-http.ts:60-73` defines `TmdbServiceError` for retryable 5xx/timeouts/network failures and `TmdbNotFoundError` for permanent IDs.
- `backend/src/ingester/ingester.service.ts:425-474` retries errors classified by `isTransientError`, then rethrows after its budget so Tab redelivers.
- Both `backend/src/library/library.service.ts:208-235` and `backend/src/lists/lists.service.ts:1031-1057` currently catch all detail-fetch failures, log `skipping`, and `return`.
- The movie/episode handlers in `ingester.service.ts:570-580` are the exemplar: they rethrow errors classified as transient and otherwise log/return. That classifier is private to the ingester; in these service catch blocks import `TmdbServiceError` from `../tmdb/tmdb-http` and use `err instanceof TmdbServiceError`, because this plan is specifically about TMDB failures and must not duplicate the ingester's broader Prisma/network classifier.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `pnpm --filter backend test -- src/library/library.service.spec.ts src/lists/lists.service.spec.ts src/ingester/ingester.service.spec.ts` | all pass |
| Check/typecheck | `pnpm --filter backend run check && pnpm --filter backend run typecheck` | exit 0 |
| Full tests | `pnpm --filter backend run test` | all pass |

## Scope

**In scope**: the three test files above, `backend/src/library/library.service.ts`, `backend/src/lists/lists.service.ts`, and `plans/README.md` status.

**Out of scope**: TMDB retry counts/backoff, HTTP client behavior, Tab configuration, user-facing API calls, metadata sync warnings, or changing permanent-error classification.

## Git workflow

- Branch: `codex/improve-003-propagate-tmdb-failures`
- Commit: `fix(ingester): propagate transient TMDB failures`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Characterize transient versus permanent outcomes

In both service suites, cover movie and show branches: a `TmdbServiceError` from `get*Details` rejects and does not upsert the item; a `TmdbNotFoundError` resolves without item upsert and logs the skip. Use the existing service mocks. In the ingester suite, route one library and one list-item event through the registered record handler and assert transient service rejection reaches the ingester retry/redelivery path rather than being acknowledged.

**Verify**: focused tests → transient propagation assertions fail on current code.

### Step 2: Match the established ingester error policy

Import the existing typed `TmdbServiceError` from `../tmdb/tmdb-http`; do not export or duplicate the ingester's private broader classifier. In all four catch blocks, immediately rethrow when `err instanceof TmdbServiceError`; retain logging/return for permanent failures. Log wording should say the record is invalid/skipped only for permanent errors.

**Verify**: focused tests → all pass.

### Step 3: Run backend gates

**Verify**: check, typecheck, and full backend tests → all exit 0.

## Test plan

- Library: movie transient, movie not-found, show transient, show not-found.
- List item: same four branches.
- Ingester integration-by-mock: transient library/list-item handler failures exhaust retries and reject so the event is not acknowledged.
- Model test structure after existing transient watch tests in `backend/src/ingester/ingester.service.spec.ts`.

## Done criteria

- [ ] Transient TMDB failures reject from both indexers.
- [ ] Permanent TMDB not-found errors remain logged/dropped.
- [ ] No item upsert occurs after either fetch failure.
- [ ] Focused tests, backend check/typecheck, and full tests pass.
- [ ] Only in-scope files changed.

## STOP conditions

Stop if the typed TMDB errors/classifier no longer exist, the service methods are also used synchronously where propagation would change a public API without an exception mapper, or tests show Tab acknowledges rejected handlers.

## Maintenance notes

All future firehose enrichment must preserve the transient/permanent distinction. Reviewers should reject broad `catch { return }` blocks on ingestion paths.
