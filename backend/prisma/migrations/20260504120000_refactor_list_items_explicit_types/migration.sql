-- Add new columns with defaults
ALTER TABLE "ListItem" ADD COLUMN IF NOT EXISTS "seasonNumber" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ListItem" ADD COLUMN IF NOT EXISTS "episodeNumber" INTEGER NOT NULL DEFAULT 0;

-- Recreate MediaType enum with all values (works in a single transaction)
ALTER TYPE "MediaType" RENAME TO "MediaType_old";
CREATE TYPE "MediaType" AS ENUM ('movie', 'show', 'season', 'episode');
ALTER TABLE "ListItem" ALTER COLUMN "mediaType" TYPE "MediaType" USING "mediaType"::text::"MediaType";
DROP TYPE "MediaType_old";

-- Migrate show items with episode scope (e.g. "1399:season:2:episode:5")
UPDATE "ListItem"
SET
    "mediaType" = 'episode',
    "mediaId" = (regexp_match("mediaId", '^([^:]+):season:(\d+):episode:(\d+)$'))[1],
    "seasonNumber" = (regexp_match("mediaId", '^([^:]+):season:(\d+):episode:(\d+)$'))[2]::int,
    "episodeNumber" = (regexp_match("mediaId", '^([^:]+):season:(\d+):episode:(\d+)$'))[3]::int
WHERE "mediaType" = 'show'
  AND "mediaId" ~ '^[^:]+:season:\d+:episode:\d+$';

-- Migrate show items with season scope (e.g. "1399:season:2")
UPDATE "ListItem"
SET
    "mediaType" = 'season',
    "mediaId" = (regexp_match("mediaId", '^([^:]+):season:(\d+)$'))[1],
    "seasonNumber" = (regexp_match("mediaId", '^([^:]+):season:(\d+)$'))[2]::int
WHERE "mediaType" = 'show'
  AND "mediaId" ~ '^[^:]+:season:\d+$';

-- Drop old unique constraint and create new one
ALTER TABLE "ListItem" DROP CONSTRAINT IF EXISTS "ListItem_listId_mediaType_mediaId_key";
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_mediaType_mediaId_seasonNumber_episodeNumber_key"
    UNIQUE ("listId", "mediaType", "mediaId", "seasonNumber", "episodeNumber");
