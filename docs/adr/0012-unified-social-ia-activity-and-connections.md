# ADR 0012: Unified social IA: Activity + Connections, shared across web and mobile

The social surface had drifted into a per-platform tangle: web had a `/following` page mashing the feed and people together plus a `Following` nav item, while mobile had an `Activity` tab, a `Find` button, a `/friends` screen titled "Connections", and a separate `/circles` screen. The same handful of ideas were split differently on each platform, three different words ("Following", "Connections", "Find") pointed at roughly one thing, and a newly-created **Circle** was a dead end — you couldn't see or edit who was in it.

We collapse it to **two social destinations, identical on both platforms**:

- **Activity** — the feed you consume (a followed user's Watches and Reviews), carrying the **Circle** filter.
- **Connections** — grow and organise your network: people search + your **Circles**.

Supporting decisions:

- **Following/Followers are canonical on the Profile**, not duplicated in Connections. One shared list component, reached by tapping a profile's follower/following counts (Twitter/Bluesky pattern). Your own rows carry manage affordances (unfollow, add-to-Circle); others' are read-only. The old named profile "Connections" sub-tab is removed so the word "Connections" means only the hub.
- **A Circle is navigable**: Connections lists your Circles → tap → a Circle detail view (members, add from following, remove, rename, delete), plus a per-person quick-add shortcut on following/search rows. This kills the create-then-can't-see-it dead end.
- **One shared main nav on both platforms**: Home · Discover · Activity · Connections (+ Profile as a 5th mobile tab / the web avatar menu). This forced three alignments: mobile `Search` → **Discover** (the glossary already makes Discover canonical and Search a sub-capability), `Dashboard` → **Home**, and **Calendar demoted** off the main bar (it was web-only and would have pushed mobile to six tabs).

Trade-offs accepted: people search lives in Connections while media search lives in Discover — two search entry points, mitigated by clear labels. Calendar loses top-level prominence. A reader who expected a Search tab or follower lists inside Connections should read this: those are deliberate (Discover subsumes search; lists are profile-canonical), not omissions. Alternatives considered and rejected: a single "Social" destination with internal Feed/People/Circles tabs (mixes consume and manage under one roof), and keeping three peer destinations (preserves the fragmentation this removes).
