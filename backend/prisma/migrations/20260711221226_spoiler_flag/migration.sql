-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "spoiler" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alwaysShowSpoilers" BOOLEAN NOT NULL DEFAULT false;
