-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blueskyProfileUrl" TEXT,
ADD COLUMN     "showBlueskyOnProfile" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showTangledOnProfile" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tangledProfileUrl" TEXT;
