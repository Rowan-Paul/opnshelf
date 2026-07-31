-- Integration grants are account-wide and independent of their saved config.
ALTER TABLE "User"
  ADD COLUMN "blogIntegrationEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "blueskyCrossPostEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Existing OAuth sessions were issued with the retired broad scope set. Force
-- them through Core OAuth once; preserve unverified native bootstrap sessions
-- so they can still complete email verification.
DELETE FROM "AuthSession"
WHERE kind = 'oauth'
   OR (kind = 'credential' AND EXISTS (
     SELECT 1 FROM "User"
     WHERE "User".did = "AuthSession"."userDid"
       AND "User"."emailVerifiedAt" IS NOT NULL
   ));
