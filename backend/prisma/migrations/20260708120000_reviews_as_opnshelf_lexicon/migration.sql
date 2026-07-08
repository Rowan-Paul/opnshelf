-- ADR-0013: Reviews move from site.standard.document back to an
-- opnshelf-controlled xyz.opnshelf.review record, with an OPTIONAL
-- standard.site blog mirror.
--
-- Beta cutover (fresh start): existing document-backed reviews are NOT
-- migrated, so the dropped columns' data is intentionally discarded.
--
--   - Drops the standard.site document fields (path, description, textContent,
--     publicationUri) from Review.
--   - Adds the optional blog-mirror pointer (blogDocumentUri, blogDocumentCid).

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "path",
DROP COLUMN "description",
DROP COLUMN "textContent",
DROP COLUMN "publicationUri",
ADD COLUMN     "blogDocumentUri" TEXT,
ADD COLUMN     "blogDocumentCid" TEXT;
