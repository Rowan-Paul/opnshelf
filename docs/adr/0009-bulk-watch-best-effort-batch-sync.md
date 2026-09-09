# ADR 0009: Bulk watch logging is best-effort batch-sync

Marking a whole season or show watched used to loop one `putRecord` PDS call plus one DB
`create` per episode — sequential, so a long-running show meant hundreds of round-trips and a
multi-second wait (issue #23). We switched the interactive bulk paths (`markSeasonWatched`,
`markShowWatched`) to write via `com.atproto.repo.applyWrites` in batches of 200 and to index
with a single `createMany({ skipDuplicates: true })`, and we parallelise the per-season TMDB
`getSeasonDetails` fetches. The response was slimmed to `{ count, requested }` because both
web and mobile callers ignore the hydrated rows and only invalidate + refetch.

Three deliberate non-goals a future reader will be tempted to "fix":

- **Not optimistic-async.** The write stays synchronous; we did not add a background queue.
  Batching alone removes the bottleneck, and a queue would introduce a durable job, retries,
  and a DB/PDS divergence window for no measured benefit. Revisit only if huge shows are still
  too slow after batching.
- **Not subject to the import write-reserve.** The Trakt import's `PDS_WRITE_RESERVE_POINTS`
  and `waiting_retry` pause loop exist to stop a *background* import from starving *interactive*
  writes. A bulk-mark tap **is** the interactive write, and a request the user is waiting on
  cannot pause for an hour. So it ignores the reserve and does not retry.
- **Not deterministic rkeys.** The interactive path keeps `TID.nextStr()`, unlike the import's
  SHA-based rkeys. Deterministic rkeys only dedupe byte-identical `watchedAt`, so they would not
  stop double-tap ("watched now" twice = different timestamps), and dedup is out of scope here.

On a PDS rate-limit (429) the call stops, persists the batches that already succeeded, and
returns `{ count, requested }` with `count < requested`; clients surface "Added N of M"
(`count: 0` routes to an error toast). Clients also warn before firing when a show/season
exceeds 200 episodes, since that volume can plausibly exhaust a user's hourly PDS write budget
— a heuristic, because the user's PDS and remaining budget are unknown (federated).
