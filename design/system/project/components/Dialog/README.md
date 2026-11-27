A modal that asks for one decision or one small piece of input before the person continues.

Built from `apps/web/src/components/ui/dialog.tsx`; the preview runs the real component. It wraps Radix Dialog. Select the button to open it.

## When to use

- To confirm something destructive: removing from the Shelf, deleting a List or an account.
- For a short, focused form: a Rating, a Note, a Review title and body.
- Not for messages that need no decision (use a toast) and not for navigation. On Mobile the same job is done by a bottom sheet.

## What you provide

- `Dialog` with a `DialogTrigger` and a `DialogContent`. Inside: `DialogHeader` with a `DialogTitle` and `DialogDescription`, your content, and a `DialogFooter` with the actions.
- `showCloseButton` on `DialogContent` (on by default) and on `DialogFooter` (off by default). Wrap any button that should close it in `DialogClose asChild`.

## Rules

- The title is the question or the task in sentence case: "Remove from shelf?". The description says what will happen and what stays.
- The confirming button repeats the verb from the title. Cancel is a `ghost` button to its left; on phones the footer stacks with the confirming action on top.
- A `background` panel with a 1px border, `radius-lg` and `shadow-lg`, at most 32rem wide, over a black scrim. It fades and zooms in over 200ms.
- One primary or one destructive action per dialog.
