ALTER TABLE "User" ADD COLUMN "watchVisibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "User" ADD CONSTRAINT "User_watchVisibility_check" CHECK ("watchVisibility" IN ('public', 'private'));
CREATE TABLE "WatchPrivacyMigration" (
 "jobId" TEXT PRIMARY KEY REFERENCES "BackgroundJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "userDid" TEXT NOT NULL UNIQUE REFERENCES "User"("did") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sourceVisibility" TEXT NOT NULL,
 "targetVisibility" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WatchPrivacyMigration_direction_check" CHECK (
   ("sourceVisibility" = 'public' AND "targetVisibility" = 'private') OR
   ("sourceVisibility" = 'private' AND "targetVisibility" = 'public')
 )
);
CREATE FUNCTION prevent_watch_privacy_direction_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'Watch privacy migration identity and direction are immutable';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "WatchPrivacyMigration_immutable" BEFORE UPDATE ON "WatchPrivacyMigration"
FOR EACH ROW EXECUTE FUNCTION prevent_watch_privacy_direction_change();
