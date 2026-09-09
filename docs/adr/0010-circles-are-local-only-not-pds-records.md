# ADR 0010: Circles are local-only, not PDS records

A **Circle** is a private, named grouping of Users you follow, used to filter your Activity Feed. Unlike every other user-owned entity in opnshelf — Follows, media Lists, Reviews — which dual-writes to the user's PDS, a Circle is stored **only** in local Postgres and is never federated.

Two reasons drove this. First, atproto has no private records: anything in a PDS repo is publicly readable, and Bluesky's own list membership (`listitem`) is public. Friend-tiering ("I put you in my B-list") being publicly readable is socially toxic, so a public record is unacceptable. Second, a Circle is a personal *view preference* (a feed lens), not portable social content worth federating.

Trade-off accepted: Circles are not portable across the standard.site ecosystem and won't survive a PDS migration. If we later want shareable/public circles, that's a new public lexicon and a separate feature — it does not change this private one.
