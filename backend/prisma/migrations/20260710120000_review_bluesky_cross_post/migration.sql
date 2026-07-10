ALTER TABLE "Review"
ADD COLUMN "blueskyPostUri" TEXT,
ADD COLUMN "blueskyPostCid" TEXT;

-- The new OAuth scope cannot be added to already-issued grants. OpnShelf is in
-- beta, so deliberately require every active client to sign in again.
DELETE FROM "AuthSession";
