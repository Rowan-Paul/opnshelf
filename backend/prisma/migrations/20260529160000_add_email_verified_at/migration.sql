-- Mirror the PDS email-verification status so /auth/me stays a pure DB read.
-- Null means the (native) account has not yet verified its email; external
-- OAuth accounts are stamped verified on creation. See
-- docs/adr/0004-verify-email-before-seeding-records.md.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
