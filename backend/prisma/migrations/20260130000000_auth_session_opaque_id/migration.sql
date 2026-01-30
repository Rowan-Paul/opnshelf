-- Add opaque id column to AuthSession (cookie will store this instead of DID)
ALTER TABLE "AuthSession" ADD COLUMN "id" TEXT;

-- Backfill id for existing rows
UPDATE "AuthSession" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;

-- Make id NOT NULL and primary, make userDid unique
ALTER TABLE "AuthSession" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "AuthSession" DROP CONSTRAINT "AuthSession_pkey";
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "AuthSession_userDid_key" ON "AuthSession"("userDid");
