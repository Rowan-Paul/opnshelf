A text link in the Web header, with an amber underline on the current page.

Copied from the `.nav-link` primitive in `apps/web/src/styles.css`.

## When to use

- Top-level destinations in the header: Home, Discover, Social, Profile. The Mobile App shows the same four as a tab bar with the icons under Icons.

## What you provide

- The link text and `data-active="true"` on the current destination.

## Rules

- 14px, weight 500, `foreground-muted`; `foreground` on hover and when active.
- The active link carries a 2px `accent` underline 4px below the text. Nothing else in the header is amber.
