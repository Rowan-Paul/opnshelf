-- AlterTable
ALTER TABLE "User"
ADD COLUMN "profileRkey" TEXT,
ADD COLUMN "profileUri" TEXT,
ADD COLUMN "profileCid" TEXT,
ADD COLUMN "profileDisplayName" TEXT,
ADD COLUMN "profileAvatarCid" TEXT,
ADD COLUMN "profileAvatarMimeType" TEXT,
ADD COLUMN "profileUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_profileAvatarCid_idx" ON "User"("profileAvatarCid");
