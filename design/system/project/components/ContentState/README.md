An icon-and-sentence card for a list that is empty or failed to load.

Built from `apps/web/src/components/ContentState.tsx`; the preview runs the real component. The Mobile counterparts are `EmptyState` and `ErrorState` in `apps/mobile/src/components/ui/states.tsx`.

## When to use

- In place of a list that has nothing to show: a profile's Notes or Reviews.
- Use `variant="error"` when the list failed to load. For a failed action, use a toast.

## What you provide

- `message`, one sentence. `icon`, a Lucide icon for the empty variant. `variant` (`empty` or `error`).

## Rules

- A Card with `space-8` padding, a 40px icon, and the message in `foreground-muted`, centered.
- The error variant swaps in a `destructive` warning triangle and announces itself with `role="alert"`.
- Empty copy states the fact: "No notes yet." Error copy names what failed: "Couldn't load reviews."
