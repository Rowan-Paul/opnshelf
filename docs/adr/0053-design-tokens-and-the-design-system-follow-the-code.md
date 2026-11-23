# ADR 0053: Design tokens and the design system follow the code

Status: Accepted.

In November 2026 a design system was built from the Web App and Mobile App code and published as a browsable page. Building it surfaced drift that no reviewer had caught, because each instance only looks wrong beside another screen:

- Amber was used as a text colour in about a hundred places. On the light surfaces it is 1.7:1.
- The focus ring was 1.4:1 in light and drawn at half strength. Text inputs had their own, weaker focus style.
- The Web App had two buttons, the `.btn` classes and the `Button` component, with different hover, focus and disabled looks.
- The shadcn components read `accent` as a quiet hover surface while `--accent` is the brand amber, so menus lit up amber.
- Web and Mobile disagreed on how a disabled button looks and on which tokens exist.

#802 fixed these. This ADR records the decisions behind the fixes and how they are kept.

## Decision

**The code is the source of the design system.** `apps/web/src/styles.css` and `apps/mobile/src/global.css` hold the token values. The brand book, usage notes, guidelines and previews are committed under `design/system/project/`. The published page is rebuilt from the repository (`pnpm design:build`, then an operator-requested publish) and is never edited on its own. See [the design system guide](../design-system.md).

**Token decisions:**

- Amber is a fill and a graphic colour. Text that should read as amber uses a separate `accent-text` token: accent-800 in the light theme, the accent itself in dark.
- The focus ring is opaque and uses accent-800 in light and accent-700 in dark. Every focus style uses `--ring`.
- Muted text in the light theme is `#5e6d83`, slate-500 darkened by 3% lightness, so it reaches 4.5:1 on the subtle fill. Subtle text is an alias of muted text, because no lighter slate reaches 4.5:1 on any surface.
- Hover and focus fills on menus, selects and ghost or outline buttons use the muted fill.
- `Button` renders the `.btn` classes. A disabled button dims to 60% on both clients. A disabled primary takes a muted fill, as on Mobile; one that is disabled only while its own request runs sets `aria-busy` and keeps the amber fill.

**A check enforces what can be checked mechanically.** `pnpm check:design-system` fails when a shared token differs between Web, Mobile and the published `tokens.json`, when amber is used as a text colour, or when a focus style names the accent. It runs in `pnpm check`, the pre-commit hook and CI.

## Considered alternatives

- **Make the published page the source and generate the CSS from it.** Rejected: the page is edited by hand in a browser, outside review, and the two clients need different output (CSS variables with aliases on Web, flat per-theme values for Uniwind on Mobile). The values already live in files every change goes through.
- **Keep the page as a hand-synced copy.** Rejected: the first copy was out of date within a day of being made, and a copy nobody rebuilds turns into a second, wrong source.
- **Keep amber text and accept the contrast.** Rejected: it fails for links, which carry meaning. Keeping the hue and darkening it for text keeps the brand colour on the things people recognise it by: the primary button, the watched pill, stars.
- **Rewrite the hundred `.btn` call sites to `<Button>`.** Not done: making the component render the classes removes the drift without touching them. A later change can still migrate call sites one at a time.
- **A lint rule in Biome for the class patterns.** Not available for Tailwind arbitrary values without a custom plugin; a small script with tests does the same job and also compares tokens.

## Consequences

Amber links are a deep amber in the light theme. A token change now touches up to three files in one commit, and the check names whichever one was missed. The class rules read source lines, so a colour assembled at run time escapes them. Publishing the page stays a manual, operator-requested step, so it can lag behind `develop`; the page's change note records the commit it was built from.
