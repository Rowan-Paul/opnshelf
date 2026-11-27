The raised surface that groups related content.

Copied from the `.card` and `.card-interactive` primitives in `apps/web/src/styles.css`.

## When to use

- To set one group apart from the page: a details panel, a list summary, a content state.
- Add `card-interactive` only when the whole card is one link or button.
- Do not nest cards, and do not wrap every section in one. A section heading and spacing are enough for most groups.

## What you provide

- The content and its padding. The card sets none; the product uses `space-4` for dense cards and `space-8` for content states.

## Rules

- `background-elevated`, a 1px `border`, `radius-lg`, `shadow-sm`.
- On hover it gains `shadow-md` and `border-strong` over 200ms. An interactive card also lifts 2px.
- No colored borders, accent stripes or gradients on a card.
