# PRD: Social hub

Issue: [#278 — Merge activity and connections screens](https://github.com/Rowan-Paul/opnshelf/issues/278)

Status: Implemented on Web and Mobile (issue #278).

## Problem and outcome

Activity and Connections are unclear as separate top-level destinations and each feels like a supporting page. Give social activity one recognizable home on both Web and Mobile: **Social**, opening directly onto the Activity Feed, with visible Find people and Circles entry points.

[ADR 0032](../adr/0032-social-is-one-shared-hub.md) records the trade-off and supersedes the relevant parts of ADRs 0012 and 0024. CONTEXT.md defines the vocabulary.

## Agreed behavior

| Surface | Web and Mobile behavior |
| --- | --- |
| Main navigation | Home · Discover · Social · Profile; no replacement for the removed slot. |
| Social, `/social` | Activity Feed with All/Circle filtering and visible Find people and Circles entry points. No intermediate overview page or internal Feed/People/Circles tabs. |
| Find people, `/social/find` | Search, suggested Users, and links to the signed-in User's Following/Followers lists on Profile. |
| Circles, `/social/circles` | Owned Circle list and creation action; the existing editor moves to `/social/circles/{circleId}` on both clients for membership, rename, and deletion. |
| Following/Followers | Full lists remain canonical on Profile, with existing manage affordances. Remove their recent-avatar previews from the main Social screen. |
| Return to Social | Preserve feed scroll position and selected Circle when returning from supporting pages. |
| Old routes | Remove `/activity` and `/connections` without redirects. Update internal links, Home previews, command search, Circle return/delete destinations, and tour references. Existing external links to the removed routes stop working. |

The feed continues to contain reverse-chronological Watches and Reviews from followed Users, optionally filtered by Circle. Suggested Users belong in finding people; activity from unfollowed Users is not introduced.

## Empty states and data changes

- Following nobody: search and suggested Users become the primary Social content.
- Following Users but no activity: explain the empty feed and offer Find people.
- Selected Circle has no activity: offer Manage Circle and Show all activity.
- No Circles: Circle creation and management remain reachable from Social.
- Both clients support pagination; Web must not stop after the first 20 activities.
- Successful follow/unfollow and Circle changes refresh the affected feed. Preserve already-loaded content and position where possible; returning from following a User must not require a manual refresh to see their eligible activity.
- Existing Circle rules remain: membership requires following, unfollow removes membership, and a deleted selected Circle falls back to All.
- Apply repository loading rules: matching skeletons for initial loading, keep loaded content during refresh, and scope pending actions to the affected item.

## Welcome Tour

Replace separate Connections and Activity steps with one Social step explaining the feed and its supporting pages. Keep the platform-specific tail and remaining tour steps. Do not bump the tour version to replay the whole tour for existing Users; manual replay stays available in Settings.

## Acceptance and verification

Verify both clients against the agreed behavior, including:

1. Navigate from Social into Find people and Circles and back without losing the feed position or Circle selection.
2. Follow or unfollow a User, return to the feed, and see the updated eligible activity without manual refresh.
3. Create the first Circle, edit membership, filter the feed, and delete the selected Circle; verify return destinations and fallback to All.
4. Exercise each empty state and its actions.
5. Load more than 20 activities on both clients without replacing the already-loaded feed.
6. Verify internal navigation uses the new routes and that the removed routes do not redirect.
7. Run the revised Welcome Tour, including an account with no follows; verify manual replay and that previously completed tours do not automatically replay.

Implementation must run `pnpm typecheck`, `pnpm check`, `pnpm --filter web run test`, and `pnpm --filter mobile run test`, plus any additional affected-workspace gates. Visually inspect the Web pages in a browser and Mobile routes in an iOS or Android simulator, reporting links and screenshots or observed state. The implementation ran these gates and verified both clients against a local fixture API.
