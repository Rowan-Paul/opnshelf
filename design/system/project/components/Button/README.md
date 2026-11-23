The one control for actions, in six Web variants and four Mobile variants.

Rows one and two run the real Web component, built from `apps/web/src/components/ui/button.tsx`. Row three is a static rendition of the Mobile button (`apps/mobile/src/components/ui/button.tsx`), which is React Native and cannot run here; use its `m-button` classes for Mobile mockups.

## When to use

- `default` (Mobile `primary`) is the amber action. Use one per view: the thing the screen is for.
- `secondary` and `outline` are the second choice beside it. `ghost` dismisses.
- `destructive` removes or deletes. On Web it is a red fill with a white label; on Mobile it is a red outline with a red label.
- `link` is an inline text action in `accent-text`.

## What you provide

- Web: `variant` (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`), `size` (`xs` 24px, `sm` 32px, `default` 36px, `lg` 40px, and `icon`, `icon-xs`, `icon-sm`, `icon-lg` squares), children, and `asChild` to render a link as a button.
- Mobile: a `label` string, `variant` (`primary`, `secondary`, `ghost`, `destructive`), `size` (`md` 48px, `sm` 40px), and optionally `description`, `leading`, `trailing`, `loading`, `loadingLabel`, `disabled`.
- A leading icon is 16px and takes the label color.

## Rules

- Label with the action in sentence case: "Add to shelf", not "OK".
- Web buttons are `radius-md` with a 500 label. Mobile buttons are `radius-lg` with a 600 label.
- Disabled buttons drop to 60% opacity. A disabled primary becomes a `background-subtle` fill with a `border` and a `muted-foreground` label, because fading amber loses the label. Set `aria-busy` to keep the fill while something is in flight.
- `outline` and `ghost` hover to `background-subtle`. Primary hovers to `accent-hover`.
- Focus is a 2px opaque `ring` outline with a 2px offset.
- While loading, a spinner replaces the label and the button keeps its width.
- The `.btn`, `.btn-primary`, `.btn-secondary` and `.btn-ghost` classes are the same control for plain markup: the component renders them for its `default`, `outline` and `ghost` variants.
- Icons come from `Opnshelf.icons` (a Lucide subset): `h(Opnshelf.Button, null, h(Opnshelf.icons.Plus), 'Add to shelf')`.
