-- My Services: TMDB watch-provider ids the user subscribes to, chosen for
-- their watch country (issue #363). Empty means "not chosen".
ALTER TABLE "User" ADD COLUMN     "streamingServiceIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
