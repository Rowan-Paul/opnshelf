# Trakt Sync operations and verification

Sync supports public Watches only. A private Shelf or pending Shelf privacy migration holds Watch sync; disabling Watches lets Ratings continue. Sync and legacy Import recovery share the account lock with privacy changes and deletion.

The targeted confirmation routes follow the [official Trakt sync contract](https://github.com/trakt/trakt-api/blob/master/projects/api/src/contracts/sync/index.ts). Rating route suffixes filter values, not item IDs, so confirmation must retain category pagination.

## Server configuration and rollout

Trakt Sync uses the existing `TRAKT_API_KEY` as the OAuth client ID, `BACKEND_PUBLIC_URL` to construct `/trakt-sync/callback`, `FRONTEND_URL` for the Web return route, and `PROVIDER_STATE_SECRET` to encrypt access/refresh tokens and single-use OAuth state. Register the exact callback URL with the Trakt application before enabling the UI against a deployed backend. Mobile returns to `opnshelf://trakt-sync`. A connection started from Onboarding (`returnTo: "onboarding"`) returns to `/onboarding` on Web and `opnshelf://onboarding` on Mobile instead. No Trakt password is collected.

Keep `PROVIDER_STATE_SECRET` stable: changing it makes retained credentials unreadable and requires reconnection. Do not log OAuth codes, tokens, authorization URLs with state, or encrypted credential values. OAuth state expires after ten minutes. Tokens and sync links are server-owned state, never public PDS records.

Apply both `20261005120000_trakt_sync` and `20261005121000_trakt_sync_account_guard` through the normal explicitly approved deployment process. The second migration contains a partial unique index enforcing one connected Trakt account per User. Preserve this SQL constraint in future schema migrations; disconnected accounts retain their separate links. This work has applied migrations only to a disposable local database.

Web and Mobile expose `/trakt-sync` from Settings and optional Onboarding. Mobile changes are JavaScript only and leave the app version unchanged, so the release route is OTA. Neither backend deployment nor Web/Mobile publication has been performed.

## Worker behavior

Saving settings queues an initial comparison. The UI reports that comparison is in progress and can be closed. Future changes only begins after that comparison finishes, based on record additions/changes rather than watch dates. Previously linked records remain linked across scope changes, pauses, and reconnection.

A database lease serializes each account's operations, with a two-minute expiry and a thirty-second heartbeat. The worker checks due accounts every five seconds, ordinarily refreshes Trakt at fifteen-minute intervals, and reads fresh remote state before potential outbound changes. Complete pagination and unchanged activity markers are required before using a remote snapshot. An incomplete read never proves deletion. Trakt request pacing and rate-limit responses can delay work.

The first version uses complete snapshots rather than an incremental feed. Large histories can therefore take time to compare. Inbound transfers run in bounded batches of ten; outbound work yields after a write and scoped readback. Watch confirmation pages only the affected movie or episode history; Rating confirmation pages only its media category. The full pre-write snapshot is retained, so large outbound backlogs still scale with total history size. Scoped reads preserve unrelated cached records and do not advance the full-snapshot freshness timestamp. Request pacing is separated by access-token identity (hashed in memory). A durable pending intent recovers uncertain acknowledgements. Item errors appear in Needs attention, while other eligible records continue. When a run yields with records still waiting, it stores that count and the largest backlog since sync last caught up; the status endpoint reports them as `remaining` and `progress`, which drive the site-wide Banner on both clients. Last successful check describes a completed reconciliation pass, not a claim that every unresolved item transferred.

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

## CodeRabbit follow-up verification (October 8)

- `pnpm typecheck`, `pnpm check`, and `pnpm --filter backend run build` passed. Existing upstream privacy lint warnings remain.
- Full test suites passed: Backend 1,301 (including 26 persisted Trakt cases on disposable PostgreSQL), Web 437, Mobile 382. Optional integration/performance tests remain skipped.
- Web `/trakt-sync?connection=failed` verified in the browser at 1280 × 800 with a fixture API: the callback error appears within the connection panel. Mobile uses the same message for callback deep links and auth-session results; the iOS recheck was blocked because the simulator belongs to another active session.
- OAuth failure redirects, expired/reused state, best-effort revocation, movie/show ID collisions, scoped snapshot preservation, empty responses, and per-account request pacing have regression coverage. Live Trakt/PDS acceptance remains outstanding.

## List and watchlist extension (October 15)

Custom Lists and watchlist are independent opt-in switches, off for existing
connections. They use the same direction, history scope, pause/resume and
account-scoped links as Watches and Ratings. Custom List names, descriptions,
notes, memberships and manual order transfer; watchlist sync transfers membership,
notes and manual order. Trakt's automatic removals after watching are source
membership removals. Favorites remain outside these switches.

Existing destination visibility stays unchanged. New Opnshelf Lists follow the
User's List default; new Trakt Lists inherit source visibility. One publication checkbox covers the selected types, including Lists and
watchlist. When List transfers are newly enabled, that same checkbox includes
their publication warning. Private Opnshelf Lists are read and written through their own reference
Space, with the existing account lock and migration hold. Only enabled private
List types are accessed. Unsupported metadata representations and missing TMDB
mappings become Needs attention; text is never truncated to fit another service.

Initial one-way transfers merge destination-only memberships, and subsequent
removals affect previously synchronized source memberships. Two-way differences
require a List-level source choice. Stable IDs retain pairing across renames.
Interrupted creation retains its record identity; incomplete or changed reads do
not establish deletion. A partial transfer changed outside its expected state
requires a source choice. Trakt writes and reference private writes retain the
concurrency limitations described above and in ADR 0048.

Apply `20261015140000_trakt_list_sync` through the approved deployment process
before enabling these controls against a deployed backend. It adds three Boolean
columns with false defaults. It has been applied only to a disposable local
PostgreSQL container for this change. The Mobile version is unchanged; this change
uses the OTA release route. No hosted migration, deployment, release or live Trakt
or PDS write was performed.

Local verification on 2026-10-15:

- `pnpm prisma:generate` and `pnpm generate:api`; reviewed the Boolean settings and
  status additions in OpenAPI and the generated client.
- `pnpm typecheck`, `pnpm check`, `pnpm --filter @opnshelf/api exec tsc --noEmit`,
  `pnpm --filter backend run build`, and `pnpm test:scripts`.
- Full suites: Backend 1,347 passed, including 34 persisted reconciliation tests
  against disposable PostgreSQL; Web 483 passed; Mobile 415 passed. Optional
  unrelated integration/performance fixtures remain skipped. One database test
  exceeded its five-second timeout during simultaneous workspace builds/tests;
  the complete Backend suite passed when rerun without that load.
- List transport tests cover private metadata, notes, ordering, incomplete and
  changed reads, unsupported media, legacy scoped show identities, size limits, destination changes and retained
  remote creation identity. PDS fixtures exercise public and reference-Space
  writes, selected-type reads, recovery, conflict checks and extension preservation.
- Web `/trakt-sync` at `http://127.0.0.1:3390/trakt-sync`, using the
  `trakt-sync-lists` fixture: four record switches, List scope copy, single combined
  publication acknowledgement, disabled confirmation before consent. The T3
  browser snapshot timed out twice, so verification used local Playwright/Chrome.
- Android 17 / Pixel 10, `opnshelf://trakt-sync`: verified the original List
  switches and confirmation sheet using this checkout's development client, with
  its native fingerprint checked. The later single-checkbox revision passed
  Mobile component tests; its native visual recheck was blocked because both
  Android and iOS were held by other automation sessions. Web visual verification
  confirmed exactly one publication checkbox for that revision.


Changed source areas: Trakt reconciliation and its local/remote List adapters;
connection schema and migration; shared API DTOs, generated types and copy; Web
and Mobile Settings/Onboarding and consent tests; the local UI scenario runner;
GLOSSARY, ADR 0049 and the Trakt product briefs. Controlled live-service round trips
remain a rollout acceptance check, especially Trakt account limits, VIP-only
notes and unsupported media. Failures remain unresolved instead of claiming a
successful transfer.

The disposable database container, fixture servers and owned device session were
stopped after verification. Local screenshots are available at
`/tmp/opnshelf-list-web-settings.png`, `/tmp/opnshelf-list-web-consent.png` and
`/tmp/opnshelf-list-android-consent.png`.


## Favorites

Apply migration `20261015210000_trakt_favorites_sync` before the backend rollout.
Favorites starts disabled for existing connections. Select Favorites on either
client to pair the built-in Lists by role; custom Lists named Favorites remain
custom Lists. The existing direction, history scope, and publication confirmation
apply. This does not change the Watch-history-only one-time Import.

Trakt supports favorite movies and shows, with an account-specific item limit.
Seasons, episodes, unmapped titles, oversized notes, and capacity failures stay
in Needs attention. No items are truncated or promoted to parent shows. A transfer
that would temporarily exceed capacity while adding before removing needs space
freed on Trakt first. Private outbound Favorites is held until Trakt privacy is
verified; inbound sync preserves the Opnshelf destination's List privacy setting.
Mobile version is unchanged: release through an approved OTA update.
