# Trakt Sync operations and verification

## Server configuration and rollout

Trakt Sync uses the existing `TRAKT_API_KEY` as the OAuth client ID, `BACKEND_PUBLIC_URL` to construct `/trakt-sync/callback`, `FRONTEND_URL` for the Web return route, and `PROVIDER_STATE_SECRET` to encrypt access/refresh tokens and single-use OAuth state. Register the exact callback URL with the Trakt application before enabling the UI against a deployed backend. Mobile returns to `opnshelf://trakt-sync`. No Trakt password is collected.

Keep `PROVIDER_STATE_SECRET` stable: changing it makes retained credentials unreadable and requires reconnection. Do not log OAuth codes, tokens, authorization URLs with state, or encrypted credential values. OAuth state expires after ten minutes. Tokens and sync links are server-owned state, never public PDS records.

Apply both `20261005120000_trakt_sync` and `20261005121000_trakt_sync_account_guard` through the normal explicitly approved deployment process. The second migration contains a partial unique index enforcing one connected Trakt account per User. Preserve this SQL constraint in future schema migrations; disconnected accounts retain their separate links. This work has applied migrations only to a disposable local database.

Web and Mobile expose `/trakt-sync` from Settings and optional Onboarding. Mobile changes are JavaScript only and leave the app version unchanged, so the release route is OTA. Neither backend deployment nor Web/Mobile publication has been performed.

## Worker behavior

Saving settings queues an initial comparison. The UI reports that comparison is in progress and can be closed. Future changes only begins after that comparison finishes, based on record additions/changes rather than watch dates. Previously linked records remain linked across scope changes, pauses, and reconnection.

A database lease serializes each account's operations, with a two-minute expiry and a thirty-second heartbeat. The worker checks due accounts every five seconds, ordinarily refreshes Trakt at fifteen-minute intervals, and reads fresh remote state before potential outbound changes. Complete pagination and unchanged activity markers are required before using a remote snapshot. An incomplete read never proves deletion. Trakt request pacing and rate-limit responses can delay work.

The first version uses complete snapshots rather than an incremental feed. Large histories can therefore take time to compare. Inbound transfers run in bounded batches of ten; outbound work yields after a write and complete readback. A durable pending intent recovers uncertain acknowledgements. Item errors appear in Needs attention, while other eligible records continue. Last successful check describes a completed reconciliation pass, not a claim that every unresolved item transferred.

A Trakt Watch date edit can replace its event ID. A missing linked event accompanied by a new Watch of the same title is held for confirmation, allowing the User to preserve the original Opnshelf Watch identity. Exact-minute deduplication limits, ambiguous and No date pairs are surfaced rather than changing dates or collapsing rewatches.

Pause retains state. Disconnect freezes work, revokes access, and removes local credentials after successful revocation; transferred records and links remain. If revocation fails, the connection remains paused so the action can be retried. Account deletion revokes access before local deletion and cascades sync state; it leaves exported Trakt records intact. Deletion or controls racing an active worker return a retryable conflict rather than interrupting an external write.

## Local verification

Verified on 2026-10-05 using Node 24 and the repository pnpm version:

- `pnpm typecheck` and `pnpm check`.
- `pnpm --filter backend run test`: full backend suite, including the local database integration suite when `TRAKT_SYNC_TEST_DATABASE_URL` points at the disposable local database. The existing Featured integration suite remains skipped without its own fixture.
- `pnpm --filter web run test` and `pnpm --filter mobile run test`; existing optional performance suites remain skipped.
- `pnpm --filter backend run build`.
- `pnpm generate:api` and `pnpm --filter @opnshelf/api exec tsc --noEmit`. Semantic comparison of OpenAPI output shows only the new sync paths/schemas and the added Import status; existing endpoints are unchanged. `git diff --check` reports four trailing-whitespace lines in new Prisma-generated model comments; authored-file whitespace checks pass, and generated output was not hand-edited.
- Focused Trakt tests cover initial comparison, scope, concurrent edits, uncertain writes, PDS compare-and-swap, stable restoration identity, pagination failures, No date encoding, matching, ignore/undo, reconnection, account exclusivity/deletion, permanent Import retirement, and recovery after a legacy write whose link was not saved.
- Web `/trakt-sync` inspected at 1280 × 800 and 390 × 844 using a local API fixture. Publication acknowledgement, review/save, Rating source confirmation, and Watch-pair confirmation were exercised. The phone-width inspection caught and fixed conflict-button wrapping. The Settings → Keep in sync link was also exercised.
- iOS `/trakt-sync` inspected on an isolated iPhone 18 Pro simulator running iOS 27 with the current development client and local API fixture. Connection controls, native switches, scope/direction selection, review/save, and Needs attention were inspected, including the Watch-pair confirmation. Android was not exercised.

The fixture verifies client rendering and interaction; it does not prove live OAuth or live provider behavior. The database tests use real local PostgreSQL with fake Trakt/PDS transports. The transport tests check request/response semantics and failure handling without contacting either live service.

## Controlled live acceptance still required

Before rollout, use an explicitly authorized test account to verify PKCE authorization, refresh rotation and revocation, movie and episode repeat history, all four Rating levels, and both one-way directions plus two-way sync. Verify `watched_at: "unknown"` readback and Trakt's actual minute-level deduplication. The current API specification and Trakt's 2026 history announcement contain conflicting deduplication wording; automated local tests cannot resolve that discrepancy. Readback failures remain unresolved instead of being counted as success.

Trakt has no conditional write primitive in this integration. Fresh reads detect intervening edits up to the pre-write comparison; a concurrent edit in the gap between that read and the remote write cannot be made atomic. Do not promise cross-service transactional behavior. No controlled live writes, hosted migrations, deploys, or releases were performed for this implementation.
