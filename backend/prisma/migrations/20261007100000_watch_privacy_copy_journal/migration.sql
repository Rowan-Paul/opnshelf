CREATE TABLE "WatchPrivacyCopy" (
    "jobId" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchPrivacyCopy_pkey" PRIMARY KEY ("jobId", "collection", "rkey"),
    CONSTRAINT "WatchPrivacyCopy_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WatchPrivacyCopy_collection_check" CHECK ("collection" IN ('xyz.opnshelf.movie', 'xyz.opnshelf.episode'))
);
