-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "mediaId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL DEFAULT 0,
    "episodeNumber" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_rkey_key" ON "Review"("rkey");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userDid_mediaType_mediaId_seasonNumber_episodeNumber_key" ON "Review"("userDid", "mediaType", "mediaId", "seasonNumber", "episodeNumber");

-- CreateIndex
CREATE INDEX "Review_userDid_idx" ON "Review"("userDid");

-- CreateIndex
CREATE INDEX "Review_mediaType_mediaId_idx" ON "Review"("mediaType", "mediaId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
