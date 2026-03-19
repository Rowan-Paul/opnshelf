ALTER TABLE "MovieList" RENAME TO "List";

ALTER TABLE "List" RENAME CONSTRAINT "MovieList_pkey" TO "List_pkey";
ALTER TABLE "List" RENAME CONSTRAINT "MovieList_userDid_fkey" TO "List_userDid_fkey";

ALTER INDEX "MovieList_rkey_key" RENAME TO "List_rkey_key";
ALTER INDEX "MovieList_userDid_idx" RENAME TO "List_userDid_idx";
ALTER INDEX "MovieList_isDefault_idx" RENAME TO "List_isDefault_idx";
ALTER INDEX "MovieList_userDid_slug_key" RENAME TO "List_userDid_slug_key";
