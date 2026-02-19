-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('movie', 'show');

-- DropForeignKey
ALTER TABLE "MovieListItem" DROP CONSTRAINT "MovieListItem_listId_fkey";

-- DropForeignKey
ALTER TABLE "MovieListItem" DROP CONSTRAINT "MovieListItem_movieId_fkey";

-- DropTable
DROP TABLE "MovieListItem";

-- CreateTable
CREATE TABLE "Show" (
    "showId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "firstAirYear" INTEGER,
    "firstAirDate" TIMESTAMP(3),
    "overview" TEXT,
    "colors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("showId")
);

-- CreateTable
CREATE TABLE "TrackedEpisode" (
    "id" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'watched',
    "watchedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListItem" (
    "id" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT,
    "listId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "mediaId" TEXT NOT NULL,
    "movieId" TEXT,
    "showId" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Show_title_idx" ON "Show"("title");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedEpisode_rkey_key" ON "TrackedEpisode"("rkey");

-- CreateIndex
CREATE INDEX "TrackedEpisode_userDid_idx" ON "TrackedEpisode"("userDid");

-- CreateIndex
CREATE INDEX "TrackedEpisode_showId_idx" ON "TrackedEpisode"("showId");

-- CreateIndex
CREATE INDEX "TrackedEpisode_seasonNumber_idx" ON "TrackedEpisode"("seasonNumber");

-- CreateIndex
CREATE INDEX "TrackedEpisode_episodeNumber_idx" ON "TrackedEpisode"("episodeNumber");

-- CreateIndex
CREATE INDEX "TrackedEpisode_status_idx" ON "TrackedEpisode"("status");

-- CreateIndex
CREATE INDEX "TrackedEpisode_createdAt_idx" ON "TrackedEpisode"("createdAt");

-- CreateIndex
CREATE INDEX "TrackedEpisode_watchedDate_idx" ON "TrackedEpisode"("watchedDate");

-- CreateIndex
CREATE INDEX "TrackedEpisode_uri_idx" ON "TrackedEpisode"("uri");

-- CreateIndex
CREATE INDEX "TrackedEpisode_cid_idx" ON "TrackedEpisode"("cid");

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_rkey_key" ON "ListItem"("rkey");

-- CreateIndex
CREATE INDEX "ListItem_listId_idx" ON "ListItem"("listId");

-- CreateIndex
CREATE INDEX "ListItem_mediaType_mediaId_idx" ON "ListItem"("mediaType", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_listId_mediaType_mediaId_key" ON "ListItem"("listId", "mediaType", "mediaId");

-- AddForeignKey
ALTER TABLE "TrackedEpisode" ADD CONSTRAINT "TrackedEpisode_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedEpisode" ADD CONSTRAINT "TrackedEpisode_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("showId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MovieList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("movieId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("showId") ON DELETE CASCADE ON UPDATE CASCADE;

