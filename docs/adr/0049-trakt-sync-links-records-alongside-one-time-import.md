# ADR 0049: Trakt Sync links records alongside one-time Import

Status: Accepted; implemented in the #260 working branch, pending deployment. Extends ADR 0020 with ongoing sync while retaining its one-time Import and existing outcome-retention guarantees.

Issue #260 adds optional server-managed Trakt Sync for Watches and Ratings, selectable in either direction or both. Keep Import once available separately and retain existing Import results and Unmatched-item reconciliation. Repeatedly restarting the lifetime Import was rejected: its media-and-date identity cannot reliably follow edits, deletions, or changes from both services.

Sync needs account-scoped links between individual records and a remembered synchronized state, retained through disconnection until Opnshelf account deletion. Propagate edits and removals only for linked records, preserve unrelated destination data, and prevent echo writes. Include public records changed by other AT Protocol clients. Preserve Opnshelf Watch identity when dates change, as required by ADR 0042. Conflicting changes in two-way sync require resolution rather than guessing from timestamps that may reflect ingestion or historical rating dates. Account deletion removes the local sync state and access, not records already exported to Trakt.

Trakt's representational limits must not silently alter Opnshelf history. Link initial Watches only when a same-media, same-minute match is unambiguous and one-to-one. Preserve local timestamps and rewatch counts; report unrepresentable duplicates rather than inventing dates. No date Watches stay without dates.

The first version uses public Watches and Ratings, with explicit publication acknowledgement before importing private Trakt history. ADR 0048 now provides private Shelf storage. This first sync version still handles public Watches only: hold Watch transfers while the Shelf is private or changing privacy, and share the existing account lock with migration and deletion. Users can disable Watch sync and continue syncing public Ratings. Setup and management have parity in Web and Mobile.

An unfinished Import may permanently hand control to sync after its in-flight work finishes. Its Continued in Trakt Sync status preserves real historical progress and outcomes without claiming completion; the old Import cannot resume, even after sync disconnects. Matching and retries remain available through sync bookkeeping. A pause alone was rejected because it leaves the old importer resumable and able to compete with sync. Users can instead finish the Import before enabling sync.

The cost is persistent reconciliation state and item-level conflicts instead of a stateless copy job. This supports honest outcomes and prevents silent data loss. The detailed product rules and implementation verification requirements are in [the design brief](../prd/trakt-sync.md).
