The gold "watched" pill: a bare check for one Watch, a check and the total for rewatches.

Built from `apps/web/src/components/WatchCountBadge.tsx`; the preview runs the real component.

## When to use

- On any read-only surface that states a Watch count: poster cards, the Your Activity card on a detail page.
- Where the person can toggle the shelf state, render a button of the same shape instead (see MediaCard).

## What you provide

- `watchCount`, the viewer's own Watches. Leave it undefined for "watched, count unknown". `className` sets the height and position for the surface.

## Rules

- `accent` fill, `accent-foreground` check and number, `radius-full`.
- One Watch is a circle with a check. Two or more add the count in 12px bold tabular numerals.
- It is an image, not a control: `role="img"` with a label such as "3 watches logged".
