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

## Flagged ambiguities

- **"Review" vs "Rating"**: These are now two independent entities. "Rating" is the numeric 1–10 score, one per user per media. "Review" is long-form text (a `site.standard.document`) and carries no score. Either can exist without the other; opnshelf re-associates them on a media page by matching `userDid` + media coordinates.
- **"Top reviews"**: Reviews no longer carry a rating, so the old `likeCount DESC, rating DESC, createdAt DESC` tiebreak no longer applies as-is. A Review's tiebreak rating, if used, comes from the author's separate Rating for the same media (a join), not from the Review itself.
