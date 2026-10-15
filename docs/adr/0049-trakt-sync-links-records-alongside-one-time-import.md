# ADR 0049: Trakt Sync links records alongside one-time Import

Status: Accepted; implemented in the #260 working branch, pending deployment. Extends ADR 0020 with ongoing sync while retaining its one-time Import and existing outcome-retention guarantees.

Issue #260 adds optional server-managed Trakt Sync for Watches and Ratings, selectable in either direction or both. Keep Import once available separately and retain existing Import results and Unmatched-item reconciliation. Repeatedly restarting the lifetime Import was rejected: its media-and-date identity cannot reliably follow edits, deletions, or changes from both services.

Sync needs account-scoped links between individual records and a remembered synchronized state, retained through disconnection until Opnshelf account deletion. Propagate edits and removals only for linked records, preserve unrelated destination data, and prevent echo writes. Include public records changed by other AT Protocol clients. Preserve Opnshelf Watch identity when dates change, as required by ADR 0042. Conflicting changes in two-way sync require resolution rather than guessing from timestamps that may reflect ingestion or historical rating dates. Account deletion removes the local sync state and access, not records already exported to Trakt.

Trakt's representational limits must not silently alter Opnshelf history. Link initial Watches only when a same-media, same-minute match is unambiguous and one-to-one. Preserve local timestamps and rewatch counts; report unrepresentable duplicates rather than inventing dates. No date Watches stay without dates.

The first version uses public Watches and Ratings, with explicit publication acknowledgement before importing private Trakt history. ADR 0048 now provides private Shelf storage. This first sync version still handles public Watches only: hold Watch transfers while the Shelf is private or changing privacy, and share the existing account lock with migration and deletion. Users can disable Watch sync and continue syncing public Ratings. Setup and management have parity in Web and Mobile.

An unfinished Import may permanently hand control to sync after its in-flight work finishes. Its Continued in Trakt Sync status preserves real historical progress and outcomes without claiming completion; the old Import cannot resume, even after sync disconnects. Matching and retries remain available through sync bookkeeping. A pause alone was rejected because it leaves the old importer resumable and able to compete with sync. Users can instead finish the Import before enabling sync.

The cost is persistent reconciliation state and item-level conflicts instead of a stateless copy job. This supports honest outcomes and prevents silent data loss. The detailed product rules and implementation verification requirements are in [the design brief](../prd/trakt-sync.md).

## List and watchlist extension (2026-10-15)

The operator requested custom List and watchlist sync, including private Trakt
data with an explicit publication warning. Both are independent opt-in types,
off for existing connections. The shared direction and history scope apply.
Watchlist sync is separate from custom Lists; Trakt's automatic watchlist
removals are ordinary source membership removals. Favorites use a separate scope, as defined below.

Retain each destination's visibility. New Opnshelf Lists follow the User's List
default; new Trakt Lists inherit the source visibility. One publication acknowledgement covers all selected types. It includes List
transfers in either direction; existing Watch/Rating consent does not silently
acknowledge newly enabled List transfers. Sync does not silently change a privacy setting. Private
Lists use their reference Spaces repository under the existing account lock;
privacy migrations hold List sync until the move finishes. The accepted Spaces
alpha concurrency limitation in ADR 0048 still applies.

Pair only an unambiguous same-name custom List, and pair the watchlist by its
role. Remember stable record IDs after pairing so renames do not create new
Lists. Reconcile names, descriptions, ordered memberships and item notes. Initial
two-way differences and concurrent edits require a source choice for the List.
One-way transfers preserve destination-only memberships until they become
linked; removals apply only to previously synchronized memberships. Unsupported
media, missing TMDB mappings and length limits remain visible in Needs attention
instead of truncating text or dropping items. Existing destination-only metadata
is preserved. Default Lists cannot be deleted.

A failed or interrupted multi-record transfer is not a cross-service transaction.
Retain its intent and remote creation identity; verify state before retrying.
Partial state that differs from both expected versions requires a source choice
rather than overwriting intervening edits. Complete authoritative reads precede
removal decisions. Local manual order remains a database projection, as in the
existing Lists feature.


## Favorites extension (2026-10-15)

The operator requested Favorites after the List extension merged. Pair the
Opnshelf default Favorites List with Trakt's dedicated Favorites feature by role,
independently of custom Lists and watchlist. Favorites is opt-in and disabled for
existing connections. Reuse List reconciliation, history scope, direction,
conflict recovery, and the single shared publication acknowledgement.

Trakt Favorites supports movies and shows only. Preserve unsupported seasons and
episodes in Needs attention without converting them to parent shows. Read the
account's `limits.favorites.item_count`; capacity failures never truncate data.
Transfers add before removing, so a replacement at capacity needs space freed on
Trakt before retrying. Names and descriptions stay local to default Lists; notes
and order are synchronized. Favorites cannot be deleted as a List.

Private Opnshelf Favorites remain available for inbound sync. Hold private
outbound Favorites in Needs attention until Trakt's effective privacy behavior
is verified; do not assume the public/private account flag proves preservation.
No separate one-time Import is added. See [the investigation](../research/trakt-favorites.md).


## Notes, Library and Reviews extension (2026-10-15)

The operator requested Notes, Library and Reviews as ongoing scopes in the
selected direction. All start disabled for existing connections. Each reuses
stable account-scoped links, history scope, conflict choices, ignore/retry,
pending intents and authoritative readback. These scopes require fresh content
publication consent; the clients retain one shared acknowledgement checkbox.
Saved Watch or List consent alone does not authorize these new transfers.

Standalone media Notes are distinct from List item notes. Pair only an
unambiguous media tuple, preserve destination visibility, and use source privacy
for new Trakt Notes. Multiple Notes for one media tuple, person/List attachments,
Notes with a spoiler flag, and text beyond Opnshelf's limit need attention rather
than merging, dropping flags, or truncating text.

Library sync transfers ownership and supported Format only. Pair by media tuple
and Format. Local Library item notes and Box Sets stay local and survive inbound
updates. Multiple owned Formats cannot be collapsed into Trakt's single
collection entry. Missing/unsupported collection metadata and unrepresentable
video/audio details need attention; never default an unknown Format to Digital.
A different destination Format is not overwritten as an unrelated membership.
Private outbound Library Items are held pending verified Trakt collection privacy.

Sync authored top-level Reviews; short comments and replies are not imported as
Reviews. Short comments remain visible as unsupported source records so a Review
reclassified as a comment cannot look deleted. Match existing unlinked Reviews
only by identical content and spoiler state, with an unambiguous pair. Separate
pieces about the same title remain separate Reviews. Preserve local Review titles;
new imports use the media title as a neutral title. Inline Trakt spoiler markup
sets the whole-Review Spoiler Flag without rewriting the original text.

Trakt classifies text of at least 200 words as a Review and requires English.
Hold shorter outbound Reviews instead of padding or publishing a short comment;
Trakt validation failures remain actionable. Imported Reviews disable blog
mirroring and never create Bluesky Cross-posts. Inbound edits/deletion of existing
Reviews with a Blog Mirror are held to avoid bypassing the managed mirror lifecycle.
Privacy Alpha's accepted reference-Spaces concurrency limit still applies to
private Notes and Library writes; no new atomicity claim is made.
