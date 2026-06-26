# opnshelf

A social media tracking and review platform where users log, rate, and review movies and TV shows.

## Language

**Rating**:
A user's numeric 1–10 score for a specific media item, with no text. Its own first-class entity. Each user has at most one Rating per media item. A Rating can exist with no Review and a Review with no Rating — the two are independent.
_Avoid_: Review (a Review is the long-form text, not the score)

**Review**:
A user's long-form textual piece about a media item, authored as a `site.standard.document` so it is portable and indexable by the wider standard.site ecosystem (Leaflet, GreenGale, Bluesky clients, etc.). A Review carries no numeric score — the score is a separate Rating. A bare "8/10" with no prose is a Rating, not a Review. A user may write zero or many Reviews about the same media item (e.g. a first-watch piece and a later rewatch essay).
_Avoid_: Rating (the numeric score is a separate entity)

**Your Reviews**:
The authenticated user's own Reviews for a specific media item, listed in the sidebar for quick access and editing. Plural — a user can have more than one Review per media item.

**Community Review**:
A review from any user, visible to all visitors. Distinct from "Your Review."
_Avoid_: Public review

**Review Like**:
A user's expression of appreciation for another user's review. Only possible on reviews that are not your own.
_Avoid_: Heart, upvote, helpful vote

**Publication**:
A `site.standard.publication` record in a user's PDS that a user's Reviews belong to (a document's `site` field points at it). By default opnshelf mints one per user (e.g. "Jane's OpnShelf" at `opnshelf.xyz/@jane`) so anyone can review without owning a blog; a user may instead point their Reviews at another `site.standard.publication` they already own in their own PDS (e.g. a Leaflet publication). The publication, not opnshelf, is what makes Reviews surface and stay discoverable across the standard.site ecosystem.

**Media Item**:
A movie, show, season, or episode that can be tracked, reviewed, and listed.

**Shelf**:
The collection of media items a user has marked as watched or tracked.

**Watch**:
A single logged instance of a user watching a media item — a tracked record with a watched status and a watch date. Rewatches are distinct Watches (no uniqueness constraint per user+item, so watching the same episode twice produces two Watches); an item merely added to a watchlist is **not** a Watch. Counts of "watched" activity (the profile activity graph, "watched this year", most-watched show) count Watches, not distinct titles, and are reckoned in the **Watcher's own timezone** — the same definition powers both the public profile and the private dashboard.
_Avoid_: View, log entry (a watchlist add is a separate, un-watched state)

**Most-Watched Show**:
The show for which a user has the most logged episode-Watches (rewatches included), ties broken by most recent Watch. Shown as the personal headline stat on a profile.

**Onboarding**:
The first-run setup a user completes _after_ account creation and email verification: welcome → profile (display name, avatar) → watch-country preference → optional Trakt history import → follow suggestions → done. Gated by `needsOnboarding` and ended by `onboardingCompletedAt`. It does **not** include Signup (which creates the account) or Email Verification (which precedes it and is its own gate). The same step sequence is the target on both web and mobile.
_Avoid_: Signup, registration, sign-up flow (those create the account; onboarding is the post-verification setup)

**Activity**:
A single item in the followed-users feed — a followed user's **Watch** (movie or episode) or **Review**, surfaced to the people who follow them. Not a separately stored entity; it is a projection over Watches and Reviews, ordered by when the action happened.
_Avoid_: Event, feed post

**Activity Feed**:
The reverse-chronological stream of **Activities** from everyone the authenticated user follows. The full feed is the mobile Activity tab and the web "following" page; the home dashboard shows a short preview of the same feed.

**Person**:
A cast or crew member sourced from TMDB — actor, director, writer, composer, etc. — not just actors. Has a TMDB person id and a detail page at `/people/{id}/{name-slug}`. A Person is **not** an opnshelf account holder; see _User_. In the ⌘K palette, Person results appear under the **Cast & Crew** heading (not "Actors", since the set includes directors and crew).
_Avoid_: Actor (too narrow — excludes directors/crew), User (an account holder, a different entity)

**User**:
An opnshelf account holder, identified by DID and handle, with a profile at `/profile/{handle}`. Found via social people search. In the ⌘K palette, User results appear under the **People** heading. Distinct from _Person_ (a TMDB cast/crew member with no opnshelf account).
_Avoid_: Person (reserved for TMDB cast/crew), Member

**Home**:
The personal landing surface (dashboard): your shelf summary, up-next, and a short preview of the **Activity Feed**. One name across web and mobile — the web route was historically `/dashboard`.
_Avoid_: Dashboard (retired as a label — the canonical word is Home)

**Connections**:
The destination for growing and organising your network: finding people (people search) and your **Circles**. The "manage people" counterpart to **Activity** (the "consume the feed" surface). The full **Following**/**Followers** lists are canonical on the **Profile**, not hosted here; Connections may show a small recent-followers *preview* (a glance + "see all" entry point that links to the canonical profile list), but never the managed list itself. One name on both web and mobile — supersedes the old split of "Following" (web page), "Connections" (mobile screen) and "Find" (mobile button).
_Avoid_: Find, Friends, People (collides with the User/Person split), Network, the old "Following" page name

**Following / Followers**:
The list of Users a given User follows / is followed by. Canonically rendered on that User's **Profile** (a single shared list component), reached from the profile's follower/following counts. On your own Profile the rows carry manage affordances (unfollow, add-to-**Circle**); on others' it is read-only. Counts shown on a Profile are that User's own totals — never derived from the items in a followed list.
_Avoid_: Connections (reserved for the hub destination)

**Circle**:
A private, personal, named grouping of Users you follow — used to filter your Activity Feed (e.g. see only "Family" or "Cinephiles" activity). Visible only to its owner; **not** a PDS record (it is local-only view state, never federated). Membership requires an active Follow and is dropped when you unfollow. A followed User may belong to many Circles. Distinct from a _List_ (media curation) and a _Format_ (Library axis).
_Avoid_: Category (retired — overloaded), List (reserved for media curation), Friend Group, Group (too generic), Friend (opnshelf has no friend/mutual-follow concept — you group Users you **follow**)

**Discover**:
The surface for finding media the user hasn't tracked yet. Subsumes the old Search surface (web route, mobile tab): it still does keyword search, but adds discovery sections (e.g. trending, similar, surfaced from the people you follow). "Search" is now one capability of Discover, not a separate destination.
_Avoid_: Search (now a sub-capability of Discover, not its own surface), Explore

**Library**:
The umbrella term for everything a user **owns** — physical or digital copies of films. Not a stored entity (mirrors _Shelf_, which is the umbrella over Watches). Distinct from a _List_: a List is curation ("want to watch", "favorites"); the Library is ownership ("I own this, in this format"). Replaces the issue-era word "Collection."
_Avoid_: Collection (retired — too easily confused with _List_), Shelf (reserved for watched/tracked items)

**Library Item**:
A single stored record meaning "this user owns this film in this Format." The same film owned in two Formats is two Library Items. Optionally belongs to a _Box Set_.

**Format**:
The medium a film is owned in — e.g. Digital, Blu-ray, Blu-ray 4K, DVD. The organising axis of the Library. Renamed from the issue's "Category" (which is dangerously overloaded — genres, nav, content categories).
_Avoid_: Category (overloaded), Edition

**Box Set**:
A named grouping of Library Items within a user's Library (e.g. "The Lord of the Rings Trilogy"). A subdivision of the Library, not of a List.

## Flagged ambiguities

- **"Activity" (feed) vs "activity graph"**: An **Activity** is a feed item (a followed user's Watch or Review). The "profile activity graph" (`ProfileActivityDayDto`) is unrelated — it is a per-day count of the profile owner's own **Watches**, a contribution-style heatmap. The feed is about people you follow; the graph is about one user's watching cadence.

- **"Review" vs "Rating"**: These are now two independent entities. "Rating" is the numeric 1–10 score, one per user per media. "Review" is long-form text (a `site.standard.document`) and carries no score. Either can exist without the other; opnshelf re-associates them on a media page by matching `userDid` + media coordinates.
- **"Top reviews"**: Reviews no longer carry a rating, so the old `likeCount DESC, rating DESC, createdAt DESC` tiebreak no longer applies as-is. A Review's tiebreak rating, if used, comes from the author's separate Rating for the same media (a join), not from the Review itself.
