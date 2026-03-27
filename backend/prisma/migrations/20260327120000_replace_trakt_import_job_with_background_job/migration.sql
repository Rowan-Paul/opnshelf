-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "data" JSONB NOT NULL DEFAULT '{}',
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- Migrate TraktImportJob data into BackgroundJob
INSERT INTO "BackgroundJob" ("id", "type", "userDid", "status", "data", "nextRunAt", "lastError", "startedAt", "completedAt", "createdAt", "updatedAt")
SELECT
    "id",
    'trakt_import',
    "userDid",
    "status"::text,
    jsonb_build_object(
        'traktUsername', "traktUsername",
        'currentPage', "currentPage",
        'totalPages', "totalPages",
        'sourceCount', "sourceCount",
        'normalizedCount', "normalizedCount",
        'importedCount', "importedCount",
        'skippedCount', "skippedCount",
        'failedCount', "failedCount",
        'profileUsername', "profileUsername",
        'profileSlug', "profileSlug",
        'profileName', "profileName",
        'profileAvatarUrl', "profileAvatarUrl"
    ),
    "nextRunAt",
    "lastError",
    "startedAt",
    "completedAt",
    "createdAt",
    "updatedAt"
FROM "TraktImportJob";

-- DropTable
DROP TABLE "TraktImportJob";

-- DropEnum
DROP TYPE "TraktImportJobStatus";

-- CreateIndex
CREATE INDEX "BackgroundJob_type_status_nextRunAt_idx" ON "BackgroundJob"("type", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_userDid_type_idx" ON "BackgroundJob"("userDid", "type");
