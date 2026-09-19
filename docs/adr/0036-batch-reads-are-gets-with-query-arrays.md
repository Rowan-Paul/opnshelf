# ADR 0036: Batch reads are GETs that take their ids in a query array

Status: Accepted and implemented (issue #334).

Two endpoints answered a read over POST because the ids travelled in a body: `/ratings/batch` for public aggregate ratings, and `/shows/progress` for viewer-scoped progress. A body is the obvious place to put a list, and neither handler had a side effect, so the shape looked harmless.

It was not. The generated client emits `queryOptions` only for GETs and a `...Mutation` for POSTs, so a read over POST can only reach a client as a mutation or as a hand-written `queryFn`. Both happened. `useShowProgress` hand-wrote a `queryFn` on each client; `useBatchRatingsQuery` took the mutation, and because a mutation is keyed by nothing, every re-render of a movie page fired another POST and each one aborted by navigation was reported as a failed mutation (#332, #333). A POST also cannot be cached or revalidated: the browser must go to the network for a list of ids it asked for two seconds ago.

## Decision

A batch read is a GET and takes its ids as a repeated query parameter: `GET /ratings/batch?mediaType=movie&mediaIds=550&mediaIds=680`, `GET /shows/progress?showIds=1399&showIds=1396`. It stays a GET unless the ids can realistically exceed URL limits.

For these two, they cannot. A hundred TMDB ids is roughly 800 characters, and the defensive worst case the validators allow — 100 ids of 50 characters — is about 5 KB, well under the 8 KB default header limit. The per-endpoint limits are the validators' job, not the URL's: 100 unique ids of at most 50 characters for ratings, 50 numeric ids for show progress.

Express hands a repeated parameter back as an array but a single occurrence as a bare string, so query-array DTOs carry `@IsQueryArray()` (`backend/src/common/query-array.ts`) to widen the one-id case before validation sees it. A single visible poster is the common case and must not read as a malformed batch.

Responses carry cache validators rather than a lifetime. `/ratings/batch` is a public aggregate, so a shared cache may hold it, but it is `no-cache` with an ETag rather than a long `max-age`: React Query invalidation cannot evict the browser's HTTP cache, and an average that still shows the old number right after you rate reads as a dead click. `no-cache` keeps the stored copy and makes every use revalidate, so an unchanged aggregate costs a 304 and no body. `/shows/progress` is per-viewer and adds `private`.

The consequence that matters is on the clients: wiring a read as a mutation stops being representable. Both hooks now compose the generated `queryOptions`, and neither client hand-writes a `queryFn` for a batch read.

## Alternatives rejected

- **Keep the POSTs and hand-write `queryFn`s.** This is where #333 left `useBatchRatingsQuery`, and it works. It also leaves the trap armed: the next batch read added over POST gets a `...Mutation` in the generated client and the next developer wires it, because that is the only thing codegen offered them. The request shape is duplicated by hand in every client that calls it, and the response can still never be revalidated.
- **Add GET variants and keep the POSTs.** Two shapes for one read, and the mutation stays representable, which is the thing this ADR is trying to remove. Neither endpoint has an out-of-repo caller, so there is nothing to keep them for.
- **`max-age` on `/ratings/batch`.** A shared cache would answer more requests outright, but the browser would too — and the browser is the one showing you the average of a Rating you just set. A revalidation is one round trip; a wrong number on screen is a bug report.
- **Pack the ids into one comma-joined parameter.** Shorter URLs, and it sidesteps the single-value widening. It also means a hand-rolled encoding on both sides, no array in the OpenAPI document, and a generated client that takes a string the caller has to build correctly.

`POST /users/me/import/trakt/public/fetch` stays a POST. It reads, but it is expensive, rate-limited and not something a cache should ever replay.
