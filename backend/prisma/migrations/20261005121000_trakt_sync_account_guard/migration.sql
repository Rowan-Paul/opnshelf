-- Retained disconnected accounts have separate links; only one can be connected.
CREATE UNIQUE INDEX "TraktSyncConnection_one_connected_account" ON "TraktSyncConnection"("userDid") WHERE "status" <> 'disconnected';
