A single-line or multiline text input with an optional label and a helper or error line.

Plain markup styled by the `.input` primitive in `apps/web/src/styles.css` and `apps/mobile/src/components/ui/text-field.tsx`.

## When to use

- Any free text: a Review title, a List name, a search query, feedback.
- Use a Select or picker when the answer comes from a fixed set (country, Streaming Service).

## What you provide

- Web: an `<input class="input">` or `<textarea class="input">`, plus your own label.
- Mobile: `label`, `helperText`, `error` (replaces the helper text), `variant` (`card` on screens, `subtle` inside bottom sheets), `leading` and `trailing` nodes, and any `TextInput` prop.

## Rules

- The field is `background-elevated` with a 1px `border`. Web is `radius-md` at 14px; Mobile is `radius-lg` at 16px with `space-4` side padding.
- Focus draws 2px of opaque `ring` (the border plus 1px) with a 3px `accent-subtle` halo outside it.
- The label sits above in 14px medium. Helper text is 12px `muted-foreground`; an error is 12px `destructive` and takes its place.
- Placeholders are an example or a constraint ("At least 8 characters"), never the label.
- On Mobile keep the input at a bare 16px font size. `text-base` adds a line height that clips descenders on iOS.
