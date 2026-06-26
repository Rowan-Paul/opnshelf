-- CreateEnum
CREATE TYPE "LibraryFormat" AS ENUM ('digital', 'bluray', 'bluray4k', 'dvd');

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT,
    "userDid" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "mediaId" TEXT NOT NULL,
    "format" "LibraryFormat" NOT NULL,
    "seasonNumber" INTEGER NOT NULL DEFAULT 0,
    "episodeNumber" INTEGER NOT NULL DEFAULT 0,
    "movieId" TEXT,
    "showId" TEXT,
    "boxSet" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_rkey_key" ON "LibraryItem"("rkey");

-- CreateIndex
CREATE INDEX "LibraryItem_userDid_idx" ON "LibraryItem"("userDid");

-- CreateIndex
CREATE INDEX "LibraryItem_mediaType_mediaId_idx" ON "LibraryItem"("mediaType", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_userDid_mediaType_mediaId_seasonNumber_episodeN_key" ON "LibraryItem"("userDid", "mediaType", "mediaId", "seasonNumber", "episodeNumber", "format");

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("movieId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("showId") ON DELETE CASCADE ON UPDATE CASCADE;
