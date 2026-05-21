# opnshelf

A social media tracking and review platform where users log, rate, and review movies and TV shows.

## Language

**Review**:
A user's rating (1–10 scale) and optional text content for a specific media item. Each user can write one review per media item.
_Avoid_: Rating (alone — "rating" is just the numeric score; a review includes both rating and content)

**Your Review**:
The authenticated user's own review for a specific media item, shown in the sidebar for quick editing.

**Community Review**:
A review from any user, visible to all visitors. Distinct from "Your Review."
_Avoid_: Public review

**Review Like**:
A user's expression of appreciation for another user's review. Only possible on reviews that are not your own.
_Avoid_: Heart, upvote, helpful vote

**Media Item**:
A movie, show, season, or episode that can be tracked, reviewed, and listed.

**Shelf**:
The collection of media items a user has marked as watched or tracked.

## Flagged ambiguities

- **"Review" vs "Rating"**: "Rating" refers only to the numeric score (1–10). "Review" includes both the rating and optional text content. Use "rating" when you mean only the number, "review" when you mean the full record.
- **"Top reviews"**: Sort order is `likeCount DESC, rating DESC, createdAt DESC`. "Top" does not mean "most recent" or "highest rated alone." It means most appreciated by the community.
