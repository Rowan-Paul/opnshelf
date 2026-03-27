import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
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
		"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full",
		"transition-all duration-200",
		"disabled:pointer-events-none disabled:opacity-38",
		"[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px] shrink-0 [&_svg]:shrink-0",
		"outline-none focus-visible:ring-2 focus-visible:ring-(--md-sys-color-primary) focus-visible:ring-offset-2 focus-visible:ring-offset-(--md-sys-color-surface)",
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
					"bg-(--md-sys-color-surface-container-low)",
					"text-(--md-sys-color-primary)",
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
					"bg-(--md-sys-color-primary)",
					"text-(--md-sys-color-on-primary)",
					"hover:brightness-110",
					"active:brightness-95",
				].join(" "),

				/**
				 * Filled Tonal Button
				 * - Medium emphasis action
				 * - Secondary container background
				 */
				"filled-tonal": [
					"bg-(--md-sys-color-secondary-container)",
					"text-(--md-sys-color-on-secondary-container)",
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
					"text-(--md-sys-color-primary)",
					"border border-(--md-sys-color-outline)",
					"hover:bg-(--md-sys-color-primary-container)/10",
					"active:bg-(--md-sys-color-primary-container)/20",
				].join(" "),

				/**
				 * Text Button
				 * - Lowest emphasis action
				 * - No background, primary color text
				 */
				text: [
					"bg-transparent",
					"text-(--md-sys-color-primary)",
					"hover:bg-(--md-sys-color-primary-container)/10",
					"active:bg-(--md-sys-color-primary-container)/20",
					"px-3",
				].join(" "),

				/**
				 * Destructive Button
				 * - Error/danger actions (delete, remove)
				 * - Error color background
				 */
				destructive: [
					"bg-(--md-sys-color-error)",
					"text-(--md-sys-color-on-error)",
					"hover:brightness-110",
					"active:brightness-95",
				].join(" "),

				/**
				 * Ghost Button
				 * - Minimal emphasis, no container
				 * - Surface-variant text, subtle hover
				 */
				ghost: [
					"bg-transparent",
					"text-(--md-sys-color-on-surface-variant)",
					"hover:text-(--md-sys-color-on-surface)",
					"hover:bg-(--md-sys-color-surface-container-high)/50",
					"active:bg-(--md-sys-color-surface-container-high)/70",
				].join(" "),
			},
			size: {
				default: "h-10 px-6 py-2",
				sm: "h-8 px-4 py-1.5",
				xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
				lg: "h-12 px-8 py-3",
				icon: "size-10",
				"icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
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
	isLoading?: boolean;
}

function M3Button({
	className,
	variant = "filled",
	size = "default",
	asChild = false,
	isLoading = false,
	disabled,
	children,
	...props
}: M3ButtonProps) {
	const useSlot = asChild && !isLoading;
	const Comp = useSlot ? Slot.Root : "button";

	return (
		<Comp
			data-slot="m3-button"
			data-variant={variant}
			data-size={size}
			disabled={disabled || isLoading}
			className={cn(m3ButtonVariants({ variant, size, className }))}
			{...props}
		>
			{isLoading ? <Loader2 className="size-4 animate-spin" /> : children}
		</Comp>
	);
}

export { M3Button, m3ButtonVariants };
