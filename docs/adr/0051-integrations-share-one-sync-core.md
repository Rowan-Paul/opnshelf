# ADR 0051: Integrations share one sync core

Status: Accepted.

Opnshelf will connect to several services that hold the same kinds of records: Trakt today, Popfeed next ([#29](https://github.com/Rowan-Paul/opnshelf/issues/29)), and Bingers and others after that. The operator chose one standardized integration model over a module per service.

Every integration runs on one shared sync core. The core owns everything ADR 0049 defines for Trakt Sync: the connection and its chosen direction, per-type switches and history scope, account-scoped record links with the last synchronized state, change queueing and echo suppression, conflict detection and resolution, Needs attention with Ignore and undo, pause, disconnect and account-deletion cleanup. Its rules apply to every integration unless an integration's design brief records a deviation.

Each service is an adapter. An adapter declares which record types it supports in which direction, reads and writes the remote side, maps remote records to and from Opnshelf records, and reports what it cannot represent. An unrepresentable record becomes a Needs attention item, never a silent drop or an invented value. Adapters do not decide conflicts or delete unlinked records; the core does.

Trakt Sync is extracted onto the core first, with no behavior change, before a second adapter is added. Its existing tests are the acceptance bar for the extraction.

Clients present integrations together in an Integrations settings section on Web and Mobile, with one management page and one Needs attention list per integration under shared URL shapes (ADR 0023).

Integrations whose records live in the User's own AT Protocol repository, such as Popfeed, read through Tab and write through the User's PDS. Writing another ecosystem's collection is External Integration Access under ADR 0030 and is requested only when the User enables an outbound direction.

## Considered alternatives

- **A separate module per service**, copying Trakt Sync. Rejected: link state, conflict rules and Needs attention would drift between services, and each new integration would repeat the hardest part of ADR 0049.
- **Display-only for AT Protocol integrations**: render Popfeed records directly without linked Opnshelf records. Rejected: every Opnshelf surface reads Opnshelf records, so it would need a second read path everywhere, and it cannot respect a User's privacy choices because the originals stay public.

## Consequences

The extraction touches the largest backend module before any user-visible gain. In return, a later integration is an adapter plus its mapping brief. A User may connect several integrations that cover the same records; each has its own links, and a record transferred by one integration is an ordinary Opnshelf change to the others.

## Shared request limiting (2026-11-11)

The operator requested the same rate-limiting behavior for every integration.
All adapters use one request-limiter implementation for serialized pacing,
rolling budgets, queued-request cancellation on throttling, and cooldowns.
Policies supply the provider name, interval, fallback retry delay and budget
windows. PDS adapters additionally supply the cost of each repository operation.
The PDS account budget is shared across integrations writing that account.

Retry-After (seconds or HTTP date), RateLimit-Reset and exhausted remaining
headers have the same meaning for every adapter. The shared parser also supports
Trakt's X-Ratelimit JSON metadata. Provider-specific payload validation, error
diagnostics and credentials remain in their adapters; the shared core handles
only typed integration failures.

While a connection holds its lease, its external account ID scopes requests,
including token refresh, so token rotation cannot reset its budget or cooldown.
During a connect callback, the verified authorization state scopes token exchange,
profile fetch and cleanup to that User. Outside these operations, credential
fingerprints or a separate app OAuth scope provide the fallback key; raw
credentials are never limiter keys.

Current policies retain a conservative 1.1-second request interval. Trakt adds
its standard 500-request five-minute budget; Bingers adds its 60-request minute
and 1,000-request hour budgets. PDS write allowances remain as described in
ADR 0052. Limits are per server process; multiple workers need shared state.

Short advertised reset windows that fit inside the configured request interval
wait within normal pacing instead of yielding a whole run. Longer cooldowns yield
immediately. Reading an existing cooldown never extends its absolute deadline.
Reset headers support contemporary epoch timestamps and delta-seconds; an
explicitly elapsed reset uses the minimum delay, not the full fallback interval.

The shorter Trakt and Bingers request-budget windows provide a guard if interval
policies change; the current conservative pacing normally stays below them.
Successful responses without a parseable reset do not invoke the 429 fallback.
