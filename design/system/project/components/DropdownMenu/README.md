A menu of actions that opens from a button.

Built from `apps/web/src/components/ui/dropdown-menu.tsx`; the preview runs the real component. It wraps Radix DropdownMenu. Select the button to open it.

## When to use

- For the secondary actions of one object: a List's options, the account menu.
- Keep the main action outside the menu as its own button.
- To choose a value for a form field, use Select.

## What you provide

- `DropdownMenu` with a `DropdownMenuTrigger` (use `asChild` with a Button) and a `DropdownMenuContent`.
- Inside: `DropdownMenuItem` (with `variant="destructive"` for removals, `inset` to align with checked items), `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuGroup`, checkbox and radio items, and `DropdownMenuSub` for one nested level.

## Rules

- Items are verbs in sentence case with an optional 16px leading icon: "Edit list".
- Put the destructive item last, after a separator.
- A `popover` surface with a 1px border, `radius-md` and `shadow-md`. The focused item takes a `background-subtle` fill; a destructive item keeps `destructive` text on a faint red wash.
