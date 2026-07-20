# "Watched" activity counts logged Watches, in the owner's timezone, shared across surfaces

We unified the definition of "watched activity" (the 30-day activity graph, "watched this year", most-watched show) so the public profile and the private dashboard render identical numbers. A Watch counts only when an item has a `watched` status **and** a `watchedDate`; items added to a watchlist no longer count. Day/year windows are bucketed in the **profile owner's** timezone. `UsersService` reuses `ShelfService.getUserActivitySummary` so there is a single source of truth.

Prisma persists these `DateTime` fields as PostgreSQL `TIMESTAMP` values whose wall-clock value is UTC. Raw SQL must therefore attach the source zone before projecting into the owner's zone: `watchedDate AT TIME ZONE 'UTC' AT TIME ZONE ownerTimezone`. Applying only the owner's zone interprets the stored UTC wall clock as local time and shifts watches backwards, which assigns just-after-midnight watches to the previous day.

## Context / why this is surprising

Previously the dashboard's `getUserActivitySummary` used `COALESCE(watchedDate, createdAt)` with no status filter, so adding something to a watchlist counted as "watched." That contradicted the **Watch** term in CONTEXT.md (a *logged* watch). Fixing it **reduced** the dashboard's existing 7/30-day counts for anyone with watchlist items — an intentional correctness change, not a regression. A future reader seeing the dropped numbers, the removed `COALESCE`, or the new `UsersService → ShelfModule` dependency might otherwise "restore" the old behavior.

## Considered alternatives

- **Keep two definitions** (public profile in UTC, dashboard in local time, each with its own logic). Rejected: the same user would see two different 30-day graphs, and the public profile's timezone is in fact well-defined — it's the profile owner's.
- **Keep the `COALESCE`/no-status behavior** for backwards-compatible numbers. Rejected: it mislabels watchlist adds as watches, contradicting the glossary.
