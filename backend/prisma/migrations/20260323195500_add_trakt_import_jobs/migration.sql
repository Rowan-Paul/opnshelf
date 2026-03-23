-- CreateEnum
CREATE TYPE "TraktImportJobStatus" AS ENUM ('queued', 'running', 'waiting_retry', 'completed', 'failed');

-- CreateTable
CREATE TABLE "TraktImportJob" (
    "id" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "traktUsername" TEXT NOT NULL,
    "status" "TraktImportJobStatus" NOT NULL DEFAULT 'queued',
    "currentPage" INTEGER NOT NULL DEFAULT 1,
    "totalPages" INTEGER,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "normalizedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "profileUsername" TEXT,
    "profileSlug" TEXT,
    "profileName" TEXT,
    "profileAvatarUrl" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraktImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraktImportJob_userDid_status_idx" ON "TraktImportJob"("userDid", "status");

-- CreateIndex
CREATE INDEX "TraktImportJob_status_nextRunAt_idx" ON "TraktImportJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "TraktImportJob_userDid_createdAt_idx" ON "TraktImportJob"("userDid", "createdAt");

-- AddForeignKey
ALTER TABLE "TraktImportJob" ADD CONSTRAINT "TraktImportJob_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
