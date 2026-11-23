A small pill that labels a thing with one or two words.

Copied from the `.badge`, `.badge-subtle` and `.badge-accent` primitives in `apps/web/src/styles.css`.

## When to use

- `badge-accent` marks the one item that is yours or next: "Up Next" on an episode row.
- `badge-subtle` is a neutral tag: a genre, "You" beside your own handle.
- For a watch count on a poster use WatchCountBadge, not a badge.

## What you provide

- One or two words in sentence case. An optional 12px icon before the text.

## Rules

- 12px, weight 600, `radius-full`, `space-0.5` by `space-2` padding.
- The accent badge sets `accent-text` on `accent-subtle`.
- A badge is not a button. A clickable genre is a link styled as a subtle badge.
