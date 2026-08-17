-- The previous application-level check could race, so existing databases may
-- contain duplicates. Preserve every job and its durable item/match ledger,
-- but deterministically archive all except the most valuable job per user.
-- Completed history wins, followed by jobs furthest through active processing;
-- timestamps and id provide stable tie-breakers.
WITH "ranked_trakt_imports" AS (
	SELECT
		"id",
		ROW_NUMBER() OVER (
			PARTITION BY "userDid"
			ORDER BY
				CASE "status"
					WHEN 'completed' THEN 0
					WHEN 'running' THEN 1
					WHEN 'waiting_retry' THEN 2
					WHEN 'paused' THEN 3
					WHEN 'queued' THEN 4
					WHEN 'failed' THEN 5
					ELSE 6
				END,
				"updatedAt" DESC,
				"createdAt" ASC,
				"id" ASC
		) AS "duplicate_rank"
	FROM "BackgroundJob"
	WHERE "type" = 'trakt_import'
)
UPDATE "BackgroundJob" AS "job"
SET "type" = 'trakt_import_archived_duplicate'
FROM "ranked_trakt_imports" AS "ranked"
WHERE "job"."id" = "ranked"."id"
	AND "ranked"."duplicate_rank" > 1;

CREATE UNIQUE INDEX "BackgroundJob_one_trakt_import_per_user_key"
ON "BackgroundJob" ("userDid")
WHERE "type" = 'trakt_import';
