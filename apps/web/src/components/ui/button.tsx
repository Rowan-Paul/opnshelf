import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-(--md-sys-color-primary)/50",
	{
		variants: {
			variant: {
				default:
					"bg-(--md-sys-color-primary) text-(--md-sys-color-on-primary) hover:brightness-110",
				destructive:
					"bg-(--md-sys-color-error) text-(--md-sys-color-on-error) hover:brightness-110",
				outline:
					"border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) text-(--md-sys-color-on-surface) hover:bg-(--md-sys-color-surface-container-high)",
				secondary:
					"bg-(--md-sys-color-surface-container-high) text-(--md-sys-color-on-surface) hover:bg-(--md-sys-color-surface-container-highest)",
				ghost:
					"text-(--md-sys-color-on-surface-variant) hover:text-(--md-sys-color-on-surface) hover:bg-(--md-sys-color-surface-container-high)/50",
				link: "text-(--md-sys-color-primary) underline-offset-4 hover:underline hover:brightness-110",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
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
