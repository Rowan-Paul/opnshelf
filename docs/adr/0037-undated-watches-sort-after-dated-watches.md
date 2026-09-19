# ADR 0037: Undated Watches sort after dated Watches

Status: Accepted and implemented (issue #225).

A Watch carries an optional watch date — `watchedAt` in the lexicon and the API, `watchedDate` in the database. The field has been nullable since the Trakt import landed, and the write path has a documented tri-state: omit it and the server stamps the current time, pass an instant and the server stores it, pass `null` and the Watch is undated. Onboarding uses the third case so that swiping through twenty recognizable titles does not claim you watched all of them this afternoon.

Undated was reachable, but only from onboarding, so nothing exercised how an undated Watch behaves in a list. It behaves badly. Postgres sorts `NULL` first under `DESC`, so the bare `orderBy: { watchedDate: "desc" }` used by both watch-history endpoints, `getUserMovies`, `getUserShows` and the Up Next anchor floats every undated Watch above every dated one. The user-visible results range from a history list in the wrong order, to an Up Next row anchored on a Watch with no date (`latestWatchedDate` silently falling back to `createdAt`), to `DELETE /movies/watched/:movieId?mode=latest` deleting an undated Watch instead of the one you actually watched most recently. That last one destroys data on a button labelled "remove latest".

Exposing the undated choice in the clients' date pickers turns all of this from dormant to routine.

## Decision

An undated Watch sorts **after** every dated Watch in any date-ordered Watch list, regardless of sort direction, tie-broken by `createdAt` descending so the most recently logged undated Watch leads its peers.

In Prisma that is `[{ watchedDate: { sort: direction, nulls: "last" } }, { createdAt: "desc" }]`, exported once as `watchDateOrderBy()` from `backend/src/common/watch-ordering.ts` and used by every query that orders Watches by date. Call sites that need more tie-breakers spread it and append, as the Up Next anchor does with season and episode.

"After, regardless of direction" is the part worth stating explicitly. `nulls: "last"` on an ascending sort is not symmetric with a descending one — it keeps undated Watches at the bottom in both, which is what "undated is not a date" means. An undated Watch is a position in a list only because it has to be rendered somewhere; it is never the answer to "what is the most recent".

The rule already existed in two places before this ADR — the Shelf computes an `isUndated` column and sorts on it first, and `discover.service.ts` uses exactly this `nulls: "last"` pair — so this generalises local practice rather than introducing it.

Two consequences follow. `mode: "latest"` now means the latest *dated* Watch, falling back to the most recently created undated one only when a title has no dated Watches at all. And the Up Next anchor can no longer be won by an undated Watch, so `latestWatchedDate` stops quietly meaning `createdAt` for any show marked watched during onboarding.

## Alternatives rejected

- **`COALESCE(watchedDate, createdAt)`.** Sorts undated Watches by when they were logged, interleaved with dated ones, and it is already used for ordering in the activity-feed SQL. It invents a date the user explicitly declined to give, and the invented date is *worse than arbitrary*: it is the import or onboarding timestamp, so a backfilled 1998 film sorts as watched today. That is the exact outcome undated Watches exist to prevent.
- **Undated Watches first.** Defensible if you read a missing date as "needs attention", like an unfiled receipt. It is not missing — it is a choice the product offers, with a button that says "No date". Sorting it to the top makes a deliberate answer look like an error state, and it is the behaviour that caused the `mode: "latest"` bug.
- **Per-query judgement.** Let each list decide: undated last in history, coalesced in Up Next, excluded from the Shelf. This is roughly where the code already was, by accident rather than intent, and it is why three of the six sites were wrong. One rule can be stated in a glossary entry and checked in review; six cannot.
- **Exclude undated Watches from date-ordered lists entirely.** Consistent with how the activity feed and date-based statistics already treat them, and it sidesteps ordering altogether. But those are *date-based* surfaces, where a Watch without a date has nothing to contribute. A watch-history list is the record of a title's Watches, and hiding a Watch the user logged — on the very screen that exists to show it — is worse than placing it last.

The exclusions stay as they are: the followed-activity feed, "watched this year", and the 30-day profile activity graph continue to filter `watchedDate IS NOT NULL`. An undated Watch belongs on the Shelf, not in a timeline.
