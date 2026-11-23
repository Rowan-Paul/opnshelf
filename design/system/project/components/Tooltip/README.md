A short label that appears on hover or focus, for controls that show only an icon.

Built from `apps/web/src/components/ui/tooltip.tsx`; the preview runs the real component. It wraps Radix Tooltip.

## When to use

- To name an icon-only button: the corner actions on a poster, a toolbar button.
- Never for information a person needs to complete a task, and never on touch-only surfaces: the Mobile App has no tooltips.

## What you provide

- `Tooltip` around a `TooltipTrigger` (use `asChild` with a Button) and a `TooltipContent` holding the label. `side` and `sideOffset` place it.

## Rules

- The label repeats the control's accessible name in sentence case: "Add to shelf".
- A `primary` fill with `primary-foreground` text at 12px, `radius-md`, and a small arrow. It opens with no delay.
- One line. If it needs two, it is not a tooltip.
