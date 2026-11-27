# ADR 0054: Check-ins create Watches on completion

Status: Accepted

A Watching Check-in is temporary Opnshelf state for one movie or episode per
User. The AppView stores it separately from Watches, so starting, replacing or
cancelling a check-in creates no repository record.

The server calculates the end time from the catalogue runtime. If runtime is
unavailable, the User ends or cancels the check-in manually. Home-screen widgets
continue to read completed Watches.

Finishing early and reaching the end both use the Watch write coordinator and
the User's current Shelf visibility. The same record key survives retries,
including a retry after the PDS accepted the write. The resulting Watch is
dated at check-in start. Publication and local indexing follow the ordinary
Watch path.

Outside the owner's session, only active check-ins for a Public Shelf without
a running Watch Privacy Migration are visible. The Activity Feed restricts
these to the viewer's follows and respects its Circle filter.
