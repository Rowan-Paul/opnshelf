-- Per-review blog-mirror opt-out (ADR-0013). Defaults to mirror; false excludes
-- a single review from the blog even when a publication is configured.
ALTER TABLE "Review" ADD COLUMN "mirrorToBlog" BOOLEAN NOT NULL DEFAULT true;
