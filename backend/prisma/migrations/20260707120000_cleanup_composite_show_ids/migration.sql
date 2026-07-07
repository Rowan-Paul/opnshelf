-- One-off cleanup for issue #158 (Top Gear shows wrong up next).
--
-- Before d088822 the dashboard shelf leaked composite MediaCard ids into the
-- watch flow, so TrackedEpisode rows were written with a composite showId of
-- the form "<showId>-<season>-<episode>" (e.g. "117648-5-3") instead of the
-- bare TMDB show id. Those rows never count towards the real show: the show
-- page's up-next anchor (most recent watchedDate per showId) stays stale and
-- stats are split across two "shows". d088822 only repairs a row lazily when
-- it is re-touched; this migration re-files the remaining legacy rows.
--
-- Semantics mirror the lazy repair in ShowsService.indexTrackedEpisode /
-- IngesterService: only showId is normalized (TMDB resolves "117648-5-3" by
-- its leading numeric segment); the row's own seasonNumber/episodeNumber were
-- always written correctly from the watch request and are preserved.
--
-- Ordering matters because TrackedEpisode.showId has an enforced FK to
-- Show(showId): the bare Show row must exist before the UPDATE.
--
-- Note on duplicates: TrackedEpisode has no unique constraint on
-- (userDid, showId, seasonNumber, episodeNumber) — identity is the PDS rkey,
-- and multiple rows per episode are legitimate rewatches. Re-filing therefore
-- cannot collide, and we deliberately do NOT delete/merge rows: each one
-- mirrors a PDS record, and a firehose replay would recreate (normalized) any
-- row we removed. The upsert-on-rkey writers keep things consistent.
--
-- Rows whose showId is not exactly three hyphen-separated numeric parts are
-- left untouched rather than guessed at. All statements are idempotent.

-- 1. Ensure a bare Show row exists for every composite show that still has
--    TrackedEpisode rows attached. The composite Show row carries the real
--    show's TMDB metadata (TMDB resolved the composite id when it was
--    created), so copying it is safe; syncShowMetadata refreshes it on the
--    next touch anyway.
INSERT INTO "Show" ("showId", "title", "posterPath", "backdropPath", "firstAirYear", "firstAirDate", "overview", "colors", "createdAt", "updatedAt")
SELECT DISTINCT ON (split_part(s."showId", '-', 1))
    split_part(s."showId", '-', 1),
    s."title",
    s."posterPath",
    s."backdropPath",
    s."firstAirYear",
    s."firstAirDate",
    s."overview",
    s."colors",
    s."createdAt",
    CURRENT_TIMESTAMP
FROM "Show" s
WHERE s."showId" ~ '^[0-9]+-[0-9]+-[0-9]+$'
  AND EXISTS (
    SELECT 1 FROM "TrackedEpisode" te WHERE te."showId" = s."showId"
  )
ORDER BY split_part(s."showId", '-', 1), s."updatedAt" DESC
ON CONFLICT ("showId") DO NOTHING;

-- 2. Re-file the composite TrackedEpisode rows onto the bare show id,
--    preserving their own seasonNumber/episodeNumber (same as the lazy
--    repair). The EXISTS guard is belt-and-braces for the FK: step 1
--    guarantees the target exists for every row matched here.
UPDATE "TrackedEpisode" te
SET "showId" = split_part(te."showId", '-', 1),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE te."showId" ~ '^[0-9]+-[0-9]+-[0-9]+$'
  AND EXISTS (
    SELECT 1 FROM "Show" s WHERE s."showId" = split_part(te."showId", '-', 1)
  );

-- 3. Remove composite Show rows that nothing references anymore, so the junk
--    entries stop surfacing. Guarded on every user-data table with a Show FK
--    (all ON DELETE CASCADE — an unguarded delete would destroy user data);
--    Season/Episode metadata under a deleted show cascades harmlessly.
DELETE FROM "Show" s
WHERE s."showId" ~ '^[0-9]+-[0-9]+-[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM "TrackedEpisode" te WHERE te."showId" = s."showId"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ListItem" li WHERE li."showId" = s."showId"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "LibraryItem" lib WHERE lib."showId" = s."showId"
  );
