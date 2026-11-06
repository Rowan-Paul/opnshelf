-- Delivery still requires a registered mobile device with OS notification permission.
ALTER TABLE "NotificationSettings" ADD COLUMN "pushSyncErrors" BOOLEAN NOT NULL DEFAULT true;

-- Existing failures start their episode at deploy time.
ALTER TABLE "IntegrationConnection" ADD COLUMN "failingSince" TIMESTAMP(3);
UPDATE "IntegrationConnection" SET "failingSince" = CURRENT_TIMESTAMP
WHERE "status" = 'reconnect' OR ("status" = 'active' AND "lastError" IS NOT NULL);
