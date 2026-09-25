-- AlterTable
ALTER TABLE "NotificationDelivery" ADD COLUMN     "collectionId" TEXT;

-- CreateTable
CREATE TABLE "NotificationCollection" (
    "id" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCollection_userDid_eventKey_key" ON "NotificationCollection"("userDid", "eventKey");

-- AddForeignKey
ALTER TABLE "NotificationCollection" ADD CONSTRAINT "NotificationCollection_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "NotificationCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

