# Design system

Opnshelf has one design system, published as a browsable page:
<https://claude.ai/artifact/KRcjTWXsSXrMKWPnd5eR5v> (access is granted from the
page's Share menu). It holds the brand book, every token with a usage note,
the fonts and marks, and live previews of the shared components.

The code is the source. The page is a published view of it, so a change starts
in the repository and is published afterwards, never the other way round.
[ADR 0053](adr/0053-design-tokens-and-the-design-system-follow-the-code.md)
records why, and the token decisions behind the rules below.

## Where things live

| What | Where | Edited by |
| --- | --- | --- |
| Web tokens and primitives | `apps/web/src/styles.css` | hand |
| Mobile tokens | `apps/mobile/src/global.css`, `apps/mobile/src/theme/` | hand |
| Brand book, token usage notes, component guidelines and previews | `design/system/project/` | hand |
| Component bundle and stylesheet (`components/bundle.js`, `components/bundle.css`) | built into `design/system/project/components/`, gitignored | `pnpm design:build` |
| Which components the bundle exports | `apps/web/design-system/entry.tsx` and the `COMPONENTS` list in `build.mjs` | hand |
| Logo and icon masters | `design/branding/`, `apps/mobile/assets/tab-icons/` | hand |

`design/system/project/` mirrors the paths the page serves. Fonts, the two
React 18 library files and the uploaded marks already sit on the page and are
not kept here a second time.

## Rules that apply in code

`pnpm check:design-system` enforces the first three. It runs inside
`pnpm check`, in the pre-commit hook and as the `design-system` CI job.

1. **A shared token has one value.** Every colour and radius that Web and
   Mobile both define has the same value in both themes, and
   `design/system/project/tokens.json` states the Web value. Change all three
   in one commit.
2. **Amber is a fill, not a text colour.** Text uses `text-(--accent-text)` on
   Web and `text-accent-text` on Mobile. Icons, spinners and filled stars may
   stay `accent`.
3. **Focus uses the ring token.** Never name the accent in a focus style.
   `--ring` is opaque and passes 3:1 on every surface in both themes.
4. **One button.** `<Button>` and `className="btn …"` are the same definition
   (`.btn` in `styles.css`). A primary button that is disabled only while its
   own request runs also sets `aria-busy`, which keeps its fill.
5. **Hover and focus fills are muted.** Menus, selects and ghost or outline
   buttons use the muted fill. Amber marks the primary action only.

When the check fails it names the file, the token or the line, and the value on
each side.

## Changing a token or a shared component

1. Make the change in `styles.css`, and in `global.css` when Mobile has the
   token.
2. Update the token's value and usage note in
   `design/system/project/tokens.json`. Update `README.md` or the component's
   guidelines there when a rule changed.
3. Run `pnpm check:design-system`.
4. Look at the result on the target client, as for any visual change.
5. After the change merges, publish (below).

To add a component to the design system: export it from
`apps/web/design-system/entry.tsx`, add its name to `COMPONENTS` in
`apps/web/design-system/build.mjs`, and add
`design/system/project/components/<Name>/README.md` and `preview.html`.

## Publishing

Publishing needs an agent session with the Artifact tool, because the page is a
Claude artifact. It is an operator-requested step, like a deploy.

1. `pnpm design:build` writes the bundle and stylesheet from the current
   checkout.
2. Ask the agent to publish `design/system/project` to the design system
   artifact. It sends the changed files with `design/system` as the root and
   records the commit in the page's change note.

The build takes the token values out of the stylesheet, because the page
declares them from `tokens.json`. It also keys the dark variant on
`data-theme="dark"` where the Web App uses a `.dark` class. The bundle runs on
React 18, which the page provides; the Web App runs React 19. `MediaCard` gets
a plain anchor in place of the router link and a no-op in place of analytics.

## What it does not cover

- Mobile components are React Native and cannot run on the page. The Mobile
  button is a static rendition in `apps/web/design-system/extras.css`.
- Spacing has no variables in the code; the listed steps are the Tailwind scale
  values the primitives use, and the check does not compare them.
- Shadows differ between the clients by design and are compared only between
  Web and `tokens.json`.
- The check reads class names line by line. It cannot see a colour assembled at
  run time.
