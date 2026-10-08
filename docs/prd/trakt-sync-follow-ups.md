# Trakt Sync follow-up issue drafts

Not posted. Final titles and bodies are provided below for operator review.
These are proposed sub-issues of [#260](https://github.com/Rowan-Paul/opnshelf/issues/260); the first version remains Watches and Ratings only.

Open and closed issue searches found no dedicated issue for these four categories. Historical umbrella requests [#14](https://github.com/Rowan-Paul/opnshelf/issues/14), [#43](https://github.com/Rowan-Paul/opnshelf/issues/43), and [#44](https://github.com/Rowan-Paul/opnshelf/issues/44) were closed as not planned and contain no category-specific requirements. Link these as background rather than reopening them without operator approval.

## Draft 1

Title: Sync watchlist membership with Trakt

Body:

Follow-up to #260, whose agreed first version covers Watches and Ratings.

Observed behavior: the current Trakt Import transfers Watch history only, and the planned initial Trakt Sync excludes watchlist membership. Adding a title to a watchlist on one service does not transfer that membership to the other.

Expected behavior: users can opt into transferring watchlist membership in their selected direction, with equivalent controls on Web and Mobile.

Reproduction: add an unwatched movie to a Trakt watchlist, then run the existing Trakt Import. Inspect the Opnshelf watchlist; that membership is not imported.

Scope: design and implement membership reconciliation, including additions, removals, initial matching, and limits. Decide how Trakt's automatic watchlist removal after watching maps to Opnshelf before implementing it. Keep custom Lists, Library ownership, and Reviews separate.

Evidence: `backend/src/users/trakt-api.client.ts` fetches profile and Watch history; `trakt-normalize.ts` normalizes movie and episode Watches. The agreed scope in #260 excludes watchlist sync. Reproduction is derived from source inspection, not a live-account test.

## Draft 2

Title: Sync custom Lists with Trakt

Body:

Follow-up to #260, whose agreed first version covers Watches and Ratings.

Observed behavior: custom Lists are not transferred by the current Trakt Import and are excluded from the planned initial Trakt Sync. Maintaining the same List on both services requires separate edits.

Expected behavior: users can opt into syncing selected custom Lists, with equivalent management on Web and Mobile.

Reproduction: create a custom List with several media items on Trakt, then run the existing Trakt Import. No corresponding Opnshelf List or memberships are created.

Scope: settle List pairing, names, descriptions, membership order, supported media types, privacy, deletion, and concurrent edits before implementation. Do not silently publish a private List or discard unsupported metadata. Keep watchlist membership and Library ownership separate.

Evidence: the Trakt client only reads profile and Watch history. Opnshelf's List model includes ordered memberships and metadata, which require rules beyond Watch reconciliation. Reproduction is derived from source inspection, not a live-account test.

## Draft 3

Title: Sync Library ownership with Trakt collection

Body:

Follow-up to #260, whose agreed first version covers Watches and Ratings.

Observed behavior: Opnshelf Library ownership is not transferred to or from Trakt collection by the current importer and is excluded from the planned initial Trakt Sync.

Expected behavior: users can opt into transferring representable ownership information without losing Opnshelf-specific ownership details, with equivalent controls on Web and Mobile.

Reproduction: add a movie to a Trakt collection, then run the existing Trakt Import. The corresponding Library ownership is not created in Opnshelf.

Scope: establish mappings for supported formats and collection attributes, multiple ownership records, Box Sets, additions, removals, and conflicts. Explicitly report concepts that cannot be represented on the other service. Preserve the distinction between Library ownership and List curation.

Evidence: ADR 0011 separates Library ownership from Lists; the current Trakt client imports Watch history only. Reproduction is derived from source inspection, not a live-account test.

## Draft 4

Title: Support compatible Review transfers with Trakt

Body:

Follow-up to #260, whose agreed first version covers Watches and Ratings.

Observed behavior: Review text is not transferred by the current Trakt Import and is excluded from the planned initial Trakt Sync. Ratings are a separate concept and do not transfer a Review's prose.

Expected behavior: define and implement an opt-in transfer for compatible Reviews, with clear outcomes for text that Trakt cannot accept and equivalent controls on Web and Mobile.

Reproduction: write a Review on Opnshelf. The existing Trakt integration has no outbound Review operation and does not create a Trakt comment or review.

Scope: settle supported directions, correspondence between multiple Reviews and Trakt comments, spoiler handling, formatting, edits, deletion, and publication consent. Preserve original text and report unsupported content instead of silently translating, truncating, or fabricating it. Do not trigger Bluesky Cross-posts or Blog Mirrors as an incidental consequence of transfer.

Evidence: Opnshelf models long-form Reviews independently of Ratings. Trakt's [comment rules](https://developer.trakt.tv/docs/about-comments) require English and a minimum word count, so universal lossless Review sync cannot be assumed. Reproduction is derived from source inspection, not a live-account test.
