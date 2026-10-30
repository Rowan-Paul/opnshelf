# Popfeed Sync

Design brief for [issue #29](https://github.com/Rowan-Paul/opnshelf/issues/29).
Status: implemented in the #29 branch in both directions, verified with fixtures and local databases only. No Popfeed record has been written to a real repository yet, so the open verification items below still decide whether outbound is ready to release. The Popfeed Onboarding offer is not implemented. [ADR 0051](../adr/0051-integrations-share-one-sync-core.md) records the shared integration architecture. The verification items below must be resolved before the outbound half ships.

## Why this is back

#29 was closed because Popfeed seemed to model everything as one progress-based `social.popfeed.feed.listItem`, so any interop would be a lossy mapping with no user asking for it. A user has now asked for "popfeed tv and movies lexicons on the app, as well as the sync between opnshelf and the brand new bingers public api" ([request](https://bsky.app/profile/mat.zelk.space/post/3myav4rxa6c24)). Bingers is a separate integration with its own issue; this brief covers Popfeed only.

Real records show the mapping is less lossy than that comment assumed. Popfeed records carry TMDB IDs, and its system lists encode roles that match Opnshelf concepts. Popfeed records live in the User's own AT Protocol repository, so reading them needs no external account, credentials or Popfeed API.

## Agreed decisions

Operator decisions on 2026-10-30:

- Two-way sync: Popfeed → Opnshelf, Opnshelf → Popfeed, or both, chosen by the User, like Trakt Sync.
- Popfeed Sync behaves like Trakt Sync: ongoing, linked records, history scope, Needs attention, conflict resolution. It is not a one-time import and not a display-only view.
- Both run on one standardized integration core, because more integrations will follow (ADR 0051).
- Popfeed reviews sync as Opnshelf Reviews with an empty title.
- A new **Integrations** settings section on Web and Mobile holds Trakt and Popfeed.

## Evidence

Popfeed does not publish its lexicons. Its DNS lexicon record (`_lexicon.feed.popfeed.social`) resolves to a wildcard, its own repository (`did:plc:i6k6scfcdaup4e2va33nkprb`) holds no `com.atproto.lexicon.schema` records, and the PDS a User writes to does not keep them either. Two third-party projects carry copies:

- [BookHive `lexicons/popfeedListItem.json` and `popfeedList.json`](https://github.com/nperez0111/bookhive/tree/main/lexicons), last changed 2026-03-17.
- [gamesgamesgamesgamesgames `social/popfeed/feed/review.json`](https://github.com/gamesgamesgamesgamesgames/lexicon/tree/main/src/lexicons/social/popfeed/feed), last changed 2026-07-16.

These copies are not authoritative, and live records already break them: the operator's `listItem` has `mainCreditRole: "Directed by"`, outside the copied enum. Use them for field names and intent, not for validation. What the copies add beyond the observed records:

- `review.rating` is `0`–`10` and required. `0` has no Opnshelf equivalent. Treat it as no Rating, pending verification. An Opnshelf Review without a Rating has no clean outbound value; see open verification.
- `listItem` also defines `status` (`#finished`, `#in_progress`, `#backlog`, `#abandoned`), `startedAt`, `completedAt` and `backdrop`. This is the progress model the original closing comment described. No observed movie or TV record uses it, but inbound must accept it: `#finished` with `completedAt` is a Watch, the rest are not.
- `creativeWorkType` includes `tv_season`, `tv_episode` and `episode`, and `identifiers` includes `seasonNumber`, `episodeNumber` and `tmdbTvSeriesId`. Season and episode records, including episode reviews, are possible even though none were observed.
- `review.crossPosts` holds Bluesky and Leaflet URIs. It is not synced.
- `list.itemOrder` holds ordered item URIs, alongside each item's `position`.

The shapes below are observed from the requester's public repository on 2026-10-30: 989 `listItem`, 441 `review` and 3 `list` records. Implementation must validate defensively, tolerate unknown fields and values, and preserve fields it does not own when updating a Popfeed record.

| Collection | Observed fields that matter |
| --- | --- |
| `social.popfeed.feed.listItem` | `creativeWorkType` (`movie`, `tv_show`), `listType` (`watched_movies`, `movie_watchlist`, `default`), `listUri`, `addedAt`, `identifiers.tmdbId` / `imdbId`, `watchedEpisodes[]` of `{tmdbId, seasonNumber, episodeNumber}` on TV items, `position`, plus denormalized title, poster blob, genres and credits |
| `social.popfeed.feed.review` | `rating` (integers 2–10 observed), `text`, `facets`, `containsSpoilers`, `isRevisit`, `createdAt`, `identifiers`, `creativeWorkType`, plus the same denormalized media fields. `title` is the media title, not a review title. |
| `social.popfeed.feed.list` | `name`, `description`, `listType` (`default`, `currently_watching_tv_shows` observed), `ordered`, `tags`, `createdAt` |

Observed in this sample:

- 96% of `addedAt` values are exactly midnight UTC, so they carry a date, not a time.
- Only one movie has two `watched_movies` items. Popfeed appears to keep one watched marker per movie rather than one record per viewing. No `isRevisit: true` review exists in the sample, so rewatch representation is unverified.
- 438 of 441 reviews have empty `text`. In practice a Popfeed review is mostly a rating with a date.
- About 3% of records have no `tmdbId`. A few have an `imdbId` only; some have no identifiers at all.
- Items reference system lists such as `watched_movies` and `movie_watchlist` whose `list` records do not exist in the repository. The role comes from the item's `listType`, not from a list record.
- `watchedEpisodes` has no dates.
- The requester also has `xyz.opnshelf.movie` records, so initial reconciliation will meet overlapping history.

A controlled log on the operator's account on 2026-10-30 (The Fellowship of the Ring, 5 stars in Popfeed) confirmed:

- One log writes a `watched_movies` `listItem` and a `review` two seconds apart. Both carry the TMDB ID.
- 5 stars is stored as `rating: 10`. Popfeed's stars map to the Opnshelf 1–10 scale directly; the odd values in the requester's sample are half stars.
- A log for "now" keeps the real time in `addedAt`. The midnight-UTC values are backdated, date-only logs.
- A new account gets a real `watched_movies` `list` record. The requester's missing system lists are probably from an older Popfeed version, so handle both.
- Popfeed writes posters as blobs to the User's PDS, including an Opnshelf-hosted one. On a new `listItem`, `posterUrl` points at TMDB rather than the blob, so both forms occur.
- `mainCreditRole` is inconsistent (`Directed by` on the new item, `director` on its review and on all 952 of the requester's items), so it is display text, not data to match on.
- Field for field, the review and list item match the requester's records. The new `list` record differs: it adds `authorDid` and `indexedAt`, and omits `ordered` and `tags`. Treat both list shapes as valid, and default a missing `ordered` to unordered.
- The same movie already had an Opnshelf Watch on 2026-10-15 and a Rating of 10. In initial two-way sync the equal Ratings link without a conflict. The Popfeed marker on 2026-10-30 becomes a new Opnshelf Watch, and the earlier Opnshelf Watch is the rewatch case below.

## Mapping

| Popfeed | Opnshelf | Inbound | Outbound |
| --- | --- | --- | --- |
| `listItem`, `listType: watched_movies`, movie | Movie Watch | One Watch dated by `addedAt`. Midnight-UTC values are dates without a time: converting them into the owner's timezone (ADR 0005) would move them to the previous day west of UTC, so keep the calendar date. Other times are kept as they are. | The first linked Watch of a movie creates the marker, dated by that Watch. Further Watches are rewatches Popfeed cannot hold in a marker; see Rewatches. Removing the last linked Watch removes the marker. |
| `listItem`, `tv_show`, `watchedEpisodes[]` | Episode Watches | One No date episode Watch per listed episode. | Add each watched episode to the show's array. Popfeed has no episode dates, so dates do not round-trip; Opnshelf keeps its own. |
| `listItem`, `listType: movie_watchlist` | Watchlist membership | Same watchlist semantics as Trakt Sync. | Same. |
| `listItem` in a `default` list + its `list` record | Custom List and membership | Pair by stable list URI after the first link. Keep `position` order when the list is `ordered`. | Same, including names and descriptions. |
| `currently_watching_tv_shows` list | Not synced | Opnshelf derives "currently watching" from episode Watches and Up Next. | Not written. Verify whether Popfeed needs this membership to show a show with watched episodes. |
| `review.rating` | Rating (1–10, same scale) | `0` creates no Rating. One Rating per media item. If several Popfeed reviews rate one item, the latest `createdAt` wins. | Written onto the linked Popfeed review, or onto a new review with empty `text` when there is none. |
| `review.text` non-empty | Review | Review with an empty title and the text as content. `containsSpoilers` maps to the Spoiler Flag. Link facets become Markdown links; other facets become plain text. | Content as `text`, Spoiler Flag as `containsSpoilers`. The Review title is not representable on Popfeed; see open verification. |
| `review.isRevisit: true` | Additional Watch | Unverified: no sample exists. | Candidate representation of a rewatch. |
| `feed.like`, `actor.profile` | Not synced | No faithful Opnshelf equivalent. | — |

Popfeed puts a rating and text in one record. Opnshelf keeps them as an independent Rating and Review. Each Popfeed review links to at most one Opnshelf Rating and one Opnshelf Review. A Popfeed review with text and a rating produces both, and the two stay linked to the same Popfeed record.

Matching uses `identifiers.tmdbId`. A record without one goes to Needs attention as "Choose a TMDB match"; the first version does not look up an `imdbId` on TMDB. Popfeed records carry no title identifier, so a chosen match applies to that one record. A non-movie/TV item in a custom List marks the List as needing attention rather than being dropped silently.

### Rewatches

Implemented: a second Opnshelf Watch of a movie, or of an episode, stays local and appears in Needs attention as something Popfeed cannot hold.


Popfeed holds one watched marker per movie. Opnshelf holds one Watch per viewing. Following ADR 0049, never invent dates and never collapse Opnshelf history to fit a destination. Until revisit reviews are verified, extra Opnshelf Watches stay local and appear in Needs attention as not representable on Popfeed. If `isRevisit` reviews turn out to be Popfeed's rewatch log, map extra Watches to them in both directions.

## Sync behavior

Everything Trakt Sync defines in [its brief](trakt-sync.md) applies unless stated here: direction choice, history scope, per-type switches, linked-only propagation of edits and deletions, conflict resolution with Use Popfeed / Use Opnshelf, Needs attention with Ignore and undo, pause, disconnect, and retention of links until account deletion.

Popfeed-specific rules:

- **No external account.** Connecting Popfeed means choosing to sync with Popfeed records in the User's own repository. There is no Popfeed credential and no account switching.
- **Reading.** Each read pages through `listRecords` on the User's PDS for the three collections and compares the repository's latest commit before and after, so a read taken while records change is discarded. The first version re-reads about every 15 minutes, like Trakt Sync; ingesting `social.popfeed.feed.*` changes through Tab for connected Users is a later improvement.
- **Date-only Watches.** A midnight-UTC `addedAt` becomes noon on that date in the owner's saved timezone and is marked date-only. A date-only Watch is the same viewing as an Opnshelf Watch within 12 hours of that noon, which is exactly that calendar day, so an existing Opnshelf Watch links instead of being duplicated.
- **Writing.** Writing `social.popfeed.*` collections is External Integration Access under ADR 0030. Enabling an outbound direction requests that grant, and disconnecting removes it. Inbound-only sync needs no extra grant.
- **Echo suppression.** Both sides live in the same repository and both reach Tab. Links record the URI and CID each side last wrote, so the change Tab sees after a sync write is recognized as the sync's own.
- **Denormalized fields.** Outbound records carry the title, release date, genres, main credit and poster that Popfeed records include, sourced from TMDB. When updating an existing Popfeed record, keep every field the sync does not own.
- **Privacy.** Popfeed records are public. Opnshelf → Popfeed from a private category publishes that data, so it needs the same explicit publication acknowledgement as Trakt Sync and is held while the category is private or migrating (ADR 0049, ADR 0048). Popfeed → Opnshelf writes each record where its category is stored.
- **Initial overlap.** Link an existing Opnshelf Watch of the same movie on the same calendar date instead of creating a duplicate. Several candidates on one date go to Needs attention.

## Integrations section

A new **Integrations** settings section on Web and Mobile lists each integration with its status: Trakt and Popfeed now, Bingers and others later. Each integration opens its own management page with direction, record types, history scope, status, Sync now, pause, disconnect and its Needs attention list.

- Trakt Sync moves from the Connections section into Integrations. Blog Mirror and Bluesky Cross-posts stay in Connections: they publish Reviews rather than syncing records.
- Proposed URLs, the same on Web and Mobile (ADR 0023): `/settings/integrations`, `/integrations/trakt`, `/integrations/trakt/attention`, `/integrations/popfeed`, `/integrations/popfeed/attention`. The existing `/trakt-sync` and `/trakt-sync/attention` redirect to the new routes, so captured links on Mobile (ADR 0022) keep working.
- Onboarding offers integrations from the same list. Popfeed is suggested first when the User's repository already contains `social.popfeed.*` collections.
- The settings section named Connections shares a name with the social **Connections** term in `GLOSSARY.md`. That is an existing collision. This brief does not change it.

## Client parity

| Capability | Web | Mobile |
| --- | --- | --- |
| Integrations section listing Trakt and Popfeed | Included | Included |
| Popfeed management: direction, types, history scope, status, pause, disconnect | Included | Included |
| Popfeed Needs attention, conflicts, ignore and undo | Included | Included |
| Trakt Sync moved into Integrations, old routes redirect | Included | Included |
| Onboarding integration offer, Popfeed suggested when detected | Not yet: Onboarding still offers Trakt only | Not yet: Onboarding still offers Trakt only |

## Outbound as built

- Writes need a separate `popfeed` External Integration Access grant (`repo:social.popfeed.feed.listItem`, `.review` and `.list`). Choosing a direction that writes to Popfeed asks for it first and warns that other devices must sign in again. Access can be removed once sync is back to Popfeed → Opnshelf.
- Watched movies are written to the Watched Movies list, created if missing. On older accounts that have the items but no list record, the existing items' `listUri` is reused. A movie Watch needs a date.
- Episodes are added to the show's existing entry. When no entry exists, the show is added to Currently Watching Shows, the list Popfeed itself used in the observed records.
- A Rating updates the latest rated Popfeed review of that title, or creates a review with empty text. Removing it deletes a text-less review, or sets `rating: 0` on a review that has text. A new Review copies the title's current rating so it stays consistent.
- Lists and the movie watchlist are kept in step item by item. Items Popfeed cannot hold (seasons, episodes, unmatched titles, item notes, shows on the movie watchlist) stop the transfer and appear in Needs attention; nothing is dropped.
- New records carry TMDB title, release date, genres, director or creator, `posterUrl`, `backdropUrl` and a poster blob, the same fields Popfeed writes. Updates keep every field Opnshelf does not own.

## Open verification

These are facts to establish, not product decisions. If one contradicts the rules above, surface it before changing the design.

- Ask Popfeed whether it will publish its lexicons, so validation can follow a real schema instead of third-party copies.
- What `rating: 0` means in Popfeed, and what rating an Opnshelf Review without a Rating should carry outbound, since `rating` is required.
- Whether Popfeed writes `status`, `startedAt` or `completedAt` on movie or TV items in current versions.
- Whether Popfeed writes `isRevisit: true` reviews for rewatches, and how they relate to the watched marker.
- Whether Popfeed displays the records Opnshelf writes, including without a poster blob when the upload fails, and whether it accepts a show added to Currently Watching Shows by another app.
- How Popfeed renders a review whose `text` came from a titled Opnshelf Review. Decide whether to prepend the title to `text` or drop it, and show that in setup.
- How Opnshelf renders a Review with an empty title on Web and Mobile, including Community Reviews, the Blog Mirror and Bluesky Cross-posts. The lexicon allows an empty title, but surfaces may assume one exists.
- Whether Popfeed tolerates unknown fields, and whether it rewrites records it did not create.
- Behavior when Popfeed's app and Opnshelf edit the same record within one sync window.

## Verification requirements

- Fixtures from real record shapes, including items without TMDB IDs, TV items with `watchedEpisodes`, midnight-UTC and non-midnight `addedAt`, multiple reviews per item, and unknown `listType` values.
- Both one-way directions and two-way, per type, with existing-history and future-only scope.
- Deduplication against existing Opnshelf Watches on the same date; rewatches reported, not collapsed.
- Edit and delete propagation for linked records only; no echo writes after a sync's own Tab event.
- Grant request and removal for outbound Popfeed access, without breaking Core Opnshelf Access or Trakt.
- Trakt Sync behaves identically after moving onto the shared core: its existing test suite passes unchanged.
- Integrations, Popfeed management and Needs attention checked in a browser and a Mobile simulator.
- No writes against Staging, since it shares the production PDS (ADR 0021), unless explicitly authorized. Outbound tests write public records, so use a disposable account on a local PDS.

## Delivery order

1. Extract the shared integration core with Trakt as its first adapter, with no behavior change. Done.
2. Add the Popfeed adapter inbound, with its `/popfeed-sync` API. Done; it ran before the Integrations section so the section has two real Integrations to list.
3. Add the Integrations section on both clients, move Trakt Sync into it, add Popfeed and redirect the old routes. Done, except the Popfeed Onboarding offer.
4. Add Popfeed outbound. Done in code at the operator's request on 2026-10-30, before the open verification items were answered. Release waits on a controlled write to a real account.

Each step is its own pull request.
