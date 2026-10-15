ALTER TABLE "TraktSyncConnection"
  ADD COLUMN "lists" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "watchlist" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "listPublicationConsent" BOOLEAN NOT NULL DEFAULT false;
