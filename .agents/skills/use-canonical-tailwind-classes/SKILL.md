---
name: use-canonical-tailwind-classes
description: Prefer canonical Tailwind CSS utility syntax over arbitrary value syntax when both express the same style. Use when writing, editing, reviewing, or refactoring `className` strings so bracketed classes like `aspect-[4/3]`, `z-[10]`, or `rounded-[var(--radius-card)]` become their canonical Tailwind forms when available.
---

# Use Canonical Tailwind Classes

## Overview

This repo uses Tailwind CSS 4.x.
When Tailwind already has a first-party utility for a value, use that syntax instead of arbitrary brackets.

Treat arbitrary values as the fallback for:

- truly custom values
- complex expressions
- one-off grid or layout definitions
- values with no documented canonical utility

## Rule

Prefer class syntax in this order:

1. Named utility such as `h-screen` or `aspect-video`
2. Canonical numeric or fraction utility such as `aspect-4/3`, `w-1/2`, `z-10`, or `size-12`
3. Tailwind's custom-property shorthand such as `rounded-(--radius-card)` or `grid-cols-(--layout-columns)`
4. Arbitrary value syntax only when the above do not fit

Do not keep bracket syntax if Tailwind already supports the same value directly.
Do not invent utility names that Tailwind does not provide.

## Common Replacements

```tsx
// Avoid
<div className="aspect-[4/3]" />

// Prefer
<div className="aspect-4/3" />

// Avoid
<div className="w-[50%]" />

// Prefer
<div className="w-1/2" />

// Avoid
<div className="h-[100vh]" />

// Prefer
<div className="h-screen" />

// Avoid
<div className="z-[10]" />

// Prefer
<div className="z-10" />

// Avoid
<div className="rounded-[var(--radius-card)]" />

// Prefer
<div className="rounded-(--radius-card)" />

// Avoid
<div className="grid-cols-[var(--layout-columns)]" />

// Prefer
<div className="grid-cols-(--layout-columns)" />
```

## Keep Arbitrary Values When Needed

These should usually stay arbitrary because they are genuinely custom:

```tsx
<div className="rounded-[28px]" />
<div className="grid-cols-[300px_1fr]" />
<div className="top-[calc(100%-1px)]" />
```

If the same arbitrary value repeats across multiple components, consider promoting it to a shared theme token or CSS variable instead of copying the literal everywhere.

## Bulk Conversion

To automatically convert existing classes to their canonical forms across an entire codebase, use Tailwind's official upgrade tool:

```bash
pnpx @tailwindcss/upgrade
```

This will scan and rewrite non-canonical classes (e.g., `p-16px` → `p-4`, `mt-[16px]` → `mt-4`, `[display:flex]` → `flex`) in bulk.

## Workflow

1. Scan the class strings you touch for bracketed arbitrary values.
2. Replace a bracketed value when Tailwind has an equivalent named, numeric, fraction, or custom-property shorthand utility.
3. Leave the class arbitrary when the value is bespoke or the canonical form would be less clear.
4. Before finishing, do one pass to make sure no easy canonical replacements were missed.

## Review Checklist

- Bracket syntax is removed when Tailwind already has an equivalent utility.
- Fractions, numeric scales, and standard keywords use their canonical class names.
- CSS variable usages prefer Tailwind's `(<custom-property>)` shorthand when supported.
- Truly custom values remain arbitrary instead of being forced into fake utility names.
