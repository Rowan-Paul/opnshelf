# opnshelf

A social media tracking and review platform where users log, rate, and review movies and TV shows.

## Language

**Rating**:
A user's numeric 1–10 score for a specific media item, with no text. Its own first-class entity. Each user has at most one Rating per media item. A Rating can exist with no Review and a Review with no Rating — the two are independent.
_Avoid_: Review (a Review is the long-form text, not the score)

**Review**:
A user's long-form textual piece about a media item, stored as an opnshelf-controlled `xyz.opnshelf.review` record. A Review carries no numeric score — the score is a separate Rating. A bare "8/10" with no prose is a Rating, not a Review. A user may write zero or many Reviews about the same media item (e.g. a first-watch piece and a later rewatch essay). A Review may optionally be mirrored to the author's own standard.site blog as a `site.standard.document`.
_Avoid_: Rating (the numeric score is a separate entity)

**AT Store Review**:
A user's 1–5 star assessment of OpnShelf for the AT Store directory, optionally accompanied by text. It evaluates the app rather than a **Media Item** and is therefore distinct from both a **Review** and a **Rating**.
_Avoid_: Review (reserved for long-form writing about a Media Item), Rating (reserved for a Media Item score)

**Spoiler Flag**:
An author-declared marker on a Review meaning the body contains spoilers, whole-review granularity (no inline spans). The Review title is outside the spoiler boundary by author contract: it stays visible on every surface, including the Bluesky Cross-post, so authors must keep titles spoiler-free. Absence of the flag means "no spoilers", including for all pre-existing Reviews.
Surfaces that cannot render a Spoiler Shield — the blog mirror — carry a leading spoiler warning as body prefix and as the document's description/excerpt instead of redacting content; the author's own blog audience gets a warned full text, never a stub.
_Avoid_: Spoiler tag (suggests inline spans), spoiler warning (that's the reader-facing shield, not the author's marker)

**Spoiler Shield**:
The reader-facing cover shown in place of a flagged Review's body (excerpt cards and detail pages), removed by an explicit tap/click to reveal. Reveals are ephemeral — nothing is persisted per review. An account-level "always show spoiler content" setting suppresses Shields entirely. Shields never apply to the author's own Reviews; logged-out readers always get Shields.
_Avoid_: Spoiler overlay, blur (implementation details), spoiler warning (ambiguous with the Flag)

**Bluesky Cross-post**:
An optional, one-time Bluesky post announcing a newly created Review and linking to its canonical Review page. It is an independent post, not a synchronized mirror: later Review edits or deletion do not change or delete it.
_Avoid_: Share (too broad), Bluesky mirror (implies ongoing synchronization)

**Your Reviews**:
The authenticated user's own Reviews for a specific media item, listed in the sidebar for quick access and editing. Plural — a user can have more than one Review per media item.

**Community Review**:
A review from any user, visible to all visitors. Distinct from "Your Review."
_Avoid_: Public review

**Review Like**:
A user's expression of appreciation for another user's review. Only possible on reviews that are not your own.
_Avoid_: Heart, upvote, helpful vote

**Publication**:
A `site.standard.publication` record in a user's PDS that the user already owns (e.g. a Leaflet publication). A user may optionally select one in their opnshelf settings as the target for blog-mirrored Reviews. opnshelf does **not** mint publications; reviewing does not require owning a blog. When a Review is mirrored to a blog, the resulting `site.standard.document`'s `site` field points at the chosen publication.

**Blog Mirror**:
The current external blog document that opnshelf keeps synchronized with a Review. A Review has at most one managed Blog Mirror; disconnecting pauses it, while changing its **Publication** abandons it unchanged and the next mirrored publish creates a new Blog Mirror as the historical copy remains independent.
_Avoid_: Blog copy (does not distinguish the managed mirror from abandoned historical copies), blog version (implies revision history)

**Media Item**:
A movie, show, season, or episode that can be tracked, reviewed, and listed.

**Shelf**:
The collection of media items a user has marked as watched or tracked. Its dated
timeline view renders one card per **Watch**, so rewatches appear as separate
cards under their respective watch dates. Date sections are labelled Today,
Yesterday, or with a full calendar date in the viewer's timezone; every Watch
card repeats its full date and time without a timezone abbreviation.

**Watch**:
A single logged instance of a user watching a media item — a tracked record with a watched status and a watch date. Rewatches are distinct Watches (no uniqueness constraint per user+item, so watching the same episode twice produces two Watches); an item merely added to a watchlist is **not** a Watch. Counts of "watched" activity (the profile activity graph, "watched this year", most-watched show) count Watches, not distinct titles, and are reckoned in the **Watcher's own timezone** — the same definition powers both the public profile and the private dashboard.
_Avoid_: View, log entry (a watchlist add is a separate, un-watched state)

**Most-Watched Show**:
The show for which a user has the most logged episode-Watches (rewatches included), ties broken by most recent Watch. Shown as the personal headline stat on a profile.

**Onboarding**:
The first-run setup a user completes _after_ account creation and email verification: welcome → profile (display name, avatar) → timezone and watch-country preferences → optional Trakt history import → follow suggestions → done. Gated by `needsOnboarding` and ended by `onboardingCompletedAt`. It does **not** include Signup (which creates the account) or Email Verification (which precedes it and is its own gate). The same step sequence is the target on both web and mobile.
_Avoid_: Signup, registration, sign-up flow (those create the account; onboarding is the post-verification setup)

**Trakt Import**:
The single optional transfer of a fixed snapshot of a User's public Trakt watch history into opnshelf **Watches**. The snapshot is taken when the User starts the Import; Watches added to Trakt afterward are outside it. A User may start only one Trakt Import; automatic retries, recovery from an error, and resuming after the User **Pauses** it all continue that same Import from its saved position rather than starting over. Every source item has one of four outcomes: **Imported**, **Already on your Shelf**, **Unmatched**, or **Couldn't import**. An Unmatched item is a valid Trakt Watch without an authoritative TMDB mapping; the User may explicitly match its Trakt media identity to a suggested or searched TMDB **Media Item**, applying that choice to all grouped watch dates. The resulting Watches belong to the chosen Media Item, so any Trakt-only edition distinction is intentionally lost. Item-level issues are an expected outcome. **Completed with issues** means the entire available history was examined but one or more items remain Unmatched or couldn't be imported; **Import stopped** means an error ended processing before the entire history was examined. A User-paused Import is **Paused**, not stopped. The Import and its item outcomes remain available until the User deletes their account.
_Avoid_: Trakt sync (implies an ongoing two-way relationship), skipped (ambiguous between an existing Watch and an item that could not be imported), failed import (ambiguous between item-level issues and a stopped import), stop (for a User action; a resumable User action is Pause)

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

**Core Opnshelf Access**:
Permission to use Opnshelf-owned capabilities and records. A User grants this access when signing in; capabilities owned by another ecosystem require **External Integration Access** when the User chooses them.
_Avoid_: Full access (incorrectly suggests access to unrelated AT Protocol services), basic access (undersells write access)

**External Integration Access**:
Permission for one optional ecosystem outside Opnshelf, enabled and disabled independently for a User across all devices. Declining or disconnecting one integration leaves **Core Opnshelf Access** and every other integration unchanged.
_Avoid_: External publishing access (incorrectly combines independent ecosystems), add-on scope (implementation language)

**Device**:
One place a User is signed in from: the app on a phone or tablet, or a browser profile on a computer. A User has at most one Device per install per account, so signing in again from the same install takes over the existing Device instead of adding a second one. A Device is not a physical machine — two browser profiles on one laptop are two Devices, and clearing browser storage produces a new one. A User revokes a Device from the **Devices** settings surface; revoking ends that install's **Core Opnshelf Access** and leaves every other Device signed in, and it never changes **External Integration Access**, which is per-User across all Devices.
_Avoid_: Session (the entity a User manages is the Device), Connected device (collides with **Connections**), Token, Login, Client

**Home**:
The personal landing surface (dashboard): your shelf summary, up-next, and a short preview of the **Activity Feed**. One name across web and mobile — the web route was historically `/dashboard`.
_Avoid_: Dashboard (retired as a label — the canonical word is Home)

**Home-Screen Widget**:
A home-screen widget on Android and iOS, placed by the user from the system widget picker, that renders the signed-in user's 30-day profile activity graph plus its total Watch count. It shows the signed-in user's own graph only — never another user's — and deep-links to that user's **Profile** on tap. When signed out it shows a sign-in placeholder that opens the login screen. It is the only thing called a "widget": the in-app profile/dashboard component it mirrors is just the *activity graph*, never a widget, despite the historical slang.
_Avoid_: Home widget (collides with **Home**), activity widget (collides with **Activity**), shelf widget (it renders the activity graph, not **Shelf** contents)

**Connections**:
The destination for growing and organising your network: finding people (people search) and your **Circles**. The "manage people" counterpart to **Activity** (the "consume the feed" surface). The full **Following**/**Followers** lists are canonical on the **Profile**, not hosted here; Connections may show small recent-following and recent-followers *previews* (a glance + "see all" entry point that links to the canonical profile list), but never the managed lists themselves. One name on both web and mobile — supersedes the old split of "Following" (web page), "Connections" (mobile screen) and "Find" (mobile button).
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

**Staging**:
The deployed environment that runs unreleased code, at `staging.opnshelf.xyz` with its API at `api.staging.opnshelf.xyz`. A Railway environment in the `opnshelf` project, deployed from the `develop` branch, with its own Postgres and its own Tab instance. It shares the production PDS, so its writes are real public records (see ADR 0021).
_Avoid_: Test environment (suggests writes are fake — they are not), dev (that's your machine)

**Update Channel**:
The EAS Update channel baked into a mobile binary at build time, which decides
which OTA updates it accepts: `development` for the dev client, `preview` for
**Staging**, `production` for store builds. Distinct from a store track (Play
internal/closed/open testing, TestFlight), which decides who can install a
binary. Only `production`-channel builds ever go on a store track (ADR 0021).
_Avoid_: Release channel (the retired Expo classic term), track (that's the store side)

**Open Testing**:
Play's public beta tier. Its `eas.json` track id is `beta`, not `open` - and
`alpha` is closed testing, not open. Getting these two backwards publishes to
the wrong audience. Unused: releases go straight to the production track behind
a **Staged Rollout** (ADR 0021).
_Avoid_: Beta (ambiguous between the track id and the tier), alpha (that's closed testing)

**Staged Rollout**:
The fraction of Play users a production Android release reaches, set by
`rollout` in `eas.json` (0.1) and only honoured when `releaseStatus` is
`inProgress`. Ramping it up and halting a bad release are both manual Play
Console steps. Apple's counterpart is **phased release**: a fixed seven-day
automatic ramp, chosen at submission rather than set as a number (ADR 0021).
_Avoid_: Percentage rollout (that's a feature flag), promotion (that's moving between tracks)

**Staging Account**:
The separate opnshelf account used only on **Staging**, kept apart from the production account because Staging writes real records to the shared PDS. It is the only user in Staging's Postgres, which is why Staging's Tab tracks a single repo.

## Flagged ambiguities

- **"Activity" (feed) vs "activity graph"**: An **Activity** is a feed item (a followed user's Watch or Review). The "profile activity graph" (`ProfileActivityDayDto`) is unrelated — it is a per-day count of the profile owner's own **Watches**, a contribution-style heatmap. The feed is about people you follow; the graph is about one user's watching cadence.

- **"Review" vs "Rating"**: These are two independent entities. "Rating" is the numeric 1–10 score, one per user per media. "Review" is long-form text (an `xyz.opnshelf.review` record) and carries no score. Either can exist without the other; opnshelf re-associates them on a media page by matching `userDid` + media coordinates.
- **`TAB_URL` on Staging**: Must point at Staging's own Tab, never production's. Tab channels carry no consumer id and share one cursor, so a Staging backend on production's Tab acks events production never receives, and those records vanish from the production index with no error. See ADR 0021.

- **"Top reviews"**: Reviews do not carry a rating, so the old `likeCount DESC, rating DESC, createdAt DESC` tiebreak does not apply as-is. A Review's tiebreak rating, if used, comes from the author's separate Rating for the same media (a join), not from the Review itself.
