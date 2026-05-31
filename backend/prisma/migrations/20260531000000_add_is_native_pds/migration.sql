-- Marks accounts created on opnshelf's own PDS (native signup). External OAuth
-- accounts authenticate against their own PDS and are verified upstream, so the
-- email-verification gate (needsEmailVerification) must never apply to them.
--
-- Defaulting existing rows to false is correct: the native signup flow is brand
-- new, so every pre-existing row is an external OAuth account. This also heals
-- external accounts whose emailVerifiedAt was left null before the verified-on-
-- creation logic existed, since the gate now requires isNativePds = true.
ALTER TABLE "User" ADD COLUMN "isNativePds" BOOLEAN NOT NULL DEFAULT false;
