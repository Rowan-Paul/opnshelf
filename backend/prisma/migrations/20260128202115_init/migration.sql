-- CreateTable
CREATE TABLE "User" (
    "did" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("did")
);

-- CreateTable
CREATE TABLE "Movie" (
    "movieId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "releaseYear" INTEGER,
    "releaseDate" TIMESTAMP(3),
    "overview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("movieId")
);

-- CreateTable
CREATE TABLE "TrackedMovie" (
    "id" TEXT NOT NULL,
    "rkey" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "userDid" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'watched',
    "watchedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedMovie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX "User_handle_idx" ON "User"("handle");

-- CreateIndex
CREATE INDEX "Movie_title_idx" ON "Movie"("title");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedMovie_uri_key" ON "TrackedMovie"("uri");

-- CreateIndex
CREATE INDEX "TrackedMovie_userDid_idx" ON "TrackedMovie"("userDid");

-- CreateIndex
CREATE INDEX "TrackedMovie_movieId_idx" ON "TrackedMovie"("movieId");

-- CreateIndex
CREATE INDEX "TrackedMovie_status_idx" ON "TrackedMovie"("status");

-- CreateIndex
CREATE INDEX "TrackedMovie_createdAt_idx" ON "TrackedMovie"("createdAt");

-- CreateIndex
CREATE INDEX "TrackedMovie_watchedDate_idx" ON "TrackedMovie"("watchedDate");

-- CreateIndex
CREATE INDEX "TrackedMovie_uri_idx" ON "TrackedMovie"("uri");

-- CreateIndex
CREATE INDEX "TrackedMovie_cid_idx" ON "TrackedMovie"("cid");

-- AddForeignKey
ALTER TABLE "TrackedMovie" ADD CONSTRAINT "TrackedMovie_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedMovie" ADD CONSTRAINT "TrackedMovie_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("movieId") ON DELETE CASCADE ON UPDATE CASCADE;
