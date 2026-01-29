-- CreateTable
CREATE TABLE "AuthSession" (
    "userDid" TEXT NOT NULL,
    "sessionData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("userDid")
);

-- CreateTable
CREATE TABLE "AuthState" (
    "key" TEXT NOT NULL,
    "stateData" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AuthSession_updatedAt_idx" ON "AuthSession"("updatedAt");

-- CreateIndex
CREATE INDEX "AuthState_expiresAt_idx" ON "AuthState"("expiresAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userDid_fkey" FOREIGN KEY ("userDid") REFERENCES "User"("did") ON DELETE CASCADE ON UPDATE CASCADE;
