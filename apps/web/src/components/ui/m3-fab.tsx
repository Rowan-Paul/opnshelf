import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Material Design 3 Floating Action Button (FAB)
 *
 * Three sizes:
 * - small: 40px diameter
 * - default: 56px diameter
 * - large: 96px diameter
 *
 * Three variants:
 * - primary: Primary container color (default)
 * - secondary: Secondary container color
 * - tertiary: Tertiary container color
 *
 * Extended variant: FAB with text label
 */

const m3FabVariants = cva(
	[
		"inline-flex items-center justify-center gap-2",
		"rounded-[var(--md-sys-shape-corner-full)]",
		"transition-all duration-200",
		"disabled:pointer-events-none disabled:opacity-38",
		"[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-6 shrink-0 [&_svg]:shrink-0",
		"outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--md-sys-color-surface)]",
		"md-elevation-3",
		"hover:md-elevation-4",
		"active:md-elevation-3",
		"md-ripple",
	].join(" "),
	{
		variants: {
			variant: {
				/**
				 * Primary FAB
				 * - Primary container background
				 * - Highest emphasis floating action
				 */
				primary: [
					"bg-[var(--md-sys-color-primary-container)]",
					"text-[var(--md-sys-color-on-primary-container)]",
				].join(" "),

				/**
				 * Secondary FAB
				 * - Secondary container background
				 * - Medium emphasis floating action
				 */
				secondary: [
					"bg-[var(--md-sys-color-secondary-container)]",
					"text-[var(--md-sys-color-on-secondary-container)]",
				].join(" "),

				/**
				 * Tertiary FAB
				 * - Tertiary container background
				 * - Alternative floating action
				 */
				tertiary: [
					"bg-[var(--md-sys-color-tertiary-container)]",
					"text-[var(--md-sys-color-on-tertiary-container)]",
				].join(" "),
			},
			size: {
				small: "size-10",
				default: "size-14",
				large: "size-24",
			},
			/**
			 * Extended FAB with text label
			 */
			extended: {
				false: "",
				true: "px-4 md-label-large rounded-[var(--md-sys-shape-corner-large)]",
			},
		},
		compoundVariants: [
			{
				extended: true,
				size: "small",
				class: "h-10 w-auto px-4",
			},
			{
				extended: true,
				size: "default",
				class: "h-14 w-auto px-5",
			},
			{
				extended: true,
				size: "large",
				class: "h-24 w-auto px-8",
			},
		],
		defaultVariants: {
			variant: "primary",
			size: "default",
			extended: false,
		},
	},
);

interface M3FabProps
	extends React.ComponentProps<"button">,
		VariantProps<typeof m3FabVariants> {
	asChild?: boolean;
}

function M3Fab({
	className,
	variant = "primary",
	size = "default",
	extended = false,
	asChild = false,
	...props
}: M3FabProps) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="m3-fab"
			data-variant={variant}
			data-size={size}
			data-extended={extended}
			className={cn(m3FabVariants({ variant, size, extended, className }))}
			{...props}
		/>
	);
}

export { M3Fab, m3FabVariants };
export type { M3FabProps };
