# Plan 004: Bound, deduplicate, and aggregate batch ratings in one query

> **Executor instructions**: Follow this plan step by step, verify each step, and stop on any STOP condition. Update `plans/README.md` status when done unless told otherwise.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- backend/src/ratings/dto/rating.dto.ts backend/src/ratings/ratings.service.ts backend/src/ratings/ratings.service.spec.ts`
> If an in-scope file changed, compare the excerpts below; mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security, perf
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

The public batch endpoint accepts an unbounded value and schedules two database queries per supplied ID. A malformed non-array can also reach `.map`, while duplicates amplify work. Strict DTO validation plus one grouped query caps cost and preserves the existing response semantics for valid unique inputs.

## Current state

- `backend/src/ratings/dto/rating.dto.ts:133-146` has only `@IsString({ each: true }) mediaIds: string[]`; it lacks `@IsArray`, non-empty, item length, uniqueness, and maximum size constraints. `mediaType` is only `@IsString` despite the declared union.
- `backend/src/ratings/ratings.service.ts:68-95` runs `Promise.all(mediaIds.map(...))`, with one `aggregate` and one `count` query per ID.
- The existing regression at `ratings.service.spec.ts:332-364` establishes top-level `seasonNumber: 0, episodeNumber: 0`; preserve that behavior.
- The application enables Nest's validation pipe in `backend/src/main.ts`; use class-validator decorators, matching other DTOs.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `pnpm --filter backend test -- src/ratings/ratings.service.spec.ts src/ratings/dto/rating.dto.spec.ts` | all pass |
| Check/typecheck | `pnpm --filter backend run check && pnpm --filter backend run typecheck` | exit 0 |
| Full tests | `pnpm --filter backend run test` | all pass |

## Scope

**In scope**: `backend/src/ratings/dto/rating.dto.ts`, new `backend/src/ratings/dto/rating.dto.spec.ts`, `backend/src/ratings/ratings.service.ts`, `backend/src/ratings/ratings.service.spec.ts`, and plan index status.

**Out of scope**: route/response shape, authentication/throttling, single-item rating queries, client UI changes, database schema/index changes, or season/episode batch support.

## Git workflow

- Branch: `codex/improve-004-batch-ratings`
- Commit: `perf(ratings): bound and group batch aggregation`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Define and test the input contract

Choose and export one named limit constant of 100 IDs. Add `@IsIn(["movie", "show"])`, `@IsArray()`, `@ArrayNotEmpty()`, `@ArrayMaxSize(100)`, `@ArrayUnique()`, and bounded non-empty string validation for each ID (use the smallest existing repo-consistent reasonable cap, documenting it). Add DTO validation tests with `class-validator` for non-array, empty, over-limit, duplicate, wrong media type, empty/oversized ID, and valid input. Duplicate rejection is the API boundary; still defensively deduplicate in the service so internal callers cannot amplify work.

**Verify**: DTO tests pass; before decorators are added, they should fail for invalid cases.

### Step 2: Replace per-ID queries with one grouped aggregate

Create `uniqueMediaIds = [...new Set(mediaIds)]`. Call `prisma.rating.groupBy` once with `by: ["mediaId"]`, `where: { mediaType, mediaId: { in: uniqueMediaIds }, seasonNumber: 0, episodeNumber: 0 }`, and both `_avg: { rating: true }` and `_count` for rows. Map rows by `mediaId`, then return items in first-occurrence request order. IDs absent from the grouped result must return `{ mediaId, averageRating: undefined, ratingCount: 0 }`. Confirm the generated Prisma `_count` shape in types rather than guessing it.

**Verify**: focused service tests assert one `groupBy`, zero `aggregate`/`count` calls, stable first-occurrence order, deduplication, missing IDs, and 0/0 scope.

### Step 3: Run all backend gates

**Verify**: check/typecheck and full backend tests pass.

## Test plan

- DTO validation cases listed in step 1.
- Service: mixed rated/unrated IDs; duplicate IDs produce one response item and one query input; order preserved; empty defensive input yields empty items without querying; groupBy is constrained to requested media type and 0/0.
- Adapt the existing `getBatchRatings` tests rather than deleting their behavioral assertions.

## Done criteria

- [ ] Invalid/non-array/empty/duplicate/>100 input is rejected by DTO validation.
- [ ] Service defensively deduplicates and performs at most one DB query.
- [ ] Existing response shape and top-level rating scope are preserved.
- [ ] Focused tests, check, typecheck, and full tests pass.
- [ ] Only in-scope files changed.

## STOP conditions

Stop if generated Prisma cannot group by `mediaId` with `_avg` and `_count`, existing clients demonstrably depend on duplicate response entries, a different documented batch maximum exists, or changing the endpoint contract requires regenerating the shared API client (out of scope for this plan).

## Maintenance notes

Keep the DTO limit and any generated API documentation synchronized. If season/episode batching is added later, expand the grouping key rather than removing the 0/0 predicate silently.
