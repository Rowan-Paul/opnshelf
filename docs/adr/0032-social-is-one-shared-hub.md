# ADR 0032: Social is one shared hub

Status: Accepted and implemented (issue #278).

Issue [#278](https://github.com/Rowan-Paul/opnshelf/issues/278) revisits the split between Activity and Connections: their purposes are unclear as peer destinations, and both feel like supporting pages of one social hub. **Social** replaces them as one top-level destination on both Web and Mobile, opening directly onto the **Activity Feed** with visible **Find people** and **Circles** entry points. For a User following nobody, finding people becomes the primary content.

This supersedes ADR 0012's two-destination decision and its rejection of a single Social destination. We accept combining reading and connection management to give social features a clear shared home, while making the feed primary rather than adding an overview page before it. The feed remains reverse-chronological Watches and Reviews from followed Users, optionally filtered by Circle; this change does not introduce recommended activity from unfollowed Users.

## Navigation and supporting pages

- Main navigation is Home · Discover · Social · Profile on both clients. The removed slot is not replaced with another destination.
- Social opens at `/social`. Find people (`/social/find`) and Circles (`/social/circles`) are supporting pages rather than internal tabs. Returning from them preserves the feed's scroll position and selected Circle.
- Remove `/activity` and `/connections` without redirects. Existing external links to those routes stop working by explicit operator choice; update internal links to the new destinations.
- Full Following/Followers lists remain canonical on Profile. Find people links to those lists; the Social feed does not carry recent-following/follower avatar previews.

## Supporting behavior

Find people contains search, suggested Users, and links to Following/Followers on Profile. Circles contains the owned Circle list and creation action, leading to the existing member editor at `/social/circles/{circleId}` on both clients, with rename and delete controls. Circle filtering remains on the feed, and management is available even when no Circles exist.

Both clients support feed pagination and refresh the feed after follow/unfollow or Circle changes, preserving loaded content and position where possible. On Web, Social keys scroll restoration by URL rather than by history entry, so returning from a supporting page restores the feed position the same way the Mobile tab stays mounted. Empty states distinguish following nobody (search and suggestions), followed Users with no activity (explanation and Find people), and an empty selected Circle (Manage Circle and Show all activity).

One Social step replaces the separate Connections and Activity Welcome Tour steps. This partially supersedes ADR 0024's step list; existing Users do not have the full tour replayed for this change, and manual replay remains available in Settings.

Other decisions in ADRs 0012 and 0024 remain in force unless explicitly superseded. Detailed acceptance criteria are in [the Social hub PRD](../prd/social-hub.md).
