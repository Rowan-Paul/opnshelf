-- Add onboarding completion timestamp for web onboarding flow.
ALTER TABLE "User"
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Existing users should bypass onboarding.
UPDATE "User"
SET "onboardingCompletedAt" = NOW()
WHERE "onboardingCompletedAt" IS NULL;
