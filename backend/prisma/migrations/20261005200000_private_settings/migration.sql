ALTER TABLE "User" ADD COLUMN "privateSettingsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "privateSettingsHasCopy" BOOLEAN NOT NULL DEFAULT false;
