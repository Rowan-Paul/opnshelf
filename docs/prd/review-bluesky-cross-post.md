# Plan: Review Bluesky Cross-post

## Outcome

An author creating a Review on web or mobile can opt into **Also post on Bluesky**. The checkbox is off by default and appears only for new Reviews. A successful opt-in creates one independent `app.bsky.feed.post` with fixed OpnShelf copy, a linked call to action, and a rich card for the canonical Review page.

This is a **Bluesky Cross-post**, not generic sharing and not a synchronized mirror. Editing or deleting the Review never edits or deletes the Bluesky post.

## Resolved experience

- Add an unchecked **Also post on Bluesky** control beside the existing optional blog-publishing control in both Review editors.
- Do not show the control when editing an existing Review.
- Allow blog publishing and Bluesky cross-posting to be selected independently or together.
- Publish the Review first. A Bluesky failure must not fail or roll back the Review.
- Show two independent results when Bluesky was requested:
  - **Review published**
  - **Posted to Bluesky**, with **View post**, or **Couldn't post to Bluesky**, with **Retry**
- A retry is idempotent and cannot create a duplicate post.
- The Bluesky post has an independent lifecycle. Review edits and deletion leave it untouched.

### Post content

Visible post text:

```text
I reviewed {media title} on OpnShelf: “{Review title}”

Read my review
```

**Read my review** is a rich-text link facet whose URI is the absolute canonical Review URL. The raw URL is not included in the visible text and therefore does not consume the post's 300-grapheme budget.

The external card uses:

- URI: canonical Review URL
- Title: `{Review title} — {media title}`
- Description: `A review by @{handle} on OpnShelf.`
- Thumbnail: the media poster when available

No Review body or excerpt appears in either the post or card, avoiding accidental spoilers. If the poster cannot be fetched or uploaded, publish the card without a thumbnail. If text is too long, truncate the Review title first and the media title only as a final fallback; preserve the framing text and linked call to action. Truncation must count Unicode grapheme clusters, while link-facet offsets must use UTF-8 bytes.

## API and persistence

1. Add `postToBluesky?: boolean` to `CreateReviewDto`, defaulting to `false`. Do not add it to `UpdateReviewDto` because cross-posting happens only on creation.
2. Add nullable `blueskyPostUri` and `blueskyPostCid` columns to `Review`. They record a successful external write but do not imply synchronization.
3. Return a cross-post result from Review creation so clients can render the second toast without treating a partial failure as a failed Review. Use an explicit result such as:

   ```ts
   type BlueskyCrossPostResult =
     | { status: "not_requested" }
     | { status: "posted"; uri: string; url: string }
     | { status: "failed" };
   ```

4. Add an authenticated owner-only retry endpoint, `POST /reviews/:reviewId/bluesky-post`. It returns the same result shape and performs an idempotent `putRecord`.
5. Regenerate `@opnshelf/api` after the OpenAPI DTOs and endpoints change.

The Bluesky post uses the Review's `rkey` in the separate `app.bsky.feed.post` collection. Because record keys are collection-scoped, this gives the post a stable key without conflicting with the `xyz.opnshelf.review` record. Repeated writes replace the same post instead of creating duplicates.

If `blueskyPostUri` is already stored, retry returns the existing post result without writing again. This preserves the post's independent snapshot after a confirmed success. The deterministic `putRecord` remains the safety net for an ambiguous failure where the PDS accepted the post but OpnShelf did not receive or persist the response.

## Backend implementation

1. Add `repo:app.bsky.feed.post` to `OAUTH_SCOPE` and its published OAuth client metadata.
2. Add a focused post-composition helper under the Reviews module that:
   - resolves the author handle plus media title/poster using the existing Review enrichment paths;
   - builds the absolute `https://opnshelf.xyz/reviews/{handle}/{rkey}` URL;
   - composes and grapheme-truncates the fixed text;
   - creates the UTF-8 byte-indexed link facet over **Read my review**;
   - builds `app.bsky.embed.external` with the agreed title and spoiler-safe description;
   - fetches the poster only from the fixed TMDB image origin, validates size/content type, and uploads it as a blob best-effort.
3. After the Review record and local row succeed, call the cross-post helper only when `postToBluesky` is true. Catch and log cross-post failures, return `status: "failed"`, and keep the Review success response.
4. On successful post or retry, persist its URI/CID and derive the public Bluesky URL for client feedback.
5. Do not invoke cross-post logic from Review update or delete paths.

Keep the post operation separate from `syncBlogMirror`: both are optional secondary writes, but blog mirroring is synchronized with later Review changes while a Bluesky Cross-post is intentionally a one-time post.

## Web implementation

1. Extend `ReviewDialog` with local `postToBluesky` state initialized to `false` whenever a new Review dialog opens.
2. Render the checkbox only when `review` is absent and send its value only through the create mutation.
3. Refactor `useCreateReview` to consume the returned cross-post result:
   - retain the existing Review-success toast and query invalidation;
   - add the success toast with a **View post** action;
   - add the failure toast with a **Retry** action backed by the new endpoint.
4. Keep `useUpdateReview` unchanged with respect to Bluesky.

## Mobile implementation

1. Add `postToBluesky` to the new-Review draft passed through `ReviewEditorSheet`, `ReviewButton`, `CommunityReviews`, and `useReview`; keep it out of edit saves.
2. Add the unchecked switch only for create mode.
3. Handle the create response and retry endpoint in `useReview`, opening the returned Bluesky URL for **View post**.
4. Extend the custom mobile toast provider to support stacked toasts and optional actions. The previous provider stored only one toast, so firing two results immediately would overwrite **Review published** instead of satisfying the agreed two-toast behavior.

## OAuth rollout

Adding `repo:app.bsky.feed.post` does not upgrade already-issued authorization. Because OpnShelf is in beta, invalidate existing app sessions during deployment and require everyone to sign in again with the new scope. Verify both the localhost client-id scope and hosted OAuth metadata tests.

The rollout should make the permission change explicit in release notes. It should not attempt a silent authorization upgrade or retain a disabled checkbox for old sessions.

## Verification

### Backend

- Creating without `postToBluesky` performs no `app.bsky.feed.post` write and reports `not_requested`.
- Creating with it writes the Review first, then a post using the same rkey in the post collection.
- Exact copy, canonical URL, card metadata, and link facet byte offsets are correct, including emoji and non-ASCII titles.
- The post remains within 300 grapheme clusters; Review title truncates before media title.
- No Review markdown/body appears in the post or external card.
- Poster upload success adds `thumb`; fetch/upload failure still publishes the card without it.
- A post failure returns a successful Review plus `failed` status.
- Retry is owner-only and rewrites the deterministic record rather than minting another.
- Review update and deletion make no call to the post collection.
- OAuth scope and metadata tests include `repo:app.bsky.feed.post`.

### Web

- The checkbox is present and off for creation, absent for editing, and independent from blog publishing.
- No Bluesky toast appears when unchecked.
- Requested success produces separate Review and Bluesky toasts; **View post** opens the returned URL.
- Requested failure preserves the Review success toast and exposes a working idempotent **Retry** action.

### Mobile

- The switch follows the same create-only/default-off behavior as web.
- The toast stack displays both results rather than replacing the first.
- **View post** and **Retry** actions work, including after the editor sheet closes.

Run the focused Reviews service/controller tests, OAuth tests, web component/hook tests, mobile hook/toast tests, API generation, TypeScript checks, and the normal lint/test commands for the touched workspaces.

## Acceptance criteria

- A newly signed-in beta user can create a Review with Bluesky posting unchecked and no Bluesky record is written.
- When checked, the Review succeeds independently and exactly one idempotent Bluesky post is attempted.
- The post uses the approved spoiler-safe copy and external card, links to the canonical Review, and shows the poster when thumbnail upload succeeds.
- Web and mobile provide two separate result toasts with functional **View post** or **Retry** actions.
- Editing or deleting the Review never modifies or deletes the Bluesky post.
