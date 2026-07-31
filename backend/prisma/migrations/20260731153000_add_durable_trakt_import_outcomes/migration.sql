CREATE TABLE "TraktImportItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceIndex" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "watchedAt" TIMESTAMP(3),
    "title" TEXT,
    "year" INTEGER,
    "episodeTitle" TEXT,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "traktMediaKey" TEXT,
    "traktId" TEXT,
    "traktSlug" TEXT,
    "tmdbId" TEXT,
    "reason" TEXT,
    "message" TEXT,
    "createdWatchRkey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TraktImportItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TraktImportMatch" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TraktImportMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TraktImportItem_jobId_sourceIndex_key" ON "TraktImportItem"("jobId", "sourceIndex");
CREATE INDEX "TraktImportItem_jobId_outcome_sourceIndex_idx" ON "TraktImportItem"("jobId", "outcome", "sourceIndex");
CREATE INDEX "TraktImportItem_jobId_traktMediaKey_idx" ON "TraktImportItem"("jobId", "traktMediaKey");
CREATE UNIQUE INDEX "TraktImportMatch_jobId_matchKey_key" ON "TraktImportMatch"("jobId", "matchKey");
CREATE INDEX "TraktImportMatch_jobId_idx" ON "TraktImportMatch"("jobId");

ALTER TABLE "TraktImportItem"
ADD CONSTRAINT "TraktImportItem_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TraktImportMatch"
ADD CONSTRAINT "TraktImportMatch_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
