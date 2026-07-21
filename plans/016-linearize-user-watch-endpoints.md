# Plan 016: Make user movie and show summaries linear and query-bounded

> **Executor instructions**: Follow this plan exactly and run every gate. Stop and report instead of widening scope. Update the index row unless the reviewer owns it.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- backend/src/movies/movies.service.ts backend/src/movies/movies.controller.ts backend/src/movies/movies.service.spec.ts backend/src/movies/movies.controller.spec.ts backend/src/shows/shows.service.ts backend/src/shows/shows.controller.ts backend/src/shows/shows.service.spec.ts backend/src/shows/shows.controller.spec.ts`
> Any mismatch with the excerpts below is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

The unpaginated user movie/show endpoints rescan the complete watch array once per distinct title, producing quadratic CPU work for heavy users. Their controllers then call a database-backed color helper once per result, creating a 1+N query pattern and potentially doing poster extraction during a public list request. The existing relation includes already carry persisted colors, so these endpoints can preserve response shape while grouping in one pass and returning those colors without per-result I/O.

## Current state

- `backend/src/movies/movies.service.ts:69-94` fetches watches newest-first, then counts by filtering the full array:

  ```ts
  for (const tracked of trackedMovies) {
    const existing = movieMap.get(tracked.movieId);
    if (!existing) {
      const watchCount = trackedMovies.filter(
        (tm) => tm.movieId === tracked.movieId,
      ).length;
      movieMap.set(tracked.movieId, { ...tracked, watchCount });
    }
  }
  ```

- `backend/src/shows/shows.service.ts:420-441` repeats the same pattern for `trackedEpisodes` and `showId`.
- Both Prisma reads use `include: { movie: true }` / `include: { show: true }`, so `tracked.movie.colors` and `tracked.show.colors` are already present.
- `backend/src/movies/movies.controller.ts:116-139` maps every result through `ensureMovieHasColors`; `backend/src/shows/shows.controller.ts:194-215` does the same with `ensureShowHasColors`.
- Test conventions use Vitest, Nest testing modules, in-memory Prisma mocks, and behavior assertions. Follow `backend/src/movies/movies.service.spec.ts:910-958` and `backend/src/movies/movies.controller.spec.ts:157-203`.
- Keep the endpoint response contracts unchanged: first/newest watch record per media item, `watchCount`, and nested `movie`/`show` with `colors` when persisted.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `pnpm --filter backend exec vitest run src/movies/movies.service.spec.ts src/movies/movies.controller.spec.ts src/shows/shows.service.spec.ts src/shows/shows.controller.spec.ts` | exit 0, all focused tests pass |
| Backend check | `pnpm --filter backend run check` | exit 0 |
| Backend typecheck | `pnpm --filter backend exec tsc --noEmit` | exit 0 |
| Full backend tests | `pnpm --filter backend run test` | exit 0, all tests pass |

## Scope

**In scope**:

- `backend/src/movies/movies.service.ts`
- `backend/src/movies/movies.controller.ts`
- `backend/src/movies/movies.service.spec.ts`
- `backend/src/movies/movies.controller.spec.ts`
- `backend/src/shows/shows.service.ts`
- `backend/src/shows/shows.controller.ts`
- `backend/src/shows/shows.service.spec.ts`
- `backend/src/shows/shows.controller.spec.ts`

**Out of scope**:

- Paginated movie/episode endpoints; changing their duplicate-watch semantics is a separate product/API decision.
- Color extraction on detail, search, upsert, release-calendar, or other endpoints.
- Schema, migration, DTO, generated API client, or response-shape changes.
- Replacing the read with raw SQL or Prisma aggregation; the safe fix is an in-memory single pass over the already-required rows.

## Git workflow

- Branch: `codex/improve-016-linear-watch-summaries`
- Prefer two logical commits: service grouping/tests, then controller color behavior/tests. Use imperative subjects consistent with recent history.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Characterize ordering and counts

Extend the existing movie service tests and add equivalent show service tests. Cover interleaved IDs, duplicate watches, empty input, and assert that the representative record is the first (newest, because the Prisma query orders descending). Include at least one media relation with a persisted `colors` object and assert it survives unchanged.

**Verify**: run the focused test command → all characterization tests pass before refactoring.

### Step 2: Replace quadratic grouping with a single pass

In each service method, maintain one `Map` entry per media ID. On the first row store `{ ...tracked, watchCount: 1 }`; on subsequent rows increment the existing entry's `watchCount` without replacing its representative watch. Do not call `.filter`, add queries, or change the existing Prisma `where`, `include`, or `orderBy`.

Target complexity is O(number of watch rows), with exactly one Prisma `findMany` call per method.

**Verify**: `rg -n 'tracked(Movies|Episodes)\.filter' backend/src/movies/movies.service.ts backend/src/shows/shows.service.ts` → no matches; focused service tests pass.

### Step 3: Remove per-result color I/O from the two unpaginated controllers

Return/map the service results synchronously. For movies, retain the tracked object and nested movie, setting `colors` from `tracked.movie.colors ?? undefined` only if an explicit normalization is required by the inferred return type. For shows, retain the current DTO shape (`showId`, `watchCount`, ISO `latestWatchedDate`, nested `show`) but take colors from `tracked.show.colors ?? undefined`. Do not call either `ensure*HasColors` method in these two controller methods; leave those helpers and all other callers intact.

Update controller tests so persisted colors come from the mocked relation. Assert the returned colors and assert `ensureMovieHasColors` / `ensureShowHasColors` is not called. Add a show controller test matching the movie test's structure.

**Verify**: `sed -n '116,140p' backend/src/movies/movies.controller.ts; sed -n '194,216p' backend/src/shows/shows.controller.ts` → neither excerpt contains `Promise.all` or `ensure`; focused controller tests pass.

### Step 4: Run the complete backend gate

**Verify**: `pnpm --filter backend run check && pnpm --filter backend exec tsc --noEmit && pnpm --filter backend run test` → all commands exit 0.

## Test plan

- Movie/show service tests: interleaved watch rows produce one entry per media ID, correct counts, newest representative, preserved relation/colors, one `findMany` call, and empty input.
- Movie/show controller tests: preserve public shape and persisted colors, do not call color-enrichment helpers, and return empty arrays.
- Use the existing specs named above; do not create a new harness.

## Done criteria

- [ ] Neither grouping method filters the full result array inside its loop.
- [ ] Both methods preserve first/newest representative ordering and exact watch counts.
- [ ] The two unpaginated controller methods issue no per-result color-helper calls.
- [ ] Response DTO shape and persisted colors remain intact.
- [ ] Focused tests, backend check, backend typecheck, and full backend tests pass.
- [ ] No executor-created file outside the eight in-scope files and `plans/README.md` is modified.
- [ ] Index status is updated unless reviewer-owned.

## STOP conditions

Stop if service results no longer include full movie/show relations, clients require missing colors to be generated synchronously by these list endpoints, preserving response shape requires DTO/generated-client changes, or tests reveal ordering is not newest-first. Do not silently broaden this into paginated endpoints or a database migration.

## Maintenance notes

Reviewers should scrutinize representative-row ordering and off-by-one count updates. Returning stored colors means a legacy row without colors stays uncolored on this endpoint until another existing enrichment path fills it; that trade-off is intentional to make public collection reads query-bounded.
