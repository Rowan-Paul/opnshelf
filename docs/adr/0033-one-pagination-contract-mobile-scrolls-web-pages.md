# ADR 0033: One pagination contract; Mobile scrolls, Web pages

Status: Accepted and implemented (issue #251).

Issue [#251](https://github.com/Rowan-Paul/opnshelf/issues/251) asks the **Mobile App** to load lists as the reader scrolls instead of paging. Before this change the backend spoke two pagination dialects and the Mobile App mixed three interaction models: infinite scroll on the Social feed, list items and filmography; "Load more" buttons on profile Reviews, Notes and the Circle editor; Prev/Next on the Shelf tab and the Trakt import list. Connections, Up Next, Search and Find people silently stopped after the first page.

## Decision

Every list endpoint takes `page` and `pageSize` and returns `items` with `total`, `page`, `pageSize`, `totalPages`, `hasNextPage` and `hasPreviousPage`. The shape lives in `backend/src/common/pagination.ts`; new list endpoints extend `PageQueryDto` and `PaginationMetaDto` rather than defining their own. The user reviews, media reviews and notes endpoints move from `limit`/`cursor` to this shape; the Trakt import issues and person filmography responses gain the missing metadata fields. The TMDB proxies (movie and show search, discover, recommendations, unified search, person search) and the Discover sections no longer pass TMDB's `results`/`total_results`/`total_pages` envelope through: `fromTmdbPage` re-expresses each TMDB page in the contract, with `pageSize` reflecting the merged width where movies and shows are interleaved. Item-level TMDB fields such as `poster_path` are unchanged.

On the Mobile App every list loads its next page when the reader nears the bottom. Lists that own a `FlatList` or `FlashList` use its `onEndReached`. Sections that render inside a screen's ScrollView subscribe through `useEndReached`, driven by the screen's `EndReachedScrollView`; a screen that owns the container passes `onEndReached` to it instead, since the hook only sees a container above it. The container mirrors `onEndReached` semantics: it fires once per approach and re-arms whenever the content changes size, so a short first page keeps filling the viewport even when it replaces a taller loading skeleton. A pending page shows a skeleton matching the row shape at the tail of the list; loaded items stay on screen. A failed next page stops the automatic chain and shows an inline Retry at the tail instead, so a persistent error cannot loop the request, and a full-page error state only appears when nothing has loaded yet. Changing a filter, sort or search term puts the new value in the query key so the list restarts from page one.

The **Web App** keeps its existing interaction: Shelf, Up Next and Search page by `?page=` in the URL, and Reviews and Notes accumulate pages behind a "Load more" button. Web pages are bookmarkable, server-rendered and crawlable, which infinite scroll would weaken; on a phone the URL is not part of the experience, so ADR 0006's parity rule is met at the data contract, not at the control.

## Alternatives rejected

- **Standardize on cursors.** Cursors are stable under concurrent inserts, but they cannot express the Web App's URL paging, cannot wrap the TMDB proxies (which are page-based), and were already the minority shape. Personal shelves and profiles rarely gain items mid-scroll, so the offset drift a page-based contract allows is acceptable.
- **Give every mobile section its own list.** A `FlatList` per profile tab would restore virtualization but forces the profile hub to give up its shared header and sticky tab bar. The sections were already rendered unvirtualized inside the hub's ScrollView, so the end-reached container adds scroll loading without a layout rewrite.
- **Keep Prev/Next on the Trakt import list.** A retry queue shrinks as items are fixed, and a range label communicates progress. The operator chose consistency; the list now reports "Showing N of total" and refetches from page one after a retry.

## Consequences

- Clients read `items` and `hasNextPage` from every list, TMDB-backed or not, so one `getNextPageParam` rule serves the whole Mobile App and the Web search page takes its page count straight from the server.
- Invalidation keys for reviews and notes are path-only, so one invalidation refreshes every page size and the infinite caches on both clients.
- `movies/user/{userDid}/paginated` and `shows/user/{userDid}/episodes` had no client callers and are removed rather than converted.
