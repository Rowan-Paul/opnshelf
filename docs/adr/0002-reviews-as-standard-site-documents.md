# ADR 0002: Reviews as standard.site documents, rating as its own entity

We are replacing the bespoke `xyz.opnshelf.review` lexicon (which fused a 1–10 rating with optional ≤5000-char text in a single one-per-media record) with two independent entities: a **Rating** (`xyz.opnshelf.rating` — the numeric score, one per user per media item) and a **Review** (a `site.standard.document` — long-form text, zero-or-many per media). The two are correlated on read by matching `userDid` + media coordinates; neither references the other.

## Why

A review and a rating are genuinely different things that were only fused for storage convenience. The common case is a bare score with no prose, which has no business being a titled, published blog post. Splitting them lets a bare "8/10" stay a lightweight Rating while real write-ups become first-class, portable long-form documents.

Authoring reviews as `site.standard.document` (rather than a richer opnshelf-owned lexicon) is the whole point: documents are indexed and surfaced across the standard.site ecosystem (Leaflet, GreenGale, Bluesky clients, etc.) and can live under the user's own blog. We accept depending on lexicons we don't control (`site.standard.document`, and `at.markpub.markdown` for the body) in exchange for that reach.

## Considered options

- **Keep a self-contained `xyz.opnshelf.review` and add a long body** — rejected: keeps reviews trapped inside opnshelf, no ecosystem interop, which defeats the goal.
- **A separate "long-form review" entity alongside the old review** — rejected: leaves two overlapping review concepts.
- **Reviews are documents** (chosen), with rating extracted into its own record.

## Media linkage

A `site.standard.document` has no media field, and standard.site is explicitly *not* a content standard. We bind a review to its media item with an **embedded, typed object** — `xyz.opnshelf.mediaLink` (`mediaType`, `mediaId`, optional `seasonNumber`/`episodeNumber`) — placed in the document's **open `links` union**. Chosen over (a) a separate sidecar record (extra collection/writes to keep in sync) and (b) a plain URL link re-parsed by regex (host-fragile — note the public site is `opnshelf.xyz` while the PDS is `opnshelf.social`). The structured object keeps media as first-class data; other standard.site tools ignore the unknown `$type` and still render the post. opnshelf recognizes a document as a Review by the presence of this link member on a tracked user's repo.

## Consequences

- The full review renders on opnshelf's **canonical page** (`opnshelf.xyz/@<handle>/<path>`); cross-tool interop is **preview-only** (`title`, `description`, `coverImage`, `textContent`), since no tool renders a foreign content union. opnshelf must serve those public pages.
- Rating and Review are associated by correlation, not a stored pointer — so rating create/change/delete never rewrites a published document.
- Scope limit: only documents authored by **tracked opnshelf users** and carrying a `mediaLink` are indexed as Reviews; externally-authored blog posts about media are not claimed.
- Pre-launch: no migration of existing `xyz.opnshelf.review` data — the model ships fresh.
