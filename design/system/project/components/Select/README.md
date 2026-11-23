A field that picks one value from a short fixed list.

Built from `apps/web/src/components/ui/select.tsx`; the preview runs the real component. It wraps Radix Select. Select the field to open it.

## When to use

- For five to fifteen known options: a Streaming Service, a sort order, a Visibility setting.
- For long lists that need typing, such as country or timezone, use a searchable picker (Popover with Command).
- For two options that apply at once, use a Switch.

## What you provide

- `Select` with `value` and `onValueChange` (or `defaultValue`), a `SelectTrigger` holding a `SelectValue` with a `placeholder`, and a `SelectContent` of `SelectItem`s.
- `SelectTrigger` takes `size` (`default` 36px, `sm` 32px) and needs a width from you. `SelectGroup` with a `SelectLabel` and `SelectSeparator` organise longer lists.

## Rules

- The placeholder is an instruction: "Choose a service".
- The trigger looks like an input: a 1px `input` border, `radius-md`, and a chevron. The chosen item shows a check on the right.
- The list is a `popover` surface. The focused item takes a `background-subtle` fill.
- Give the trigger a visible label or an `aria-label`.
