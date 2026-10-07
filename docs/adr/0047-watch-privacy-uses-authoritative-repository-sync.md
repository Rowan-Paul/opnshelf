# ADR 0047: Watch privacy uses authoritative repository sync

Status: accepted implementation decision for ADR 0046; production rollout pending.

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

Interactive writes, migration and account deletion share a PostgreSQL session
advisory lock. The dedicated two-connection lock pool is budgeted alongside
Prisma's pool; same-account contention fails promptly. Other accounts can wait up to five
seconds for a pool connection, with at most 16 queued requests; exhausted
capacity returns a retryable service-busy response and background imports retry. Network
verification runs before the short final database transaction. That transaction
commits visibility, local reconciliation and recovery cleanup together.

Both migration directions require the PDS capability
`deleteRecord.swapRecord.v1`, so an account cannot enter a private repository it
cannot safely leave. The companion Tranquil change must be deployed before
production use. No flag bypasses this safety check.

An explicit Watch-access disconnect requires Public Watches. Declining consent
during sign-in may still remove the effective grant: Opnshelf cannot require a
user to grant permission. That leaves Private Watches private and asks the owner
to reconnect before private edits or sync.
