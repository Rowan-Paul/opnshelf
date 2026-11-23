import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "#/lib/utils";

/**
 * The shape, focus ring and disabled look come from `.btn` in styles.css, and
 * the three everyday variants are its `.btn-*` classes. Markup that writes
 * `className="btn btn-primary"` and a `<Button>` are therefore one button.
 */
const buttonVariants = cva(
	"btn shrink-0 aria-invalid:border-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "btn-primary",
				destructive:
					"bg-destructive-solid text-white hover:bg-destructive-solid-hover dark:bg-destructive/60",
				outline: "btn-secondary",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost: "btn-ghost",
				link: "text-(--accent-text) underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				xs: "h-6 gap-1 px-2 py-0 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 px-3 py-0 has-[>svg]:px-2.5",
				lg: "h-10 px-6 py-0 has-[>svg]:px-4",
				icon: "size-9 p-0",
				"icon-xs": "size-6 p-0 [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8 p-0",
				"icon-lg": "size-10 p-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
