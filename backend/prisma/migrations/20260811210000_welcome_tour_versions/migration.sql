-- Welcome Tour seen-state, one version per client (ADR 0024).
-- 0 means "never taken", so every existing user gets the tour once.
ALTER TABLE "User" ADD COLUMN     "welcomeTourWebVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "welcomeTourMobileVersion" INTEGER NOT NULL DEFAULT 0;
