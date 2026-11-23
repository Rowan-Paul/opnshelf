A poster with its title and meta line, and the shelf action in its top-right corner.

Built from `apps/web/src/components/MediaCard.tsx`; the preview runs the real component. Two things differ from the app: its router link is replaced by a plain anchor that does not navigate, and the preview shows the failed-image fallback because the system ships no TMDB posters. Pass a real `posterUrl` to see the loaded state.

## When to use

- Every grid or row of movies, shows, seasons or episodes: Discover, a profile's Shelf, a List, search results.
- Use `layout="backdrop"` for a 16:9 card with the title on a black scrim, as in Up Next.

## What you provide

- From the bundle: `Opnshelf.MediaCard`.
- `id`, `title`, `type` (`movie` or `show`), `posterUrl`, and optionally `year`, `globalRating` or `tmdbRating`, `duration`, `userRating`, `episodeInfo`, `watchedDate`.
- `isWatched`, `watchCount` and `episodeProgress` for the viewer's state; `onMarkWatched`, `onUnmarkWatched`, `onManageLists` and `onRemove` to make the corner actions live.
- `size` (`sm` 120px, `md` 160 to 180px, `lg` 200 to 220px) or `fill` to stretch to a grid cell.

## Rules

- The poster is 2:3, `radius-lg`, on `background-subtle`. It loads behind a `background-strong` pulse and scales to 105% on hover.
- The shelf action sits top right: black at 70% with a plus when unwatched, an `accent` pill with a check when watched, with the count from two Watches up. Remove-from-list sits top left.
- Corner actions are 36px on phones and 28px from 640px.
- A partly watched show keeps the amber check and adds a 4px `accent` progress bar along the bottom edge.
- The title is 14px medium, two lines at most. Meta is 12px `foreground-muted`, parts separated by a bullet, with a 12px amber star before a rating.
- A failed image shows a `background-strong` disc with a play icon (movie) or clock (show) and the title.
