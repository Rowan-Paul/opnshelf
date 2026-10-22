DROP TABLE "TraktImportItem";
DROP TABLE "TraktImportMatch";
DELETE FROM "BackgroundJob" WHERE "type" IN ('trakt_import', 'trakt_import_archived_duplicate');
DROP INDEX IF EXISTS "BackgroundJob_one_trakt_import_per_user_key";
