# ADR 0041: Redis caches TMDB reads across restarts

Status: accepted, not yet implemented.

## Context

Every live TMDB read goes through one wrapper, `TmdbHttpClient` in
`backend/src/tmdb/tmdb-http.ts`. It already caches idempotent GETs in process
memory: 2000 entries, a 10 minute default TTL, and coalescing of duplicate
in-flight requests. That cache is per process. It is empty after every deploy,
restart and crash, and on Staging after every sleep. Watch-provider reads did
not use it at all.

Issue #67 asked for a Redis cache in June 2026 and was closed as not planned:
the in-memory cache covered the hot paths, and there was no measured driver.
Its trigger to revisit was a second backend replica or measured TMDB 429s or
latency. ADR 0025 takes the same single-replica stance for rate limiting.

The "On my services" filter on **Up Next** (issue #168) changes the cost
picture. Filtering a queue means one availability read per show and per
season for every show in the queue, so a single page view can fan out to
dozens of TMDB calls. With a per-process cache that whole fan-out repeats
after every deploy for every user who opens the filter, and Staging repeats it
after every wake. Availability changes slowly, so most of those calls fetch
data we already had a moment ago.

## Decision

Add a Redis service to the `opnshelf` Railway project and make it the store
behind `TmdbHttpClient`'s cached reads, keyed by request URL with a TTL chosen
per endpoint: 24 hours for movie, show, season and availability details, one
hour for search, discover and trending. The in-flight coalescing stays in
process. The cache fails open: when Redis is unreachable the wrapper logs a
warning and calls TMDB directly, so the backend keeps working exactly as it did
without a cache. Redis is optional locally and on Staging for the same reason.

The durable cache was chosen over keeping availability in the in-memory cache
because surviving restarts is the point: the expensive operation is the fan-out,
and a cache that forgets on every deploy pays it again each time. It was chosen
over a Postgres availability table because a generic cache in the one wrapper
is a smaller change than a bespoke table and speeds up every other TMDB read
as well.

## Consequences

- One more Railway service to run and pay for, in production and Staging.
- The reasoning in issue #67 is superseded by this decision. Its "no measured
  driver" held for detail pages; the filter's fan-out is the driver.
- ADR 0025's trigger stands, but its remedy now has an obvious home: moving
  the throttler and signup limiters onto this Redis is a separate follow-up,
  not part of #168.
- Cached JSON is served up to a day stale. A show that moves service today is
  filtered by yesterday's data until its key expires.
