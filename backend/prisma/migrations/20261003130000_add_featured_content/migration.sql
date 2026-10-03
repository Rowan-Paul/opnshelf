-- CreateTable
CREATE TABLE "FeaturedContent" (
    "id" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "seasonNumber" INTEGER,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "message" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceLabel" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeaturedContent_published_expiresAt_idx" ON "FeaturedContent"("published", "expiresAt");
