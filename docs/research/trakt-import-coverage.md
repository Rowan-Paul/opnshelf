# Remaining Trakt import coverage

Checked 15 October 2026 against official Trakt source at commit `f4d56611c7b116c570c8b137a7598408413505cf`. Research only; no account writes or implementation changes. PR #493 covers custom Lists and watchlist; PR #494 proposes Favorites. The original one-time Trakt Import still imports only Watch history. “Missing” below means missing from both that Import and those Sync scopes.

## Most useful remaining scopes

| Trakt data | Existing Opnshelf fit | What needs deciding |
| --- | --- | --- |
| Library/collection | Library Items, representing ownership rather than watched status | Format fidelity, collection dates and episode ownership |
| Own Reviews | Reviews, with original text/date and Spoiler Flag | Review title, text conversion, imported publication behavior |
| Standalone media Notes | Notes, separately from List item notes | Private visibility, spoilers, unsupported attachments and conflicts |

### Library / collection

The authenticated collection router reads movies, shows with collected seasons/episodes, individual episodes, or mixed media at `GET /sync/collection/{movies,shows,episodes,media}`. Movie/episode records include `collected_at` and `updated_at`; show records include nested episode collection dates. Collection membership is not Watch history. [Collection contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/sync/index.ts#L535), [response schemas](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/sync/schema/response/collectionResponseSchema.ts)

Opnshelf already has Library Items with media coordinates, a required Format (`digital`, `bluray`, `bluray4k`, `dvd`), optional Box Set and notes. The same title can have multiple Format records. That is the appropriate destination, rather than a synthetic custom List. [Local model](../../backend/prisma/schema.prisma#L643), [Library definition](../../GLOSSARY.md#library)

Format fidelity remains an API verification question: the official extended-info guide still describes collection `extended=metadata` as video/audio information, but the current collection contract does not model those fields and its accepted extended values omit `metadata`. Its `available_on` enum currently models Plex availability, not physical Format. Do not silently turn an unknown ownership Format into Digital or promise audio/HDR fidelity before checking authenticated payloads or exports. [Extended-info guide](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/developer/src/lib/guides/extended-info.md), [collection contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/sync/index.ts#L535), [availability enum](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/sync/schema/request/availableOnEnumSchema.ts)

### Own Reviews

`GET /users/:id/comments/:comment_type/:type` exposes a user's own media comments, filterable by comment type and media type. Replies are excluded by default; `include_replies` can include them. Records distinguish Reviews using `review`, preserve `spoiler`, text, original dates and parent identity, and refer to movies, shows, seasons or episodes. [User comments contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/index.ts#L433), [comment schema](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/_internal/response/commentResponseSchema.ts), [media wrapper](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/schema/response/userCommentResponseSchema.ts)

The closest fit is importing the author's top-level Reviews into Opnshelf Reviews. Ordinary short comments and replies should not automatically become long-form Reviews: they have different meaning, and Opnshelf has no equivalent reply-thread import. Opnshelf requires a title, stores Markdown and a whole-Review Spoiler Flag, permits multiple Reviews per media item, and keeps Ratings separately. Imported Reviews should not automatically trigger optional blog mirrors or Bluesky Cross-posts without an explicit product decision. [Local Review model](../../backend/prisma/schema.prisma#L705), [Review definition](../../GLOSSARY.md#review)

### Standalone media Notes

These are separate from the `notes` fields already synchronized on List members. `GET /users/:id/notes/:type` lists standalone Notes; `GET /notes/:id` and `/notes/:id/item` provide individual Note and attachment details. The contract carries text, dates, `privacy` and `spoiler`, and supports movie/show/season/episode/person/list attachments. [User Notes](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/index.ts#L482), [Notes contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/notes/index.ts)

Opnshelf Notes support movie/show/season/episode coordinates, one Note per user and media tuple, and at most 5,000 characters. It has no Note-level Spoiler Flag or person/list Note attachment in that model. Consequently an importer needs existing-Note conflict handling and must preserve private visibility; person/list attachments and unrepresentable spoiler semantics need explicit handling. The inspected official contract does not establish watch-event-specific Notes, so no promise about mapping history/activity Notes is made. [Local model](../../backend/prisma/schema.prisma#L674), [Note DTO](../../backend/src/notes/dto/note.dto.ts)

## Other available data with weaker current fit

- **Hidden/dropped shows and rewatch resets:** `GET /users/hidden/:section` includes watched-progress, dropped and recommendation suppression sections. `GET /shows/:id/progress/watched` exposes `reset_at` for rewatch progress; this changes which prior Watches count toward progress. These preferences are not recoverable from Watch history alone. Opnshelf would need an explicit destination model/product behavior. [Hidden contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/subroutes/hidden.ts), [show progress](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/shows/index.ts#L361)
- **Paused playback:** `GET /sync/playback` (also `/movies` and `/episodes`) returns unfinished playback. A paused position is distinct from a completed Watch; importing it needs a resumable-playback concept. [Playback contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/sync/index.ts#L133)
- **Liked Lists, collaborations and social graph:** liked Lists have `/users/likes/lists`; collaboration discovery has `/users/:id/lists/collaborations`, separate from the ordinary personal Lists endpoint. Following/followers are exposed under `/users/:id`. These reference other people's identities and content, so copying them as owned Lists or Opnshelf Follows would change their meaning. Smart-list definitions also have a distinct `/users/:id/smart-lists` API and no Opnshelf rule-engine equivalent. [User endpoints](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/index.ts), [personal/collaboration Lists](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/subroutes/userLists.ts#L411), [smart Lists](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/users/subroutes/smartLists.ts)

Generated recommendation results from `/recommendations/movies` and `/recommendations/shows` are available, but they are suggestions rather than an authored personal collection. Hidden recommendation preferences above are the portable user choices. [Recommendations contract](https://github.com/trakt/trakt-api/blob/f4d56611c7b116c570c8b137a7598408413505cf/projects/api/src/contracts/recommendations/index.ts)

## Suggested priority

Library Items, own Reviews and standalone media Notes are the clearest additions because Opnshelf already models their central meaning. This is a recommendation, not an accepted implementation decision. Each should be separately opt-in, with matching, privacy and unrepresentable data outcomes made explicit. History-derived progress/statistics do not require importing an additional aggregate merely to reproduce completed Watches; progress resets, suppression and partial playback are the exceptions identified above.

No code gates were run for this documentation-only investigation. No changes were made to PR #494.
