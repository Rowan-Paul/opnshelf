-- Allow multiple sessions per user — one per device.
--
-- Previously AuthSession.userDid was unique, so signing in on a second device
-- overwrote the first device's row (and its OAuth/credential token family),
-- racing the single-use refresh token and logging the first device out. The
-- opaque `id` (the cookie/Bearer value) is now the per-device key; userDid is
-- only indexed, not unique. Existing rows are untouched.
DROP INDEX "AuthSession_userDid_key";
CREATE INDEX "AuthSession_userDid_idx" ON "AuthSession"("userDid");
