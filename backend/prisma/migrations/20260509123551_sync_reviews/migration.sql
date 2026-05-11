-- DropIndex
DROP INDEX "ListItem_listId_mediaType_mediaId_key";

-- RenameIndex
ALTER INDEX "ListItem_listId_mediaType_mediaId_seasonNumber_episodeNumber_ke" RENAME TO "ListItem_listId_mediaType_mediaId_seasonNumber_episodeNumbe_key";
