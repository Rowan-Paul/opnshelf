# PRD: Community Reviews with Review Likes

## Problem Statement

Detail pages for movies, shows, seasons, and episodes only show the authenticated user's own review in the sidebar. There is no way for visitors (authenticated or not) to see what other users think about a media item, nor is there any way for users to express appreciation for reviews written by others. The review data already exists in the backend — public reviews are fetched via `reviewsControllerGetMediaReviews` — but the frontend does not surface them.

## Solution

Add a **Community Reviews** section to the main content area of every detail page (movie, show, season, episode). This section displays the most-liked reviews from all users. Each review card shows the reviewer's avatar, handle, rating, review text, and a like count with a heart button. Users can like/unlike reviews that are not their own. The existing "Your Review" sidebar card remains unchanged.

## User Stories

1. As a visitor (not logged in), I want to see what other users thought about a movie/show/season/episode, so that I can decide whether to watch it.
2. As an authenticated user, I want to see community reviews on the same page where I manage my own review, so that I can compare my opinion with others.
3. As an authenticated user, I want to like a community review that I found insightful, so that the reviewer knows their opinion was valued.
4. As an authenticated user, I want to unlike a community review I previously liked, so that I can change my mind.
5. As a visitor, I want community reviews to be sorted by popularity (likes), so that the most helpful reviews appear first.
6. As an authenticated user, I want to know whether I've already liked a review, so that I don't accidentally unlike it.
7. As a reviewer, I want to see how many likes my review received, so that I know if others found it useful.
8. As a user, I want community reviews to load efficiently without blocking the page, so that the detail page remains fast.
9. As an authenticated user, I want my own review to NOT appear in the community reviews section, so that I'm not tempted to like my own review.
10. As a user, I want to see a limited number of top reviews initially, with pagination or "load more" for the rest, so that the page isn't overwhelming.
11. As a user on mobile, I want community reviews to be readable and tappable, so that the experience works on small screens.
12. As a user, I want the community reviews section to have a clear heading that distinguishes it from other page sections, so that I know what I'm looking at.

## Implementation Decisions

### 1. Lexicon: `xyz.opnshelf.review.like`

A new ATProto lexicon defines the like record shape. This follows standard ATProto 4-part NSID convention (e.g., `app.bsky.feed.like`). The record contains:

- `reviewUri`: The `at://` URI of the review being liked
- `createdAt`: ISO datetime string

The lexicon uses `record<'tid', ...>` (same as existing lexicons).

### 2. Prisma Model: `ReviewLike`

A new table mirrors the ATProto record locally for fast querying:

```
model ReviewLike {
  id        String   @id @default(cuid())
  rkey      String   @unique
  uri       String
  cid       String

  userDid   String
  user      User     @relation(fields: [userDid], references: [did], onDelete: Cascade)

  reviewId  String
  review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userDid, reviewId])
  @@index([reviewId])
  @@index([userDid])
}
```

The `@@unique([userDid, reviewId])` constraint enforces one like per user per review.

The `Review` model needs a `likes ReviewLike[]` relation added.

### 3. Firehose Ingestion

The TAP ingester (`IngesterService`) already handles `xyz.opnshelf.review` records. It needs a new handler branch for `xyz.opnshelf.review.like`:

- **Create/Update:** Parse the record, validate that the referenced `reviewUri` points to a known local review, create/update the `ReviewLike` row. Use `rkey` as the unique identifier (same pattern as other records).
- **Delete:** Delete the `ReviewLike` row by `rkey`.

Add `REVIEW_LIKE_COLLECTION` import and `handleReviewLikeEvent` method to `IngesterService`.

### 4. ReviewsService: Like/Unlike Operations

Add methods to `ReviewsService`:

- `likeReview(userDid, session, reviewId)` — writes a `xyz.opnshelf.review.like` record to the user's PDS, then optimistically inserts into local `ReviewLike` table. Uses `TID.nextStr()` for rkey.
- `unlikeReview(userDid, session, reviewId)` — finds the existing like record by `rkey`, deletes it from PDS, then deletes from local `ReviewLike` table.

Both methods need the `Agent` + `ATSession` pattern used by `upsertReview` and `deleteReview`.

### 5. ReviewsController: New Endpoints

Add two new endpoints under `ReviewsController`:

- `POST /reviews/:reviewId/like` — authenticated, creates a like.
- `DELETE /reviews/:reviewId/like` — authenticated, removes a like.

Both return `{ success: boolean }`.

Add `GET /reviews/:reviewId/likes` — public (no auth guard), returns:
- `items`: array of `{ userDid, userHandle, userDisplayName?, userAvatar?, createdAt }`
- `total`: count of likes
- `hasLiked`: boolean (only if authenticated user provided; can be omitted for unauthenticated)

### 6. MediaReviews: Include Like Counts

Modify `getMediaReviews` in `ReviewsService` to:
- Include `likeCount` for each review (count of `ReviewLike` rows per review)
- Include `hasLiked` boolean for the requesting user (if authenticated)
- Update `MediaReviewItemDto` to include `likeCount` and `hasLiked` fields

Update the existing `GET /reviews/media` endpoint to accept an optional authenticated user (use `OptionalAuthGuard` or similar if available; otherwise check auth manually) so it can populate `hasLiked`.

Sort community reviews by: `likeCount DESC, rating DESC, createdAt DESC`. This puts most-liked first, then highest-rated as tie-breaker.

### 7. Frontend: CommunityReviews Component

Create a new `CommunityReviews` component that:
- Accepts `mediaType`, `mediaId`, `seasonNumber?`, `episodeNumber?` props
- Uses `useMediaReviews` hook (already exists) to fetch public reviews
- Renders a list of review cards, each showing:
  - Reviewer avatar (or fallback)
  - Reviewer display name (or handle fallback)
  - Star rating (read-only)
  - Review text (truncated if very long, with "read more" if needed)
  - Like count + heart button
  - Relative timestamp (e.g., "2 days ago")
- The heart button is disabled for the user's own reviews
- The heart button shows filled state when `hasLiked` is true
- Clicking the heart toggles like/unlike (mutation invalidates the media reviews query)

The component should be placed in the **main content area** (left column) of all four detail page routes:
- `MovieDetailPage` — below Overview, above Cast/Crew
- `ShowDetailPage` — below Overview, above Episodes
- `SeasonDetailPage` — below Overview, above Episodes list
- `EpisodeDetailPage` — below Overview, above Cast/Guest Stars

### 8. Frontend: useReviewLikes Hook

Create a new hook `useReviewLikes(reviewId: string)` that:
- Fetches likes for a specific review via the new endpoint
- Provides `likeReview` and `unlikeReview` mutations
- On success, invalidates the media reviews query key so counts refresh

### 9. Frontend: useMediaReviews Enhancement

The existing `useMediaReviews` hook calls `reviewsControllerGetMediaReviews`. The generated SDK types need to be regenerated after the backend API changes, or the types can be extended manually. The hook should also accept an optional `userDid` so the backend can compute `hasLiked`.

### 10. API Client Regeneration

After modifying the backend DTOs and controller, the frontend API client in `packages/api/` needs to be regenerated. This project uses `@hey-api/openapi-ts` or similar — look at how the existing generated code is produced and follow the same process.

### 11. Existing Code Changes

- `ReviewSection.tsx` — remains unchanged (still shows "Your Review" in the sidebar)
- `MediaHero` — already uses `mediaReviews.averageRating`, no change needed
- `useReviews.ts` — add the new `useReviewLikes` hook; enhance `useMediaReviews` if needed
- All four detail page routes — import and render `<CommunityReviews />` in the main content area

## Testing Decisions

### Backend Tests

- `reviews.service.spec.ts` — test `likeReview` and `unlikeReview`:
  - Creating a like writes to PDS and inserts into DB
  - Deleting a like removes from PDS and DB
  - Duplicate like is rejected (unique constraint)
  - Liking your own review should be rejected at the service level
- `reviews.controller.spec.ts` — test the new endpoints:
  - `POST /reviews/:reviewId/like` requires auth
  - `DELETE /reviews/:reviewId/like` requires auth
  - `GET /reviews/:reviewId/likes` is public
- `ingester.service.spec.ts` — test firehose handling:
  - Create event for `xyz.opnshelf.review.like` inserts into DB
  - Delete event removes from DB
  - Invalid reviewUri is handled gracefully (skip)

### Frontend Tests

- `CommunityReviews.test.tsx` — test rendering:
  - Shows review cards with correct data
  - Own review is excluded or has disabled like button
  - Like button toggles state
  - Loading and empty states

### Test Prior Art

Look at `reviews.service.spec.ts` and `ingester.service.spec.ts` for the existing test patterns. The backend uses Jest with NestJS `Test.createTestingModule`. The frontend testing setup is likely Vitest + React Testing Library — check existing component tests for patterns.

## Out of Scope

- Renaming `xyz.opnshelf.listItem` to `xyz.opnshelf.list.item` — this is a separate refactor
- Pagination/infinite scroll for community reviews — fetch all in one query for now; pagination can be added later
- Review comment threads or replies
- Notifications when someone likes your review
- Sorting/filtering options (most recent, highest rated, etc.) — fixed sort order only
- Review editing from the community reviews section — users still edit via the sidebar "Your Review" card
- Rate limiting or spam protection for likes

## Further Notes

### Lexicon Generation

The existing lexicons are generated via `@atproto/lex`. You'll need to:
1. Write the `.json` lexicon definition file (see existing lexicons in the project for the source format)
2. Run the generation command (check `package.json` scripts or ask the user)
3. Import the generated `main` schema and `$nsid` in the ingester

### PDS Write Pattern

Follow the exact pattern used by `upsertReview` in `ReviewsService`:
```typescript
const agent = new Agent(session as unknown as ConstructorParameters<typeof Agent>[0]);
await agent.com.atproto.repo.putRecord({ repo: session.did, collection: REVIEW_LIKE_COLLECTION, rkey, record, validate: false });
```

And for delete:
```typescript
await agent.com.atproto.repo.deleteRecord({ repo: session.did, collection: REVIEW_LIKE_COLLECTION, rkey });
```

### User Avatar Fallback

The `MediaReviewItemDto` already includes `userAvatar`. In the frontend, if `userAvatar` is missing, use the existing fallback pattern: `https://i.pravatar.cc/150?u={userDid}`.

### Performance

Community reviews should not block the initial page render. The detail pages already fetch `mediaReviews` in the component body (not in the loader), so reviews will load after the main content. This is acceptable — the community reviews section can show a skeleton loader while data loads.

### Auth Context for Public Endpoint

The `GET /reviews/media` endpoint is currently public (no `@UseGuards(AuthGuard)`). To populate `hasLiked`, you need the user's DID. Options:
- Add `@UseGuards(OptionalAuthGuard)` if one exists
- Or manually extract the auth token from the request headers in the controller and look up the user
- Or accept `userDid` as a query param (less secure)

Check if `OptionalAuthGuard` exists in the codebase. If not, the simplest approach is to accept an optional `x-user-did` header or similar, but the cleanest is to create an `OptionalAuthGuard` that populates `req.user` if a valid token is present, without rejecting the request.

### Review Exclusion

When rendering community reviews, filter out the authenticated user's own review. The `MediaReviewItemDto` doesn't include `userDid` on the frontend currently, but it does in the backend response. Update the frontend type or just filter by comparing `userDid` from auth context.
