# ADR 0035: Lists are an overview and a detail page

Status: Accepted and implemented (issue #302).

The Web App rendered every List on one route. A sidebar listed the user's Lists; picking one swapped the items in the pane beside it. Selection lived in component state, so the URL never moved off `/profile/$handle/lists` and a particular List could not be linked, bookmarked or shared. The sidebar carried a name, a description and a count and nothing else, which made a screen full of curated media read like a settings page. The Mobile App had already split the two — a Lists screen and a `/lists/[slug]` screen — so the clients disagreed about what a List even was.

## Decision

Lists are two routes on both clients. `/profile/$handle/lists` is an overview of every List; `/profile/$handle/lists/$listSlug` is one List and its items. The Mobile App's existing `/lists` and `/lists/[slug]` already match, which satisfies ADR 0023's shared URL shapes without changing Mobile's routes.

Each List on the overview is a card carrying a cover, not a row carrying a name. The cover is the List's first item in manual (`position`) order: the artwork fills the card blurred, a scrim darkens it toward the text, the crisp poster keeps its 2:3 shape at the leading edge and overhangs into the body, and the List's name sits on the artwork. A List with no items keeps a plain coloured card, because there is no first item to borrow art from and a grey blur reads as broken.

The cover ships on `ListSummaryDto` as `coverPosterPath`, populated by a `take: 1` relation inside the existing `getUserLists` query. The overview therefore costs one request no matter how many Lists a user has. Putting the poster behind a per-List request would have turned one query into N.

The detail route owns the affordances that act on one List: search, filter, sort, reorder, and — for the owner — edit and delete. The overview owns the affordances that act on the set: sort, and create.

## Alternatives rejected

- **Keep the master–detail split and put the selected slug in a search param.** This would make a List linkable without moving routes. It leaves the sidebar occupying a third of the viewport on every visit, keeps two panes competing for attention on a page whose content is posters, and gives the overview nowhere to grow: a card with a cover needs the width the sidebar was spending on a name.
- **One route that switches layout by breakpoint** — sidebar on desktop, pushed detail on mobile. This is how the split started. It means two layouts to keep correct, and it re-creates the divergence from the Mobile App that this ADR closes.
- **Derive the cover on the client from the first item of each List.** The overview does not fetch items, so this needs either a request per List or a much fatter summary payload. A single `posterPath` string on the summary is the cheaper half of both.
- **Let the owner choose a cover image.** A stored choice is a new field, a new editor, a new PDS write and a new thing to keep in sync when the chosen item leaves the List. Borrowing the first item's poster is free, always current, and already reflects the order the owner curated.

## Consequences

- A List has a URL. It can be linked, bookmarked, shared and opened in a new tab, and the Web App's title reflects the List rather than "Lists".
- Renaming a List regenerates its slug, so the URL the reader is on goes stale. The rename handler follows the returned slug, and a stale link is answered with 404 and a not-found state rather than a crash.
- Both routes await their data in the loader, so each needs a `pendingComponent` — a skeleton shaped like the thing it stands in for — or the router holds the previous page instead.
- `coverPosterPath` is optional on `ListSummaryDto`. Clients must handle its absence, which is both "the List is empty" and "the first item has no poster".
- The overview's cover treatment and the Mobile App's row treatment are the same idea at different aspect ratios: Web's scrim runs bottom-to-top under a wide band, Mobile's runs left-to-right along a row. Changing one is a prompt to look at the other.
