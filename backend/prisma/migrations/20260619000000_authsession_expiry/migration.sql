-- Server-side session expiry for AuthSession.
--
-- Previously a session record had no expiry, so the auth guard accepted any
-- existing row: a captured Bearer token (mobile) or copied cookie value stayed
-- valid indefinitely until explicit logout. We add an absolute lifetime that
-- the guard enforces (expiresAt <= now => unauthenticated), aligned with the
-- 14-day session cookie maxAge.
--
-- Backfill strategy: both columns default to now() at the DB level so this
-- migration is safe to run against a populated table. Existing rows get a
-- fresh 14-day window from the moment the migration runs (they would otherwise
-- have no expiry at all), which then slides forward on use like any new
-- session. The application always sets expiresAt = now + 14d explicitly on
-- write; the DB default only covers the backfill.
ALTER TABLE "AuthSession" ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AuthSession" ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
