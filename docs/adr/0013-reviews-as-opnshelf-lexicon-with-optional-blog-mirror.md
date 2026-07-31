# ADR 0013: Reviews as `xyz.opnshelf.review` with optional standard.site blog mirror

We are reversing ADR-0002 and ADR-0003. Reviews are no longer authored as `site.standard.document` records; they are stored in an opnshelf-controlled `xyz.opnshelf.review` lexicon. Ratings remain independent as `xyz.opnshelf.rating`. A Review may optionally be mirrored to the author's own standard.site blog as a `site.standard.document`, but the blog mirror is opt-in and opnshelf no longer mints per-user publications.

## Why

ADR-0002 traded control for ecosystem reach by making every review a standard.site document. In practice that forced every review to look and behave like a blog post — with a publication, a path, and canonical rendering obligations — even when the author only wanted a short review on opnshelf. It also tied the core review data model to a lexicon opnshelf does not control.

Moving reviews back to an opnshelf lexicon restores control over the data model, query patterns, likes (`xyz.opnshelf.review.like`), and canonical URLs. The optional standard.site mirror keeps the ecosystem path open for users who want it, without imposing blog semantics on every review.

## What changed

- **Review storage:** new `xyz.opnshelf.review` record with `mediaType`, `mediaId`, optional `seasonNumber`/`episodeNumber`, required `title`, required `content` (markdown source), `createdAt`, and `updatedAt`.
- **Rating:** unchanged as `xyz.opnshelf.rating`; still correlated with reviews by `userDid` + media coordinates.
- **Review likes:** `xyz.opnshelf.review.like` now references an `xyz.opnshelf.review` URI.
- **Blog mirror:** when enabled, opnshelf writes a `site.standard.document` pointing at a publication the user already owns (e.g. Leaflet). Connecting a publication performs no immediate bulk publish; mirroring existing Reviews in bulk is a separate, explicit action that defaults off. An older Review retains its latent mirroring preference, however, so editing it after connecting a blog publishes its mirror unless the author opts out in that editor. The document's URI and CID are stored on the local `Review` row (`blogDocumentUri`, `blogDocumentCid`).
- **One managed mirror per Review:** changing the selected publication performs no external writes. Existing mirror documents are abandoned unchanged and become independent historical copies; Opnshelf clears their managed pointers locally. The next edit or explicit bulk action creates a new document with a fresh record key in the newly selected publication and tracks only that mirror. Disconnecting instead pauses management and retains pointers, so reconnecting the same publication resumes synchronization without duplicates; an explicit **Start fresh** action may abandon them. Abandoned copies are never synchronized or deleted by Opnshelf.
- **Current-target invariant:** Opnshelf acts only on a Review's managed mirror for the currently selected publication. Editing updates that document when it exists, otherwise it creates a new current mirror; documents from previous publications are ignored completely. A per-Review opt-out prevents current-target creation or updates and never triggers reauthorization merely to clean up an ignored historical copy.
- **Missing publication:** if the selected publication disappears from the User's PDS, Opnshelf stops mirror writes and marks the connection **Publication missing** rather than writing a stale `site` pointer. Core Review operations continue. Choosing another publication abandons the old managed pointers; disconnecting removes blog permission. Neither action is started automatically.
- **Publications:** opnshelf no longer lazily mints a default `site.standard.publication`. A user may select an existing publication in settings, but owning a blog is not required to review.
- **Canonical review page:** `/reviews/{handle}/{rkey}` instead of `/@handle/<path>`.
- **Cutover:** fresh start; existing `site.standard.document` reviews are not migrated (beta).

## Considered options

- **Keep reviews as standard.site documents** — rejected: forces blog semantics on all reviews and depends on an external lexicon for core data.
- **Fuse rating and review into one record** — rejected: a bare score and long-form prose are different things; the split keeps each lightweight.
- **Separate opnshelf review + optional standard.site mirror** — chosen: controlled core model with optional ecosystem reach.

## Consequences

- The `Review` table drops `publicationUri`, `path`, `description`, and `textContent` and gains `blogDocumentUri` and `blogDocumentCid`.
- The `Publication` table is no longer written by opnshelf and can be removed once legacy data is cleared.
- Community review cards and canonical pages render from `xyz.opnshelf.review` data, computing excerpts locally.
- Standard.site interop is now limited to users who opt into blog publishing.
