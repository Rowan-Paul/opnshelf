-- CreateTable
CREATE TABLE "TraktSyncConnection" (
    "id" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "traktUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'paused',
    "direction" TEXT NOT NULL DEFAULT 'both',
    "watches" BOOLEAN NOT NULL DEFAULT true,
    "ratings" BOOLEAN NOT NULL DEFAULT true,
    "historyScope" TEXT NOT NULL DEFAULT 'all',
    "publicationConsent" BOOLEAN NOT NULL DEFAULT false,
    "initialised" BOOLEAN NOT NULL DEFAULT false,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "leaseId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "remoteSnapshot" JSONB NOT NULL DEFAULT '[]',
    "remoteReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraktSyncConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraktSyncEntry" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "localKey" TEXT,
    "remoteKey" TEXT,
    "localBase" JSONB,
    "remoteBase" JSONB,
    "linked" BOOLEAN NOT NULL DEFAULT false,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "issue" TEXT,
    "resolution" TEXT,
    "pending" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraktSyncEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraktSyncConnection_status_nextRunAt_idx" ON "TraktSyncConnection"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "TraktSyncConnection_userDid_traktUserId_key" ON "TraktSyncConnection"("userDid", "traktUserId");

-- CreateIndex
CREATE INDEX "TraktSyncEntry_connectionId_issue_idx" ON "TraktSyncEntry"("connectionId", "issue");

-- CreateIndex
CREATE UNIQUE INDEX "TraktSyncEntry_connectionId_localKey_key" ON "TraktSyncEntry"("connectionId", "localKey");

-- CreateIndex
CREATE UNIQUE INDEX "TraktSyncEntry_connectionId_remoteKey_key" ON "TraktSyncEntry"("connectionId", "remoteKey");

-- AddForeignKey
ALTER TABLE "TraktSyncConnection" ADD CONSTRAINT "TraktSyncConnection_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraktSyncEntry" ADD CONSTRAINT "TraktSyncEntry_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TraktSyncConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
