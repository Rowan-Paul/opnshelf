-- Persist the account-wide, one-time AT Store review request. The rkey is
-- reserved before publishing so an ambiguous PDS response can be retried
-- without creating a second review record.
ALTER TABLE "User"
ADD COLUMN "atStoreReviewHandledAt" TIMESTAMP(3),
ADD COLUMN "atStoreReviewRkey" TEXT;
