# Trakt Sync operations and verification

Sync supports public Watches only. A private Shelf or pending Shelf privacy migration holds Watch sync; disabling Watches lets Ratings continue. Sync and legacy Import recovery share the account lock with privacy changes and deletion.

The targeted confirmation routes follow the [official Trakt sync contract](https://github.com/trakt/trakt-api/blob/master/projects/api/src/contracts/sync/index.ts). Rating route suffixes filter values, not item IDs, so confirmation must retain category pagination.

## Server configuration and rollout

Trakt Sync uses the existing `TRAKT_API_KEY` as the OAuth client ID, `BACKEND_PUBLIC_URL` to construct `/trakt-sync/callback`, `FRONTEND_URL` for the Web return route, and `PROVIDER_STATE_SECRET` to encrypt access/refresh tokens and single-use OAuth state. Register the exact callback URL with the Trakt application before enabling the UI against a deployed backend. Mobile returns to `opnshelf://trakt-sync`. A connection started from Onboarding (`returnTo: "onboarding"`) returns to `/onboarding` on Web and `opnshelf://onboarding` on Mobile instead. No Trakt password is collected.

Keep `PROVIDER_STATE_SECRET` stable: changing it makes retained credentials unreadable and requires reconnection. Do not log OAuth codes, tokens, authorization URLs with state, or encrypted credential values. OAuth state expires after ten minutes. Tokens and sync links are server-owned state, never public PDS records.

Apply both `20261005120000_trakt_sync` and `20261005121000_trakt_sync_account_guard` through the normal explicitly approved deployment process. The second migration contains a partial unique index enforcing one connected Trakt account per User. Preserve this SQL constraint in future schema migrations; disconnected accounts retain their separate links. This work has applied migrations only to a disposable local database.

Web and Mobile expose `/trakt-sync` from Settings and optional Onboarding. Mobile changes are JavaScript only and leave the app version unchanged, so the release route is OTA. Neither backend deployment nor Web/Mobile publication has been performed.

## Worker behavior

Incomplete, malformed or failed membership reads hold only the affected custom
List, watchlist or Favorites in Needs attention. The snapshot retains its known
identity with an unreadable marker, rather than treating it as empty or deleted.
Other Lists and record types continue. Saved baselines and pending transfers are
retained; an unreadable List offers Retry instead of choosing a destructive
version. Authentication failures and rate limits still apply to the account.
Returned titles without a TMDB match also appear in Needs attention; they are
never silently dropped from a List. The Web and Mobile site-wide Banners show
errors and unresolved-item notices ahead of comparison/catch-up progress.

On 2026-10-19 a production read found one custom List reporting 13 items in both
metadata and pagination headers, but returning 12 unique items, with rank 6
absent. Filtered and extended reads and Trakt's own Web page exposed the same
12 items; every returned item had a TMDB ID. This confirms an upstream count/read
inconsistency, not a missing-TMDB item dropped by Opnshelf. The absent item's
identity and why Trakt omits it cannot be determined from these responses.

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


## Notes, Library and Reviews

Apply migration `20261015230000_trakt_content_sync` before backend rollout. These
three scopes start disabled. Select them on either client, review the direction,
and accept the one publication acknowledgement. Old Watch/List consent does not
silently acknowledge these content scopes. The original one-time Watch Import is
unchanged. Mobile version is unchanged, so release uses an approved OTA update.

Notes are standalone media Notes, separate from List member notes. Notes over
5,000 characters, spoiler-flagged Notes and unsupported attachments stay in Needs
attention. Existing Note conflicts require a source choice in two-way sync.

Library transfers ownership with a known supported Format. Box Sets and local
item notes remain local. Items missing Format metadata, unsupported audio/video
metadata, multiple owned Formats and conflicting destination Formats stay visible
without guessing or destructive replacement. Private outbound Library Items are
held until Trakt collection privacy is verified. The current official API guide
and response contracts disagree about collection metadata; live-account payload
verification remains a rollout prerequisite for format fidelity.

Only authored top-level Reviews transfer. Replies are excluded. Short comments
are unsupported, and outgoing Reviews must meet Trakt's 200-word and English
rules. No translation, text padding or truncation is performed. Review titles
remain local; imports use the media title. Imported Reviews disable Blog Mirrors
and never create Bluesky Cross-posts. Incoming edits/deletion of an existing Review
with a Blog Mirror are held: manage that Review in Opnshelf or use its version.

All writes are confirmed against authoritative repository/API reads. Failed pages
never imply deletions, and interrupted remote creation retains the returned ID.
If creation may have succeeded but no ID was received, sync checks for a unique,
unchanged matching result before adopting it. Unconfirmed creation offers Check
again without a destructive version choice; it never blindly creates another item.


## Recovery and management UX (October 16)

Repeated Sync requests return the current queued/running/waiting state instead
of rejecting a busy worker. The clients show the state and preserve scheduled
provider backoff. Structured recovery and remote-presence fields distinguish
unconfirmed writes from known missing versions.

Export validation runs before saving a pending content intent. In particular,
Reviews below Trakt's 200-word minimum remain in Opnshelf with an actionable
validation message. Existing invalid pending intents are cleared when validation
proves that export cannot be attempted. Known rejected creations can retry;
network failures retain their uncertain intent. A uniquely matching complete
remote List, Note or Review is adopted after a lost acknowledgement. For Notes
and Reviews, a local edit retains the original intent so the original remote
copy can be linked before applying the edit. Ambiguous results remain unresolved.

Check again never resends an unconfirmed creation. The User can choose a version
after checking Trakt and explicitly confirming the item is missing. The server
rechecks Trakt before accepting that confirmation and rejects it if a possible
copy has appeared. Choosing Opnshelf sends the current version once, even after
a direction change; choosing the missing Trakt version explicitly deletes the
Opnshelf copy. Both clients explain the duplicate risk from a delayed original
request and require a separate confirmation. Local edits preserve uncertain
intents rather than turning Retry into a duplicate creation.

Provider delays show a date and time. Once the delay expires, status is queued;
a stale provider error no longer leaves the connection shown as waiting.
Repeated Sync requests join the running operation rather than requesting an
additional remote read. The manual missing-copy confirmation applies only to
new custom Lists, Notes and Reviews. Watchlist, Favorites, Library, Watch and Rating
updates retain their existing retry behavior. Recovery ignores remote copies
already claimed by another sync entry, so a linked List with the same name
does not block a separate unconfirmed List.

| Flow | Web | Mobile |
| --- | --- | --- |
| Manage sync | Dedicated Trakt Sync page with dialogs | Dedicated screen with native sheets |
| Record choices | Dialog, retaining all eight scopes | Native sheet, retaining all eight scopes |
| Confirm settings or conflict choice | Dialog | Native sheet |
| Ignored items | Separate dialog; Restore item returns it to Needs attention | Separate sheet with Done and Restore item |
| Initial Import | Onboarding dialog | Existing separate onboarding step |

The new Review implementation from PR #494 is preserved. Local persisted tests
cover short Reviews, repair of legacy invalid intents, rejected creation,
interrupted acknowledgements and prevention of missing-version deletion.
Authoritative live Trakt acceptance remains separate; no live provider writes
were performed.

Verification on the publication worktree: `pnpm typecheck`, `pnpm check`,
`pnpm --filter web run test` (511 passed, 1 skipped),
`pnpm --filter mobile run test` (439 passed, 1 skipped), and
`TRAKT_SYNC_TEST_DATABASE_URL=<disposable-local-database> pnpm --filter backend run test --maxWorkers=2`
(1,402 passed, 22 skipped). Also passed `pnpm --filter backend run build`,
`pnpm generate:api`, `pnpm --filter @opnshelf/api exec tsc --noEmit`,
`pnpm test:scripts` (13 passed), and `git diff --check`. Only the optional fixtures
remain skipped; existing Backend lint warnings remain.

Web `/trakt-sync` was inspected on the latest branch with synthetic data,
including separate ignored items and record choices. The default iOS development build from this worktree passed with zero errors.
iPhone 18 Pro / iOS 27.0 verified the eight-scope record-picker sheet and its
Done/Cancel transitions; the installed native fingerprint matches this checkout.
Prior Android and iOS checks covered sync state, safe recovery and modal dismissal. The local iOS cache repair
is documented in [development sessions](development-sessions.md#ios-expomodulesjsi-cache-after-changing-xcode).
Mobile's version is unchanged: publishing uses the OTA route, and no release or
hosted migration was performed.

## Performance pass (October 21)

The worker skips disabled Watch/Rating scopes, selects only the indexed fields
needed for reconciliation, and restricts its pre-transfer local check to the
record kind being transferred. Initial discovery indexes pending intents and
missing linked titles, reuses the already-read entries, and inserts new links in
batches of at most 500. It retains the same pairing and ambiguity rules.

Outbound Watches and Ratings now share one full remote read across at most ten
transfers. Every transfer after the first checks its destination scope again;
a changed scope stops the run and forces a fresh full comparison. Each confirmed
write updates both the persisted snapshot and the current run's collision index.
An uncertain outbound failure stops further transfers in that batch. A batch
also yields after 30 seconds between items; an individual provider operation can
run longer. List/content outbound transfers still yield after one item because a
single item may contain many records. Provider request pacing is unchanged.

List reconciliation indexes memberships and ordering, loads local positions once
per snapshot, and preserves unchanged PDS memberships during metadata edits.
Remote writes resolve only newly added members, share identity lookups within a
transfer, read new Favorite IDs once for all their notes, and skip redundant
reordering. Confirmation of a known custom List reads only that List's
memberships while retaining the before/after metadata checks. Scoped readback
preserves unrelated cached Lists and does not advance full-snapshot freshness.

Status polling omits the saved remote snapshot. Needs attention counts and pages
issues in PostgreSQL before loading repositories; saved mapping payloads are
read separately only when remote records need a title mapping. Update operations
whose result is unused return only the ID rather than complete JSON baselines.

Verification used fake Trakt/PDS transports and a disposable local PostgreSQL 18
database, including ten-item outbound batches, same-minute duplicates,
intervening remote edits, bounded discovery inserts, issue-page clamping, scoped
List reads, unchanged memberships, Favorite notes and required/skipped reorder.
The isolated PR branch retains the existing one-time Import and its tests.
Explicit Import recovery still reads Watch history when ongoing Watch sync is
disabled. The full Backend suite passed: 1,494 tests, 22 optional-fixture tests
skipped.
`pnpm typecheck`, `pnpm check` and `pnpm --filter backend run build` passed;
existing lint warnings remain. No live provider calls or deployment were used.
These are verified reductions in reads/writes, not production timing benchmarks.
Further changes to full-snapshot storage, idle polling or cross-account worker
concurrency need workload measurements and a separate design for consistency.
