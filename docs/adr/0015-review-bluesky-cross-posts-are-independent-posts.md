# Review Bluesky Cross-posts are independent posts

When an author explicitly selects **Also post on Bluesky** while creating a Review, opnshelf writes a separate `app.bsky.feed.post` that links to the canonical Review page. The post is a one-time announcement rather than a synchronized mirror: later Review edits and deletion do not update or delete it. We chose a direct post write over a Bluesky compose intent so publishing can be one deliberate action with consistent copy and a rich link card; the trade-off is an additional OAuth repository scope, a beta-wide sign-in reset, and explicit handling of partial failure after the Review has already succeeded.

The Review is always the primary write. Bluesky failure never rolls it back, retries reuse the Review's record key in the post collection to prevent duplicates, and opnshelf stores the resulting post URI/CID only for status, retry, and **View post** feedback.
