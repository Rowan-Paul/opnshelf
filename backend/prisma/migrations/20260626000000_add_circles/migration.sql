-- Circles: private, personal groupings of followed Users for feed filtering.
-- Local-only, never federated to a PDS (ADR-0010). CircleMember is keyed to the
-- Follow row via a composite FK so unfollowing cascade-drops membership.

CREATE TABLE "Circle" (
    "id" TEXT NOT NULL,
    "ownerDid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CircleMember" (
    "circleId" TEXT NOT NULL,
    "followerDid" TEXT NOT NULL,
    "followingDid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleMember_pkey" PRIMARY KEY ("circleId","followingDid")
);

CREATE INDEX "Circle_ownerDid_idx" ON "Circle"("ownerDid");
CREATE UNIQUE INDEX "Circle_ownerDid_name_key" ON "Circle"("ownerDid", "name");
CREATE INDEX "CircleMember_followingDid_idx" ON "CircleMember"("followingDid");
CREATE INDEX "CircleMember_followerDid_followingDid_idx" ON "CircleMember"("followerDid", "followingDid");

ALTER TABLE "Circle" ADD CONSTRAINT "Circle_ownerDid_fkey" FOREIGN KEY ("ownerDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_followerDid_followingDid_fkey" FOREIGN KEY ("followerDid", "followingDid") REFERENCES "Follow"("followerDid", "followingDid") ON DELETE CASCADE ON UPDATE CASCADE;
