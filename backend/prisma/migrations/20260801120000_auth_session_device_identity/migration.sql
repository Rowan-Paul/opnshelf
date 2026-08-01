-- Device identity for auth sessions (ADR-0015).
--
-- deviceId is NOT NULL so every session is addressable by the Devices screen,
-- including the ones that predate this migration. Those get a random id here and
-- read as "Unknown device" until their client stamps a real one; the random value
-- is unique per row, so the takeover deleteMany can never mistake two backfilled
-- rows for the same install.
ALTER TABLE "AuthSession" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN "deviceName" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN "devicePlatform" TEXT;

UPDATE "AuthSession" SET "deviceId" = gen_random_uuid()::TEXT WHERE "deviceId" IS NULL;

ALTER TABLE "AuthSession" ALTER COLUMN "deviceId" SET NOT NULL;
