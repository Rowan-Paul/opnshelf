An on or off setting that takes effect at once.

Built from `apps/web/src/components/ui/switch.tsx`; the preview runs the real component. It wraps Radix Switch.

## When to use

- A single preference that saves as it flips: a Notification category, "Always show spoiler content".
- If the change needs a confirm step, use a checkbox in a form instead.

## What you provide

- `checked` and `onCheckedChange`, `size` (`default` 32 by 18px, `sm` 24 by 14px), `disabled`, and a visible label beside it.

## Rules

- On is a `primary` track. Off is an `input` track. The thumb is `background`; in dark it is `primary-foreground` when on and `foreground` when off.
- The label names the setting, not the state: "Weekly digest", not "Enable weekly digest".
- On Mobile the off track is `border-strong`.
