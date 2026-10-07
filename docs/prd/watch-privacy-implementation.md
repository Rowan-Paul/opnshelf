# Watch privacy implementation

Status: runtime integration and Web/Mobile controls implemented and locally
verified; production rollout pending. Builds on
issue #252, PR #449 and [ADR 0046](../adr/0046-privacy-is-chosen-by-data-category.md).

## Boundaries

Public is the default. Settings retain the separately agreed always-private
boundary. Movie and episode Watches share one visibility choice; Reviews,
Ratings and independent Lists are not implicitly changed by that choice.

The private destination is `at://<owner>/space/xyz.opnshelf.watches/self`, with
`xyz.opnshelf.movie` and `xyz.opnshelf.episode` collections and their original
record keys and complete record values. This keeps Watch identity and extension
fields intact. The new optional OAuth scope is not in Core sign-in or the
existing Private Settings grant. Every authenticated request uses the OAuth
session's DPoP-aware fetch handler. Unsupported PDSs fail closed.

## Migration core

Public → Private copies using create-only writes, reads back and checks the
record CID, and commits the complete verified record to `WatchPrivacyCopy`
before deleting the public source with an atomic `swapRecord` precondition.
The journal is scoped to an owner and a single `watch_privacy` background job.
A conflicting destination or changed source is an explicit conflict; neither
is overwritten. A timeout can be retried at every step. A missing source is
considered moved only if a committed journal snapshot and matching private
record exist. Completion checks the source is absent and the destination matches.

Full snapshots are temporary migration recovery state, not a permanent private
backup. They are necessary because the two repositories cannot commit atomically.
The worker retains the journal until whole-account verification and
local-index reconciliation have committed. The database restricts deletion of
a job with snapshots; the verified finalizer must explicitly remove snapshots
before job cleanup. Delete the snapshots in the same database transaction that
commits successful final visibility and index reconciliation. Failed jobs retain
them for explicit recovery; they must never expire through generic job cleanup. Cancelled or completed jobs cannot accept new snapshots: insertion locks the job row and checks its running state in the same transaction as the insert. A missing private copy with a saved
snapshot requires explicit recovery; the mover never silently recreates it.

Both policies must be member-list policies with no other members. Recheck before
source deletion. The PDS owner can independently change policies or authorize
other apps; application checks cannot make a cross-repository transaction atomic.

**Private → Public requires conditional private deletion.** The operator chose
this on 2026-10-07 over retaining a permanent private recovery copy. The new
Tranquil change (worktree `tranquil-pds-watch-privacy`, not deployed) implements
`swapRecord` on Spaces deletion and advertises
`tranquilSpaceCapabilities: ["deleteRecord.swapRecord.v1"]` in `describeServer`.
Opnshelf checks this exact capability before publishing a private Watch and
again before deleting its private source. Older PDS versions fail closed.
This is an explicit Tranquil extension; it is not assumed to be a standard
Spaces feature. The reverse mover uses the same copy/verify/journal/CAS sequence,
with a separate migration job and create-only public writes. It never retries
an unconditional deletion. A changed private source raises a recoverable
conflict; publishing the copied snapshot cannot be undone across federation.
The UI must explain this before the user confirms publication.

## Coordinator boundary

`WatchPrivacyCoordinator` serializes operations with a PostgreSQL session advisory
lock on a dedicated checked-out connection. Its pool must remain separate from
the Prisma query pool and be closed with the application. Contention fails promptly rather than exhausting the shared connection
pool. New accounts default to Public. Start creates a queued job and an immutable
migration row atomically, rejects active imports/deletion, requires publication
confirmation for a Public target, and returns the same job for duplicate starts.
A different target is rejected until the existing migration finishes.

Pending and failed migrations block interactive writes through this boundary.
A worker batch commits running state and recovery snapshots independently of
its outer database transaction: a later PDS failure cannot roll back the only recovery
copy. Failure retains direction and snapshots for retry. A crashed running job can
resume after its database lock is released. Finalization takes the same lock and
commits local reconciliation, visibility, journal cleanup and completion together;
a reconciliation failure leaves all recovery state intact.

The registered API and worker perform whole-account PDS verification before
finalization. Network verification holds the account lock without opening the
short final reconciliation transaction. A bounded
batch uses a 120-second database transaction, with each PDS request limited to
10 seconds. The independent session lock remains held until the callback settles,
even if Prisma expires the transaction. The transaction deadline aborts the operation signal, stopping further PDS
requests; the lock remains held until in-flight work settles. An expired
transaction cannot commit the batch back to queued. Account deletion first stops the migration under this same
lock, retaining snapshots until local deletion commits. If deletion fails or is
abandoned, explicit migration retry resumes the stopped job only when no active
account-deletion job remains. The application must
budget a small dedicated lock pool alongside its existing database connections.
Lock-connection loss aborts the signal passed to the operation; construct the PDS
transport with that signal. No caller may continue writing after a lock conflict
or transaction failure. Public-read filtering and routing every writer through this
boundary are required before any migration can be started by a user.

## Runtime integration and verification gates

- Account-wide durable migration status, explicit publication consent, progress,
  retry, and a single active migration; refuse reversing direction mid-migration.
- Wire the implemented direction-bound journal and read-only reverse Space
  validation into the worker. `WatchPrivacyMigration` stores immutable source
  and target visibility and has a unique owner; journal access validates its
  direction before any PDS write. Reverse validation refuses missing or deleted
  Spaces without creating them.
- Serialize the start against all interactive Watch writes, date corrections,
  bulk writes, imports and deletion jobs; pause those paths while migrating.
  Persisted pending/failed migrations remain hidden from public readers.
- Wire `WatchPrivacyCoordinator.deleteLocalAccount` into both account-deletion
  paths. It removes every Watch snapshot, active migration and Watch job in the
  same transaction as the local account. The migration's restrictive foreign key
  prevents accidental account deletion until that cleanup is integrated. Stop
  in-flight migration work with the same account lock before PDS account deletion.
- Local projection reconciles the same Watch identity before public source
  deletion. Tab public deletes must not erase the private projection; delayed
  public creates must not republish it. Private writes need a private sync path
  because Tab does not carry them.
- Inventory all public sources again when wiring controls, including raw SQL and
  cached/derived reads below. Never enable a preference before these are guarded.
- Treat `missing` results as skipped/deleted source records, not moved records;
  account-wide reconciliation must still inspect any leftover destination records.
- Verify on disposable PostgreSQL/PDS with the owner, a second account and a
  signed-out client before separately authorized production rollout.

## Reader and writer inventory

| Surface | Code boundary | Required behavior |
| --- | --- | --- |
| Movie and episode logging, bulk logging, correction, deletion | `movies.service`, `episode-watch.service`, `update-watch-date` | Route to selected repository; preserve identities; block during migration |
| Trakt imports and account deletion | `watch-import-writer.service`, `user-deletion.service` | Coordinate with the same migration lock and repository choice |
| Tab indexing | `ingester.service` | Ignore stale public events for private/migrating Watches; retain private index |
| Shelf, activity graph, sync counts | `shelf.service` and controller | Owner-only while private or migrating, including raw SQL |
| Profile totals and statistics | `users.service` | Hide private derived values from other viewers |
| History, progress, Up Next, calendar | movie/show controllers and `show-progress.service` | Preserve owner access; exclude private data from public routes |
| Activity Feed and followed watchers | `activity-feed.service` | Filter before pagination/counting and in raw SQL |
| Discover from follows and people ordering | `discover.service`, `social-users.service` | Do not leak private activity or rank people by private counts |
| Lists, Pick for me, recaps and notifications | `lists.service`, `watch-picker.service`, `notification-worker.service` | Audit viewer scope and cached projections; owner-only derived data stays owner-only |
| Web and Mobile Settings/profile | both clients | Matching controls, confirmation, recoverable progress, cache invalidation; no native version bump expected |

The API, worker and matching Web/Mobile controls are registered. Accounts that
have changed privacy use authoritative repository sync thereafter, including
when Public, as recorded in [ADR 0047](../adr/0047-watch-privacy-uses-authoritative-repository-sync.md).
Production rollout still requires the companion PDS capability and separate
operator authorization. Local end-to-end verification is a release gate.

## Local verification (2026-10-07)

Against the real disposable Tranquil PDS with OAuth/DPoP: connected Watch access,
changed Public → Private, created a private movie Watch, corrected its date using
Spaces applyWrites, migrated Private → Public → Private while retaining its rkey
and local identity, and deleted it privately. Manual sync succeeded. Signed-out
Shelf access returned 403 and profile output reported `watchesPublic: false`.
The test record was removed and the local account returned to Public.

The local stack has no TMDB API key; one catalogue row was seeded for the test,
while all Watch records and migrations used the real PDS. This verifies the
privacy protocol and does not claim to verify local TMDB discovery. Web Settings
was inspected in the shared browser and Mobile Preferences on the iOS simulator.
PostgreSQL integration tests cover recovery after a failed conditional deletion,
full record preservation and owner-qualified read predicates.
