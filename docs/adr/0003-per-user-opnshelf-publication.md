# ADR 0003: opnshelf mints a per-user publication by default

Status: superseded by [ADR-0013](0013-reviews-as-opnshelf-lexicon-with-optional-blog-mirror.md).

A `site.standard.document` must reference a `site` — a `site.standard.publication` — and that reference determines which blog the review surfaces on. By default opnshelf **lazily mints one `site.standard.publication` per user** (on their first review, not at signup) into the user's own PDS, with `url: opnshelf.xyz/@<handle>`. The publication record key is `tid` (a repo may hold several publications), so the rkey is not stable; idempotency comes instead from a per-user guard in opnshelf's own database — opnshelf mints at most one publication per user and recognises its own by the `opnshelf.xyz/@<handle>` url. (An earlier draft mis-vendored the lexicon with a `literal:self` key and relied on a fixed rkey; that was corrected when the canonical key was confirmed to be `tid`.) A user who already owns a publication elsewhere can override the target via a per-user setting, in which case opnshelf does not mint one and points reviews' `site` at their publication instead.

## Why

The alternatives were worse. Requiring users to bring an external publication would make reviewing impossible for the majority who don't run a blog. Using a single shared opnshelf-wide publication would put every user's reviews under one identity and one PDS, breaking the "your data travels with you" principle and the per-author canonical URL. Minting a per-user publication in the user's own PDS means anyone can review out of the box, the reviews are portable and discoverable as that user's publication, and power users can still route everything to their own blog.

## Consequences

- opnshelf is the **canonical renderer** for default-publication reviews at `opnshelf.xyz/@<handle>/<path>` and must serve those public pages.
- opnshelf writes (and the ingester must index) `site.standard.publication` records, a new collection alongside ratings and review documents.
- Override path: when a user points at an external publication, opnshelf does not control that publication's settings (e.g. discovery visibility, theme); it only writes documents that reference it.

## Follow-up: publication override (#118)

The override path above is specified as follows.

**Target scope.** The override may only point at another `site.standard.publication` that lives in the **user's own PDS** (same DID) — e.g. a Leaflet publication. Pointing at a publication owned by someone else, or at an arbitrary off-AT `https://` blog, is explicitly out of scope. This keeps opnshelf the canonical renderer (`opnshelf.xyz/@<handle>/<path>` still resolves and renders the document) and makes ownership verifiable by DID. The off-AT-blog case was rejected because it moves the canonical URL off opnshelf.xyz and breaks the renderer premise this ADR is built on.

**Selection & validation.** The user picks the target from a list opnshelf builds by enumerating `site.standard.publication` records in their own repo (`listRecords`), with the opnshelf-minted publication shown as the default. Enumeration is the validation: only the user's own, existing publications can be chosen, so there is no URI-pasting and no separate ownership/existence check. If the user has no other publications, the picker shows only the opnshelf default.

**Storage.** A nullable `User.reviewsPublicationUri` (with a cached `reviewsPublicationName` for display) holds the choice; `null` means "use the opnshelf default". This matches the existing per-user preference-column pattern. The live picker, not the cache, is the source of truth at selection time.

**Resolution in createReview.** `null` → lazily mint/return the opnshelf publication (unchanged behavior). Set → use the stored URI as the document `site` and **skip minting entirely**. Clearing the setting reverts to the opnshelf default (minting again if needed). The stored URI is **not** re-validated on every write: `site` is a pointer written with `validate:false`, and the canonical page resolves by (handle + path), so a stale/deleted target does not break opnshelf rendering — it only orphans the ecosystem grouping, which is the user's own repo to fix. The settings UI surfaces a soft warning when the picker re-lists and the stored target is no longer present.

**Switching with existing reviews.** On switch, opnshelf offers (opt-in) to re-point the user's already-published reviews. Re-pointing is best-effort sequential: each existing document is rewritten changing **only** `site` (and bumping `updatedAt`) while preserving title, content, `mediaLink`, and `path` — so the opnshelf canonical URL `@<handle>/<path>` is stable across the switch — and `Review.publicationUri` is updated. Partial failures are reported with a retry; there is no cross-PDS atomicity and no background queue. The opnshelf-minted publication record is **kept** regardless of the switch (it still hosts any reviews left under it and is needed if the user switches back).
