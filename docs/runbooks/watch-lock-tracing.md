# Trace an account lock conflict

Backend runtime logs contain JSON `account_lock.*` events from the shared account-lock logger.
They cover interactive Watch writes, integration snapshots and transfers, content
polling and migrations, account deletion, and permission changes. No lock semantics change.

1. Find the failed request using the PostHog event's `request_id`. Its lock events
   use the same value as `requestId`.
2. Copy `accountHash` from the failed acquisition. Search all backend replicas'
   logs for that hash around the event's `timestamp`; do not limit the search to
   the failed request's replica. Start earlier if an acquisition is missing.
3. Find `account_lock.acquired` events from before the failure whose matching
   `account_lock.released` occurs after the failure or has not been observed.
   Match events by `lockId` and `namespace`. A holder may still be running;
   inspect `discarded` and `transaction_failed` separately, since neither
   confirms release. The `operation` identifies the holder, for example `trakt.snapshot`,
   `trakt.transfer.pull`, or `ShowsController.markWatched`.

Namespace 252 is the privacy/deletion barrier. An exclusive holder blocks shared
and exclusive acquisitions; shared holders block exclusive acquisitions. Namespace
253 serializes Watch writes, and 254 serializes content background writes. A
shared integration operation can release its write mutex while retaining the
privacy barrier, so follow each namespace separately.

`acquiring` precedes the database call; `acquired` confirms ownership.
`busy` means a nonblocking acquisition was rejected. `acquisition_failed` means
the database call failed, including a bounded wait timing out; it does not prove
ownership. `discarded` means the connection was invalidated, not that an unlock
was confirmed. `admission_busy`, `queue_full` and `connection_failed` describe
capacity failures before account lock acquisition. Permission changes use a
transaction lock: `released` is logged after successful transaction completion;
`transaction_failed` means the transaction rejected and its outcome may require
checking, so it is not reported as a confirmed release. `connection_invalidated`
marks an unusable session, including an acquisition with an unknown outcome.
`finished` marks the end of an invocation after cleanup on a healthy connection;
it does not mean the business operation succeeded.

`lockId` identifies one invocation across its barrier and scoped writes.
`elapsedMs` measures time since that invocation began. `accountHash` is the
SHA-256 of the DID, a stable pseudonym rather than anonymization: an operator
with a known DID can compute its hash. Record content is not logged. HTTP operations carry `requestId`; background operations have null.
Logs contain no request bodies, credentials, record identifiers or upstream
error messages. These events are available only after deploying this change.
