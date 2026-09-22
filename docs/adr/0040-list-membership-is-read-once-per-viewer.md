# ADR 0040: List membership is read once per viewer, not per item

Status: Accepted and implemented on Web. The Mobile App still reads per item.

Every poster card on Web showed whether its item was on one of the viewer's lists, and every card asked for that on its own: `GET /lists/for-item/:mediaType/:mediaId`. Each answer was the viewer's whole set of lists with one `isInList` flag per list. A signed-in search page sent 120 of these, which is more than the session rate limit allows in a minute (ADR 0025). Some came back 429 and were retried, and the rest competed with the page's images for bandwidth. Lighthouse scored that page 64.

## Decision

Web reads list membership once per viewer: `GET /lists/items/memberships` returns every item in the viewer's lists with the ids of the lists that hold it. Each card derives the old per-item shape from that one cached answer and the viewer's lists, which it already fetched (`apps/web/src/lib/hooks/list-memberships.ts`). Adding or removing an item updates that shared entry optimistically, so every poster of the item changes at once, and a refetch settles it.

This is not the batch shape ADR 0036 prescribes. ADR 0036 batches a known set of ids into one GET, and that fits reads whose answer grows with the catalogue, like ratings or show progress. List membership grows only with the viewer's own lists, which are small. Asking for all of it removes the need for each grid to collect its ids first. It also lets one cached answer serve every card on every page until it goes stale, instead of one request per grid.

The path has two segments and is declared before `GET /lists/:slug`, so a list whose slug is `memberships` cannot shadow it.

Movie cards follow the same rule. They read "watched, and how often" from `GET /movies/user/:did/watch-counts`, one small answer per viewer, instead of fetching each movie's full watch history. They also stop using the viewer's full movie list for it, which carried every movie's details and ran to half a megabyte for a long watch history. The movie detail page still fetches the history, since it shows the dates.

## Consequences

- A signed-in search page sends 13 API requests, down from about 150.
- The payload grows with the viewer's list items. If lists ever routinely hold thousands of items, move to an ADR 0036 batch keyed by the page's ids.
- `GET /lists/for-item/...` and the per-movie history stay for the Mobile App, which still calls them per card. Porting Mobile to these reads is a separate change.
