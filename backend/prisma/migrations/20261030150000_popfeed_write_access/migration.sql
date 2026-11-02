-- External Integration Access for writing Popfeed records (ADR 0030, ADR 0051).
ALTER TABLE "User" ADD COLUMN "popfeedWriteEnabled" BOOLEAN NOT NULL DEFAULT false;
