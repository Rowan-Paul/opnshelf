-- ADR-0014: the reader format for a blog mirror is an explicit user choice.
CREATE TYPE "BlogMirrorFormat" AS ENUM ('markdown', 'leaflet');

ALTER TABLE "User"
ADD COLUMN "reviewsMirrorFormat" "BlogMirrorFormat" NOT NULL DEFAULT 'markdown';
