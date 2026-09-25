CREATE TABLE "NotificationSettings" (
    "userDid" TEXT NOT NULL,
    "email" TEXT,
    "pendingEmail" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "emailIsCustom" BOOLEAN NOT NULL DEFAULT false,
    "emailCodeHash" TEXT,
    "emailCodeExpiresAt" TIMESTAMP(3),
    "emailCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "pushNewReleases" BOOLEAN NOT NULL DEFAULT false,
    "pushWatchlistReleases" BOOLEAN NOT NULL DEFAULT false,
    "pushNewSeasons" BOOLEAN NOT NULL DEFAULT false,
    "pushStats" BOOLEAN NOT NULL DEFAULT false,
    "pushInitialized" BOOLEAN NOT NULL DEFAULT false,
    "emailNewReleases" BOOLEAN NOT NULL DEFAULT true,
    "emailWatchlistReleases" BOOLEAN NOT NULL DEFAULT true,
    "emailNewSeasons" BOOLEAN NOT NULL DEFAULT true,
    "emailStats" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("userDid")
);

CREATE TABLE "PushDevice" (
    "token" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("token")
);

CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PushDevice_userDid_idx" ON "PushDevice"("userDid");
CREATE UNIQUE INDEX "NotificationDelivery_userDid_channel_eventKey_key" ON "NotificationDelivery"("userDid", "channel", "eventKey");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");

ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
