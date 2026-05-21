# ADR 0001: Review Likes via ATProto

We chose to store review likes as ATProto records (custom lexicon `xyz.opnshelf.review.like`) rather than a simple PostgreSQL join table.

The obvious choice was a local-only `ReviewLike` table. It's simpler, faster to query, and doesn't require PDS writes or firehose ingestion. But all user-generated content in this codebase — Review, Follow, List, Note, Episode, Movie — is dual-stored in PostgreSQL and ATProto, synced via the TAP firehose ingester. Likes are user-generated content too. Making them an exception would break the architectural consistency of the system.

Storing likes in ATProto means they travel with the user's PDS. If other opnshelf instances or ATProto-aware tools emerge, likes are portable. The cost is a new lexicon, PDS write/delete operations, and ingester wiring — but that cost is already amortized by the existing infrastructure. The alternative (local-only likes) would have been cheaper initially but would have created a permanent exception in an otherwise uniform architecture.
