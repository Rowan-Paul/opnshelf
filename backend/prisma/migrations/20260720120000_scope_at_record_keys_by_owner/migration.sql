-- AT Protocol record keys are unique within a repository and collection, not
-- globally. Preserve every cached record while changing identity to
-- (repository owner DID, record key).

-- ListItem previously derived its owner through List. Materialize that owner
-- before making the column required; the NOT NULL assertion intentionally
-- fails rather than guessing if an orphan somehow exists.
ALTER TABLE "ListItem" ADD COLUMN "userDid" TEXT;

UPDATE "ListItem" AS item
SET "userDid" = list."userDid"
FROM "List" AS list
WHERE item."listId" = list."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ListItem" WHERE "userDid" IS NULL) THEN
    RAISE EXCEPTION 'Cannot scope ListItem rkeys: orphaned rows have no repository owner';
  END IF;
END $$;

ALTER TABLE "ListItem" ALTER COLUMN "userDid" SET NOT NULL;

-- Build the owner-scoped identities before removing the global indexes so a
-- non-transactional migration runner never leaves these tables unconstrained.
CREATE UNIQUE INDEX "TrackedMovie_userDid_rkey_key" ON "TrackedMovie"("userDid", "rkey");
CREATE UNIQUE INDEX "TrackedEpisode_userDid_rkey_key" ON "TrackedEpisode"("userDid", "rkey");
CREATE UNIQUE INDEX "List_userDid_rkey_key" ON "List"("userDid", "rkey");
CREATE UNIQUE INDEX "ListItem_userDid_rkey_key" ON "ListItem"("userDid", "rkey");
CREATE UNIQUE INDEX "LibraryItem_userDid_rkey_key" ON "LibraryItem"("userDid", "rkey");
CREATE UNIQUE INDEX "Note_userDid_rkey_key" ON "Note"("userDid", "rkey");
CREATE UNIQUE INDEX "Review_userDid_rkey_key" ON "Review"("userDid", "rkey");
CREATE UNIQUE INDEX "Publication_userDid_rkey_key" ON "Publication"("userDid", "rkey");
CREATE UNIQUE INDEX "Rating_userDid_rkey_key" ON "Rating"("userDid", "rkey");
CREATE UNIQUE INDEX "ReviewLike_userDid_rkey_key" ON "ReviewLike"("userDid", "rkey");

CREATE INDEX "ListItem_userDid_idx" ON "ListItem"("userDid");

-- The historical Prisma migrations created these as unique indexes (not
-- table constraints). Drop them only after their scoped replacements exist.
DROP INDEX "TrackedMovie_rkey_key";
DROP INDEX "TrackedEpisode_rkey_key";
DROP INDEX "List_rkey_key";
DROP INDEX "ListItem_rkey_key";
DROP INDEX "LibraryItem_rkey_key";
DROP INDEX "Note_rkey_key";
DROP INDEX "Review_rkey_key";
DROP INDEX "Publication_rkey_key";
DROP INDEX "Rating_rkey_key";
DROP INDEX "ReviewLike_rkey_key";
