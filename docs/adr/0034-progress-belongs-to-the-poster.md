# ADR 0034: Watch progress belongs to the poster it describes

Status: Accepted and implemented (issue #275).

Issue [#275](https://github.com/Rowan-Paul/opnshelf/issues/275) asks for the progress bar to move into the header. Before this change a viewer's progress through a Show was told three different ways. A "Your Progress" card sat in the sidebar of the Show and Season detail pages, below the fold and far from the media it described. Media cards put a percent badge over the poster's corner, doubling as the mark-watched control. Up Next rows drew their own bar with their own markup. A viewer scanning a shelf had to read a badge to learn they were part-way through, and on a detail page had to scroll past the fold to find the count at all.

## Decision

Progress renders as a bar along the bottom edge of the poster it belongs to, and it is scoped to whatever that poster depicts. One component owns it per client — `PosterProgress` on Web, `poster-progress` on Mobile — and every surface uses it: detail heroes, media cards, season cards and Up Next. The bar carries a progressbar role and an "N of M aired episodes watched" accessible name, and the detail heroes repeat that count as a summary line under the title. The sidebar card is gone; the mark/unmark action it held moved into the hero actions row as `ProgressShelfButton` on Web, where Mobile already kept that action in `MediaTrackingActions`.

Poster and bar always agree. A Show poster carries Show progress, a Season poster carries Season progress. This is why the episode detail hero shows its Season's poster rather than the Show's: the bar and summary there are Season-scoped, and pairing them with Show artwork meant the same image carried a Season fill on one screen and a Show fill on another. On Mobile the poster's link follows the artwork, pointing at the Season.

The denominator counts **aired** episodes. `ShowProgressService` filters on `airDate <= now` and excludes specials, so a currently-airing Show can reach 100%. That number is smaller than the catalogue episode count TMDB reports, which the detail header shows as a pill, so the summary and the bar's accessible name both say "aired episodes" to keep the two from reading as a contradiction. Season rows keep the shorter "N of M episodes watched": no competing total sits beside them, and the extra word wrapped their subtitle onto a second line on Mobile.

Progress is viewer-relative and only meaningful for a Show. A card for a Movie or a single Episode gets no bar, and a card whose progress is still loading reserves the strip with a skeleton rather than announcing zero.

## Alternatives rejected

- **Keep the sidebar card and add a bar.** Two representations of one number drift, and the card was the reason the count lived below the fold. Removing it is what makes the bar worth having.
- **Keep the percent badge on cards.** The badge occupied the corner that the mark-watched control needs, forcing one affordance to mean two things. With the bar carrying the number, the corner goes back to being a button.
- **Show catalogue totals in progress.** Using TMDB's episode count as the denominator would make 100% unreachable for any returning Show, which is worse than explaining that the count is of aired episodes.
- **Put a bar on the Web Season accordion rows.** Those rows have no poster, so there is nothing for a bar to belong to; they keep their text count. This is a deliberate asymmetry with Mobile's `SeasonCard`, which does have a poster and does get a bar.

## Consequences

- A new progress surface means using the shared component, not new markup. The bar's geometry and its accessible name are defined once per client.
- The component positions itself absolutely, so a poster wrapper must establish a containing block. On Web that means the wrapper needs `relative`; without it the bar escapes to the nearest positioned ancestor and stretches across the page. React Native needs nothing, since its views are already relatively positioned.
- Web media cards no longer accept a bare numeric progress prop. It had no callers, and its fallback invented an episode total of 100.
- "Aired episodes" is now the phrase for this distinction, matching the mark-watched confirmations that already offered to add Watches for "the N remaining aired episodes".
