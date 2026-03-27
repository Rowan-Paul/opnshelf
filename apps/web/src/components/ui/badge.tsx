import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden",
	{
		variants: {
			variant: {
				default: "bg-(--md-sys-color-primary) text-(--md-sys-color-on-primary)",
				secondary:
					"bg-(--md-sys-color-surface-container-highest) text-(--md-sys-color-on-surface)",
				destructive: "bg-(--md-sys-color-error) text-(--md-sys-color-on-error)",
				outline:
					"border border-(--md-sys-color-outline) text-(--md-sys-color-on-surface) bg-(--md-sys-color-surface-container-high)",
				ghost:
					"text-(--md-sys-color-on-surface-variant) hover:text-(--md-sys-color-on-surface) hover:bg-(--md-sys-color-surface-container-high)/50",
				link: "text-(--md-sys-color-primary) underline-offset-4 hover:underline hover:brightness-110",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "span";

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge };
