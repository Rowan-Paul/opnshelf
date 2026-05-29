/*
  Warnings:

  - You are about to drop the column `content` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `Review` table. All the data in the column will be lost.
  - Added the required column `markdown` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publicationUri` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Review_rating_idx";

-- DropIndex
DROP INDEX "Review_userDid_mediaType_mediaId_seasonNumber_episodeNumber_key";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "content",
DROP COLUMN "rating",
ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "markdown" TEXT NOT NULL,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "publicationUri" TEXT NOT NULL,
ADD COLUMN     "textContent" TEXT,
ADD COLUMN     "title" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Publication_rkey_key" ON "Publication"("rkey");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_userDid_key" ON "Publication"("userDid");

-- CreateIndex
CREATE INDEX "Publication_userDid_idx" ON "Publication"("userDid");

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
