-- CreateTable
CREATE TABLE "Rating" (
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_rkey_key" ON "Rating"("rkey");

-- CreateIndex
CREATE INDEX "Rating_userDid_idx" ON "Rating"("userDid");

-- CreateIndex
CREATE INDEX "Rating_mediaType_mediaId_idx" ON "Rating"("mediaType", "mediaId");

-- CreateIndex
CREATE INDEX "Rating_rating_idx" ON "Rating"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userDid_mediaType_mediaId_seasonNumber_episodeNumber_key" ON "Rating"("userDid", "mediaType", "mediaId", "seasonNumber", "episodeNumber");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
