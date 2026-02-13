/*
  Warnings:

  - A unique constraint covering the columns `[rkey]` on the table `TrackedMovie` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "TrackedMovie_uri_key";

-- CreateTable
CREATE TABLE "MovieList" (
    "id" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT,
    "userDid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieListItem" (
    "id" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT,
    "listId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovieListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MovieList_rkey_key" ON "MovieList"("rkey");

-- CreateIndex
CREATE INDEX "MovieList_userDid_idx" ON "MovieList"("userDid");

-- CreateIndex
CREATE INDEX "MovieList_isDefault_idx" ON "MovieList"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "MovieList_userDid_slug_key" ON "MovieList"("userDid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "MovieListItem_rkey_key" ON "MovieListItem"("rkey");

-- CreateIndex
CREATE INDEX "MovieListItem_listId_idx" ON "MovieListItem"("listId");

-- CreateIndex
CREATE INDEX "MovieListItem_movieId_idx" ON "MovieListItem"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "MovieListItem_listId_movieId_key" ON "MovieListItem"("listId", "movieId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedMovie_rkey_key" ON "TrackedMovie"("rkey");

-- AddForeignKey
ALTER TABLE "MovieList" ADD CONSTRAINT "MovieList_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieListItem" ADD CONSTRAINT "MovieListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MovieList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieListItem" ADD CONSTRAINT "MovieListItem_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("movieId") ON DELETE CASCADE ON UPDATE CASCADE;
