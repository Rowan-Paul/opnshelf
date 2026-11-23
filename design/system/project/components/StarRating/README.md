Five stars that show or set a Rating on the 1 to 10 scale, half a star per point.

Built from `apps/web/src/components/StarRating.tsx`; the preview runs the real component. The fourth example is editable.

## When to use

- To show a person's Rating of a Media Item, or to let them set it.
- A Rating is the number only. Long-form text is a Review and uses its own surface.
- For a community or TMDB average in a meta line, use a single 12px star and the number ("8.1/10"), not this.

## What you provide

- `value` from 1 to 10, `onChange` to make it editable, `size` (`sm` 14px, `md` 20px, `lg` 24px), `readOnly`, and `showValue` (on by default when read-only).

## Rules

- Empty stars are `accent` outlines at 30%. Filled stars are solid `accent`, clipped to the value, so 7 shows three and a half.
- The value label reads "8/10" in 14px medium `foreground-muted`.
- Editable, it is a slider: arrow keys change the value by one point and the label reads "Not rated" at zero.
