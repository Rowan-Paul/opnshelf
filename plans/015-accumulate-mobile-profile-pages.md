# Plan 015: Make mobile Reviews and Notes “Load more” accumulate pages

> **Executor instructions**: Follow every step and gate. Stop on any STOP condition. Update the plan index row when complete unless the reviewer owns it.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- apps/mobile/src/lib/use-public-profile.ts apps/mobile/src/lib/use-public-profile.test.tsx apps/mobile/src/components/profile/tabs/ReviewsTab.tsx apps/mobile/src/components/profile/tabs/ReviewsTab.test.tsx apps/mobile/src/components/profile/tabs/NotesTab.tsx apps/mobile/src/components/profile/tabs/NotesTab.test.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/009-establish-mobile-test-baseline.md`
- **Category**: bug
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

Both profile tabs store only the next cursor and render only that cursor's query result. Pressing “Load more” therefore replaces visible page one instead of appending page two. Use React Query infinite pagination so pages accumulate, reset by user identity, and remain compatible with invalidation after review mutations.

## Current state

- `ReviewsTab.tsx:49-53` and `NotesTab.tsx:24-28` both follow this replacement pattern:

```ts
const [cursor, setCursor] = useState<string | undefined>(undefined);
const { data, isLoading, isError } = useProfileReviews(userDid, cursor);
const reviews = data?.items ?? [];
```

- Their buttons only call `setCursor(data?.nextCursor)`, so previous data is no longer rendered.
- `apps/mobile/src/lib/use-public-profile.ts:89-111` wraps generated `useQuery` options for one cursor page. `useProfileReviews` is also used by Overview previews with a small limit, so do not silently change that existing hook's return type.
- Review mutation invalidation uses the generated `reviewsControllerGetUserReviewsQueryKey` prefix. New infinite data must remain invalidatable under that family or explicitly invalidate its own stable key alongside it.
- React Query v5 is already installed; use `useInfiniteQuery`, not component-owned arrays that can duplicate stale pages.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Focused tests | `pnpm --filter @opnshelf/mobile test -- use-public-profile.test.tsx ReviewsTab.test.tsx NotesTab.test.tsx` | all pass |
| Typecheck | `pnpm --filter @opnshelf/mobile typecheck` | exit 0 |
| Check | `pnpm --filter @opnshelf/mobile check` | exit 0 |

## Scope

**In scope**:
- `apps/mobile/src/lib/use-public-profile.ts` and `.test.tsx`
- `apps/mobile/src/components/profile/tabs/ReviewsTab.tsx` and `.test.tsx`
- `apps/mobile/src/components/profile/tabs/NotesTab.tsx` and `.test.tsx`

**Out of scope**:
- Backend pagination/DTOs, Overview preview behavior, virtualized lists, pull-to-refresh redesign, page-size changes, review card mutation behavior, or generated API files.

## Git workflow

- Branch: `codex/improve-015-accumulate-profile-pages`
- Commit message: `Accumulate mobile profile pagination`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Add dedicated infinite hooks without breaking preview hooks

Keep `useProfileNotes` and `useProfileReviews` signatures intact for existing callers. Add `useInfiniteProfileNotes(userDid, limit = 20)` and `useInfiniteProfileReviews(userDid, limit = 20)` using React Query v5 `useInfiniteQuery`. The query function must call the generated SDK endpoint with `pageParam` as cursor; `initialPageParam` is `undefined`; `getNextPageParam` returns `lastPage.nextCursor ?? undefined`. Use stable keys containing endpoint family, `userDid`, and `limit`, but not current cursor, and ensure existing review invalidation reaches the infinite query (or update `invalidateList` in the scoped ReviewsTab accordingly). Do not edit generated files.

**Verify**: hook tests fetch two mocked pages, assert the second request receives page-one cursor, and assert `data.pages` retains both.

### Step 2: Flatten accumulated Reviews pages

Replace cursor state/useQuery in ReviewsTab with the infinite hook. Flatten `data.pages.flatMap(page => page.items)` in page order. Wire button to `fetchNextPage`, disable it while `isFetchingNextPage`, show the existing activity indicator or a deterministic loading label, and prevent double presses. Preserve first-load skeleton/error/empty behavior and card keys/actions.

**Verify**: component test renders page one, presses Load more, resolves page two, and finds items from both pages exactly once in order; rapid double press issues one request.

### Step 3: Flatten accumulated Notes pages

Apply the same pattern to NotesTab, preserving cards and empty/error states. A change in `userDid` must select a different infinite query key and must not display the previous user's pages while the new initial page loads.

**Verify**: component test proves two-page accumulation and user A → B reset with no A note visible for B.

## Test plan

- Hook tests: initial cursor omitted, next cursor forwarded, terminal null removes Load more, fetch error retains prior pages and permits retry.
- Tab tests: two pages remain visible in order, no duplicate request on rapid press, button loading/disabled state, identity reset.
- Use small fake DTO factories containing only required fields; never snapshot whole generated responses.
- Run the full mobile suite/typecheck/check.

## Done criteria

- [ ] Pressing Load more retains all previous review/note items and appends the next page once.
- [ ] Terminal cursor hides the button; in-flight presses cannot duplicate fetches.
- [ ] Existing preview hooks and Overview behavior retain their types.
- [ ] Changing `userDid` cannot show the old user's accumulated pages.
- [ ] Mutation invalidation still refreshes the Reviews list.
- [ ] All mobile gates pass and only Scope files changed.

## STOP conditions

- Generated SDK endpoint functions or response types are not exported for an infinite query function.
- Existing mutation invalidation cannot reach the new query without modifying a file outside Scope.
- Backend cursors can legitimately repeat or return cycles; report before adding client deduplication.
- Plan 009 is incomplete or component tests require broad native platform configuration.

## Maintenance notes

Keep single-page preview hooks separate from infinite tab hooks. If optimistic review edits later update infinite data directly, update every page containing the review by ID and retain the pagination envelope.
