-- CreateTable
CREATE TABLE "WatchingCheckIn" (
    "userDid" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "finishingAt" TIMESTAMP(3),
    "retryAfter" TIMESTAMP(3),

    CONSTRAINT "WatchingCheckIn_pkey" PRIMARY KEY ("userDid")
);

-- CreateIndex
CREATE INDEX "WatchingCheckIn_endsAt_idx" ON "WatchingCheckIn"("endsAt");

-- AddForeignKey
ALTER TABLE "WatchingCheckIn" ADD CONSTRAINT "WatchingCheckIn_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
