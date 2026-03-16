-- AlterTable
ALTER TABLE "Follow"
ADD COLUMN "rkey" TEXT,
ADD COLUMN "uri" TEXT,
ADD COLUMN "cid" TEXT;

-- CreateIndex
CREATE INDEX "Follow_followerDid_rkey_idx" ON "Follow"("followerDid", "rkey");
