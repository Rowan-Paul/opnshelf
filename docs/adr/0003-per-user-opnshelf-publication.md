# ADR 0003: opnshelf mints a per-user publication by default

A `site.standard.document` must reference a `site` — a `site.standard.publication` — and that reference determines which blog the review surfaces on. By default opnshelf **lazily mints one `site.standard.publication` per user** (on their first review, not at signup) into the user's own PDS, with `url: opnshelf.xyz/@<handle>` and a stable literal rkey so the URI is predictable and idempotent. A user who already owns a publication elsewhere can override the target via a per-user setting, in which case opnshelf does not mint one and points reviews' `site` at their publication instead.

## Why

The alternatives were worse. Requiring users to bring an external publication would make reviewing impossible for the majority who don't run a blog. Using a single shared opnshelf-wide publication would put every user's reviews under one identity and one PDS, breaking the "your data travels with you" principle and the per-author canonical URL. Minting a per-user publication in the user's own PDS means anyone can review out of the box, the reviews are portable and discoverable as that user's publication, and power users can still route everything to their own blog.

## Consequences

- opnshelf is the **canonical renderer** for default-publication reviews at `opnshelf.xyz/@<handle>/<path>` and must serve those public pages.
- opnshelf writes (and the ingester must index) `site.standard.publication` records, a new collection alongside ratings and review documents.
- Override path: when a user points at an external publication, opnshelf does not control that publication's settings (e.g. discovery visibility, theme); it only writes documents that reference it.
