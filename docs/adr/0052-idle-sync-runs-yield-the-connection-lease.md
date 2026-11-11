# ADR 0052: Idle sync runs yield the connection lease

Status: Accepted.

Every sync run holds the connection lease from start to finish (ADR 0049, ADR 0051). Pausing, resuming, disconnecting and resolving a Needs attention item need the same lease. On 2026-11-03, production Popfeed users repeatedly got HTTP 409 `SYNC_BUSY` for these requests because the lease was almost never free:

- A successful run always scheduled the next one five seconds later, even when nothing had changed, so an active connection was run every five to ten seconds indefinitely.
- A failed transfer keeps its pending intent so Sync can finish it later. It was retried on every run, and a pending transfer forces a full remote read, so one stuck item caused a full repository read under the lease every few seconds.
- A Popfeed run read the whole repository again for the check before each write, inside the writer and for the confirmation, about three full reads per write.

## Decision

- A run that transferred nothing and left nothing waiting schedules the next run two minutes later. A run that transferred something, or yielded with work remaining, keeps the five-second follow-up. Changes made in Opnshelf or on the service can therefore take up to two minutes longer to sync; the operator accepted that delay. Sync now and resolving an item still schedule a run immediately.
- A failed transfer whose issue is still open is retried automatically once five minutes have passed since it last changed, instead of on every run. Retry in Needs attention clears the issue, so it is attempted on the next run.
- The Popfeed adapter reuses a consistent repository read within one run while the PDS commit revision is unchanged. Every write advances the revision, so a write is still confirmed by a fresh read, and a read whose revision changed while it was taken is never reused.

Clients also retry `SYNC_BUSY` responses for these requests (#695), so a request that still meets a run waits for it instead of failing.

## Considered alternatives

- **Queue User actions** as intents the worker applies between entries, so they never need the lease. Rejected for now: it changes the guarantee that a held lease freezes the connection, which the persisted tests rely on, for a gain the shorter busy window mostly provides.
- **Wait for the lease on the server**: retry the claim inside the request. Rejected: it ties up request handlers for the length of a run, and the clients already retry.
- **Release the lease when the process shuts down.** Not done: the application does not enable Nest shutdown hooks, and releasing a lease while the old process may still be writing during an overlapping deploy would break exclusivity. A stale lease expires within two minutes.

## Consequences

Idle connections cost one short run every two minutes instead of every five seconds, and Popfeed write batches read the repository about once per write instead of three times. A transient failure stays visible in Needs attention for up to five minutes before it heals on its own.

## PDS throttling extension (2026-11-11)

Sync PDS requests share a per-account queue in each server process, including
repository reads, authenticated writes and session restoration. Requests start
at least 1.1 seconds apart. This increases the connection's busy window during
catch-up; the existing batch bounds and lease heartbeat remain in effect.
Protecting the account's repository budget takes priority over catch-up speed.
Multiple server processes would need a shared limiter to enforce one budget.

Rate limits stop queued requests and the entire run. Honor Retry-After as seconds
or an HTTP date, defaulting to five minutes when absent or invalid. The cooldown
also applies to subsequent runs in the same process. OAuth discovery rate limits
and server failures remain temporary failures, not a reason to reconnect.

Unlike an item-specific transfer failure, a temporary PDS outage stops the run
without marking individual items in Needs attention. Keep pending intents and
report the failure on the connection; retry at the provider's requested time,
defaulting to one minute for server failures. The adapters translate these into
typed integration failures; the shared core does not interpret HTTP errors from
an arbitrary service. Other item-specific failures retain the five-minute Needs
attention behavior above.
