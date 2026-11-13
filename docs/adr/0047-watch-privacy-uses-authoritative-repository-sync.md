# ADR 0047: Watch privacy uses authoritative repository sync

Update: [ADR 0048](0048-privacy-alpha-uses-reference-spaces.md) supersedes the
Settings experiment and conditional-private-deletion release requirements.
The text below records the earlier decision.

Status: partially superseded by ADR 0048; see its Privacy Alpha decisions.
The remaining category boundaries and authoritative-sync design still apply.

Once an account starts its first Watch Privacy Migration, Opnshelf reads its
Watch projection directly from its selected repository, including after returning
to Public. Tab can deliver delayed public creates and deletes from before or
during a migration; switching back to Tab would let those events overwrite a
verified projection. Accounts that have never changed Watch privacy continue to
use Tab. A locked User row makes the handover atomic with public ingestion.

Direct sync trades immediate external-event updates for correctness across
repository changes. A background worker attempts eligible accounts at intervals
of at least 60 seconds; Settings also offers manual sync. Each migration batch
allows another account's sync to run. Private accounts without Watch access wait
for reconnection, while their visibility remains Private. Successful sync time
is separate from attempt time and errors.

Locking update for #736 (2026-11-11): interactive writes, background work,
migration and account deletion retain a PostgreSQL session advisory barrier
(namespace 252). Watch writes take it shared and serialize on the Watch mutex
(253). Watch privacy migration and account deletion take the barrier exclusively.
Content privacy background jobs take it shared with a separate content mutex
(254), so Library, Notes and List polling or migration cannot block Watch writes.
Interactive content writes still take the exclusive barrier, excluding content
background reconciliation. Content jobs remain serialized with each other.

Watch polling holds the shared barrier throughout remote reads and catalogue
preparation, but takes the Watch mutex only to capture the local fingerprint
and later index/reconcile. Before applying the repository snapshot, it compares
that fingerprint again under the mutex. Every shared Watch write-mutex
acquisition also advances a durable per-account generation before its callback,
including scoped reads. Sync allows only its own final acquisition between
capture and reconciliation. Other acquisitions discard the stale snapshot,
even if a Watch was created and deleted and the rows match again. The row
fingerprint remains a second check on local projection changes. Manual sync
also yields promptly; background polling retries at its existing interval of
at least 60 seconds. Continuous Watch changes may postpone a successful sync.

The dedicated two-connection lock pool remains separate from Prisma's pool.
Remote-phase operations share a process-local admission limit of at most
`pool.max - 1` checked-out connections, reserving one connection for foreground
work. Admission is released on both connection and callback failures.
Interactive Watch writes wait up to five seconds per lock acquisition; background
work fails promptly on contention. Pool waits are bounded to five seconds and
16 queued requests; exhausted capacity returns a retryable service-busy response.
Network verification runs before the short final database transaction, which
commits visibility, local reconciliation and recovery cleanup together.

Both migration directions require the PDS capability
`deleteRecord.swapRecord.v1`, so an account cannot enter a private repository it
cannot safely leave. The companion Tranquil change must be deployed before
production use. No flag bypasses this safety check.

An explicit Watch-access disconnect requires Public Watches. Declining consent
during sign-in may still remove the effective grant: Opnshelf cannot require a
user to grant permission. That leaves Private Watches private and asks the owner
to reconnect before private edits or sync.
