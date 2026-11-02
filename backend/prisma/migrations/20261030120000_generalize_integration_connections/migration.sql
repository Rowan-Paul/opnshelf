-- Trakt Sync state becomes the shared Integration state (ADR 0051).
-- Renames only: existing rows, links and baselines are kept and become provider 'trakt'.
ALTER TABLE "TraktSyncConnection" RENAME TO "IntegrationConnection";
ALTER TABLE "TraktSyncEntry" RENAME TO "IntegrationEntry";

ALTER TABLE "IntegrationConnection" RENAME COLUMN "traktUserId" TO "accountId";
ALTER TABLE "IntegrationConnection" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'trakt';
ALTER TABLE "IntegrationConnection" ALTER COLUMN "provider" DROP DEFAULT;

ALTER TABLE "IntegrationConnection" RENAME CONSTRAINT "TraktSyncConnection_pkey" TO "IntegrationConnection_pkey";
ALTER TABLE "IntegrationConnection" RENAME CONSTRAINT "TraktSyncConnection_userDid_fkey" TO "IntegrationConnection_userDid_fkey";
ALTER TABLE "IntegrationEntry" RENAME CONSTRAINT "TraktSyncEntry_pkey" TO "IntegrationEntry_pkey";
ALTER TABLE "IntegrationEntry" RENAME CONSTRAINT "TraktSyncEntry_connectionId_fkey" TO "IntegrationEntry_connectionId_fkey";

ALTER INDEX "TraktSyncEntry_connectionId_issue_idx" RENAME TO "IntegrationEntry_connectionId_issue_idx";
ALTER INDEX "TraktSyncEntry_connectionId_localKey_key" RENAME TO "IntegrationEntry_connectionId_localKey_key";
ALTER INDEX "TraktSyncEntry_connectionId_remoteKey_key" RENAME TO "IntegrationEntry_connectionId_remoteKey_key";

DROP INDEX "TraktSyncConnection_userDid_traktUserId_key";
CREATE UNIQUE INDEX "IntegrationConnection_userDid_provider_accountId_key" ON "IntegrationConnection"("userDid", "provider", "accountId");
DROP INDEX "TraktSyncConnection_status_nextRunAt_idx";
CREATE INDEX "IntegrationConnection_provider_status_nextRunAt_idx" ON "IntegrationConnection"("provider", "status", "nextRunAt");

-- One connected account per provider, so Trakt and another Integration can be connected together.
DROP INDEX "TraktSyncConnection_one_connected_account";
CREATE UNIQUE INDEX "IntegrationConnection_one_connected_account" ON "IntegrationConnection"("userDid", "provider") WHERE "status" <> 'disconnected';
