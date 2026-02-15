import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Material Design 3 Button Component
 *
 * Five variants following Material 3 specifications:
 * - elevated: Shadow + surface tint, highest emphasis
 * - filled: Primary color background (primary action)
 * - filled-tonal: Secondary container color, medium emphasis
 * - outlined: Border only, medium emphasis
 * - text: No container, lowest emphasis
 */

const m3ButtonVariants = cva(
	[
		"inline-flex items-center justify-center gap-2 whitespace-nowrap",
		"transition-all duration-200",
		"disabled:pointer-events-none disabled:opacity-38",
		"[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px] shrink-0 [&_svg]:shrink-0",
		"outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--md-sys-color-surface)]",
		"md-label-large",
		"md-ripple",
	].join(" "),
	{
		variants: {
			variant: {
				/**
				 * Elevated Button
				 * - High emphasis action
				 * - Shadow + surface tint overlay
				 * - Primary color text on surface container low
				 */
				elevated: [
					"bg-[var(--md-sys-color-surface-container-low)]",
					"text-[var(--md-sys-color-primary)]",
					"md-elevation-1",
					"hover:md-elevation-2",
					"active:md-elevation-1",
				].join(" "),

				/**
				 * Filled Button
				 * - Highest emphasis action
				 * - Primary color background
				 */
				filled: [
					"bg-[var(--md-sys-color-primary)]",
					"text-[var(--md-sys-color-on-primary)]",
					"hover:brightness-110",
					"active:brightness-95",
				].join(" "),

				/**
				 * Filled Tonal Button
				 * - Medium emphasis action
				 * - Secondary container background
				 */
				"filled-tonal": [
					"bg-[var(--md-sys-color-secondary-container)]",
					"text-[var(--md-sys-color-on-secondary-container)]",
					"hover:brightness-110",
					"active:brightness-95",
				].join(" "),

				/**
				 * Outlined Button
				 * - Medium emphasis action
				 * - Border only with primary color
				 */
				outlined: [
					"bg-transparent",
					"text-[var(--md-sys-color-primary)]",
					"border border-[var(--md-sys-color-outline)]",
					"hover:bg-[var(--md-sys-color-primary-container)]/10",
					"active:bg-[var(--md-sys-color-primary-container)]/20",
				].join(" "),

				/**
				 * Text Button
				 * - Lowest emphasis action
				 * - No background, primary color text
				 */
				text: [
					"bg-transparent",
					"text-[var(--md-sys-color-primary)]",
					"hover:bg-[var(--md-sys-color-primary-container)]/10",
					"active:bg-[var(--md-sys-color-primary-container)]/20",
					"px-3",
				].join(" "),
			},
			size: {
				default: "h-10 px-6 py-2",
				sm: "h-8 px-4 py-1.5",
				lg: "h-12 px-8 py-3",
				icon: "size-10",
				"icon-sm": "size-8",
				"icon-lg": "size-12",
			},
		},
		defaultVariants: {
			variant: "filled",
			size: "default",
		},
	},
);

interface M3ButtonProps
	extends React.ComponentProps<"button">,
		VariantProps<typeof m3ButtonVariants> {
	asChild?: boolean;
}

function M3Button({
	className,
	variant = "filled",
	size = "default",
	asChild = false,
	...props
}: M3ButtonProps) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="m3-button"
			data-variant={variant}
			data-size={size}
			className={cn(m3ButtonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { M3Button, m3ButtonVariants };
export type { M3ButtonProps };
