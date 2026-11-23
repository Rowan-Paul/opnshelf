A small floating panel anchored to the control that opened it.

Built from `apps/web/src/components/ui/popover.tsx`; the preview runs the real component. It wraps Radix Popover. Select the button to open it.

## When to use

- For a compact editor or picker that relates to one control: a Watch date, a searchable country list, filters.
- It does not block the page. If the person must decide before continuing, use a Dialog.

## What you provide

- `Popover` with a `PopoverTrigger` (use `asChild` with a Button) and a `PopoverContent`. `align` and `sideOffset` place it; `PopoverAnchor` anchors it to a different element.
- `PopoverHeader`, `PopoverTitle` and `PopoverDescription` for a titled panel.

## Rules

- A `popover` surface, 18rem wide by default, with a 1px border, `radius-md`, `shadow-md` and `space-4` padding.
- The trigger shows the current value: "Watched 14 November".
- It closes on outside click and Escape, and returns focus to the trigger.
