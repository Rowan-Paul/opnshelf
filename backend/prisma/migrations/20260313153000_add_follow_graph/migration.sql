-- CreateTable
CREATE TABLE "Follow" (
    "followerDid" TEXT NOT NULL,
    "followingDid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerDid","followingDid")
);

-- CreateIndex
CREATE INDEX "Follow_followerDid_createdAt_idx" ON "Follow"("followerDid", "createdAt");

-- CreateIndex
CREATE INDEX "Follow_followingDid_createdAt_idx" ON "Follow"("followingDid", "createdAt");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerDid_fkey" FOREIGN KEY ("followerDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingDid_fkey" FOREIGN KEY ("followingDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
