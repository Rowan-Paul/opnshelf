CREATE UNIQUE INDEX "BackgroundJob_one_trakt_import_per_user_key"
ON "BackgroundJob" ("userDid")
WHERE "type" = 'trakt_import';
