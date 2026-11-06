-- Delivery still requires a registered mobile device with OS notification permission.
ALTER TABLE "NotificationSettings" ADD COLUMN "pushSyncErrors" BOOLEAN NOT NULL DEFAULT true;
