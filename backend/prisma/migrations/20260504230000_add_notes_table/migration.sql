-- Create Note table
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "mediaId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL DEFAULT 0,
    "episodeNumber" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- Create unique index for one note per user per media item
CREATE UNIQUE INDEX "Note_userDid_mediaType_mediaId_seasonNumber_episodeNumber_key" ON "Note"("userDid", "mediaType", "mediaId", "seasonNumber", "episodeNumber");

-- Create other indexes
CREATE UNIQUE INDEX "Note_rkey_key" ON "Note"("rkey");
CREATE INDEX "Note_userDid_idx" ON "Note"("userDid");
CREATE INDEX "Note_mediaType_mediaId_idx" ON "Note"("mediaType", "mediaId");

-- Add foreign key to User
ALTER TABLE "Note" ADD CONSTRAINT "Note_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
