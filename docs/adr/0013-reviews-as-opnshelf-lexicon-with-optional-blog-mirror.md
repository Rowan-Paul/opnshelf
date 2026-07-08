# ADR 0013: Reviews as `xyz.opnshelf.review` with optional standard.site blog mirror

We are reversing ADR-0002 and ADR-0003. Reviews are no longer authored as `site.standard.document` records; they are stored in an opnshelf-controlled `xyz.opnshelf.review` lexicon. Ratings remain independent as `xyz.opnshelf.rating`. A Review may optionally be mirrored to the author's own standard.site blog as a `site.standard.document`, but the blog mirror is opt-in and opnshelf no longer mints per-user publications.

## Why

ADR-0002 traded control for ecosystem reach by making every review a standard.site document. In practice that forced every review to look and behave like a blog post — with a publication, a path, and canonical rendering obligations — even when the author only wanted a short review on opnshelf. It also tied the core review data model to a lexicon opnshelf does not control.

Moving reviews back to an opnshelf lexicon restores control over the data model, query patterns, likes (`xyz.opnshelf.review.like`), and canonical URLs. The optional standard.site mirror keeps the ecosystem path open for users who want it, without imposing blog semantics on every review.

## What changed

- **Review storage:** new `xyz.opnshelf.review` record with `mediaType`, `mediaId`, optional `seasonNumber`/`episodeNumber`, required `title`, required `content` (markdown source), `createdAt`, and `updatedAt`.
- **Rating:** unchanged as `xyz.opnshelf.rating`; still correlated with reviews by `userDid` + media coordinates.
- **Review likes:** `xyz.opnshelf.review.like` now references an `xyz.opnshelf.review` URI.
- **Blog mirror:** when enabled, opnshelf writes a `site.standard.document` pointing at a publication the user already owns (e.g. Leaflet). The document's URI and CID are stored on the local `Review` row (`blogDocumentUri`, `blogDocumentCid`).
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
