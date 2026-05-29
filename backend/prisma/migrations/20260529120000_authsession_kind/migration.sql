-- Add a discriminator so AuthSession can hold either an OAuth session
-- (NodeSavedSession) or a credential session (createAccount tokens).
ALTER TABLE "AuthSession" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'oauth';
