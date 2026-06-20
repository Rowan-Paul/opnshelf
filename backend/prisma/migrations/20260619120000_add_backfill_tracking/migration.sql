-- Backfill/sync tracking for the "syncing your watch history…" indicator.
--
-- When a user signs in or up we register their repo with TAP, which backfills
-- their historical watch records asynchronously over the firehose. The shelf
-- had no way to know records were still arriving, so a new user landed on an
-- empty shelf with no feedback. These two nullable columns let the shelf derive
-- a sync state:
--   backfillStartedAt — stamped when addRepo runs at sign-in/up (NOT on the
--                       startup re-register sweep, so a deploy doesn't make
--                       every existing user appear to be syncing).
--   lastIngestAt      — bumped each time a movie/episode record is ingested.
--
-- Both are nullable with no default: existing users stay null (never "syncing"),
-- and the application stamps them explicitly going forward.
ALTER TABLE "User" ADD COLUMN "backfillStartedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastIngestAt" TIMESTAMP(3);
