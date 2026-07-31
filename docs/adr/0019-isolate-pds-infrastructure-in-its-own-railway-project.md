# Isolate PDS infrastructure in its own Railway project

The `opnshelf-pds` Railway project owns Tranquil PDS, its dedicated Postgres database, PDS blobs in a Railway object-storage bucket, the mail relay, and PDS Operator. The existing `opnshelf` project retains Web, Server, Tap, and the application Postgres database. This boundary keeps account-hosting state and operations independently deployable from the OpnShelf application, at the cost of a one-time database and blob migration and public-API communication across projects.
