-- DropIndex
DROP INDEX "Publication_userDid_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reviewsPublicationName" TEXT,
ADD COLUMN     "reviewsPublicationUri" TEXT;
