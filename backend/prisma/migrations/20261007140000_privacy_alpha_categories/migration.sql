ALTER TABLE "User" ADD COLUMN "listsDefaultVisibility" TEXT NOT NULL DEFAULT 'public';
CREATE TABLE "PrivacyScope" (
 "id" TEXT PRIMARY KEY, "userDid" TEXT NOT NULL REFERENCES "User"("did") ON DELETE CASCADE,
 "key" TEXT NOT NULL, "category" TEXT NOT NULL, "listRkey" TEXT,
 "visibility" TEXT NOT NULL DEFAULT 'public', "managed" BOOLEAN NOT NULL DEFAULT false,
 "migrationId" TEXT UNIQUE, "targetVisibility" TEXT, "status" TEXT, "error" TEXT,
 "syncAttemptedAt" TIMESTAMP(3), "syncedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PrivacyScope_userDid_key_key" UNIQUE ("userDid", "key"),
 CONSTRAINT "PrivacyScope_visibility_check" CHECK ("visibility" IN ('public','private')),
 CONSTRAINT "PrivacyScope_target_check" CHECK ("targetVisibility" IS NULL OR "targetVisibility" IN ('public','private'))
);
CREATE INDEX "PrivacyScope_status_updatedAt_idx" ON "PrivacyScope"("status", "updatedAt");
CREATE TABLE "PrivacyCopy" (
 "scopeId" TEXT NOT NULL REFERENCES "PrivacyScope"("id") ON DELETE CASCADE,
 "migrationId" TEXT NOT NULL, "collection" TEXT NOT NULL, "rkey" TEXT NOT NULL,
 "cid" TEXT NOT NULL, "value" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("scopeId", "collection", "rkey")
);
