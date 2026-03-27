import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Material Design 3 Card Component
 *
 * Three variants following Material 3 specifications:
 * - elevated: Shadow + level 1 surface tint
 * - filled: Surface variant color, no shadow
 * - outlined: 1px outline, no fill
 */

const m3CardVariants = cva(
	[
		"relative overflow-hidden",
		"rounded-(--md-sys-shape-corner-medium)",
		"transition-all duration-200",
	].join(" "),
	{
		variants: {
			variant: {
				/**
				 * Elevated Card
				 * - Resting elevation: level 1
				 * - Hover elevation: level 2
				 */
				elevated: [
					"bg-(--md-sys-color-surface-container-low)",
					"md-elevation-1",
					"hover:md-elevation-2",
				].join(" "),

				/**
				 * Filled Card
				 * - Surface container highest color
				 * - No shadow
				 */
				filled: ["bg-(--md-sys-color-surface-container-highest)"].join(" "),

				/**
				 * Outlined Card
				 * - Transparent background
				 * - 1px outline
				 */
				outlined: [
					"bg-(--md-sys-color-surface)",
					"border border-(--md-sys-color-outline-variant)",
				].join(" "),
			},
		},
		defaultVariants: {
			variant: "elevated",
		},
	},
);

interface M3CardProps
	extends React.ComponentProps<"div">,
		VariantProps<typeof m3CardVariants> {}

const M3Card = React.forwardRef<HTMLDivElement, M3CardProps>(
	({ className, variant = "elevated", ...props }, ref) => (
		<div
			ref={ref}
			data-slot="m3-card"
			data-variant={variant}
			className={cn(m3CardVariants({ variant, className }))}
			{...props}
		/>
	),
);
M3Card.displayName = "M3Card";

/**
 * Card Header Component
 */
const M3CardHeader = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex flex-col gap-1.5 p-4", className)}
		{...props}
	/>
));
M3CardHeader.displayName = "M3CardHeader";

/**
 * Card Title Component
 */
const M3CardTitle = React.forwardRef<
	HTMLHeadingElement,
	React.ComponentProps<"h3">
>(({ className, ...props }, ref) => (
	<h3
		ref={ref}
		className={cn(
			"md-title-medium text-(--md-sys-color-on-surface)",
			className,
		)}
		{...props}
	/>
));
M3CardTitle.displayName = "M3CardTitle";

/**
 * Card Description Component
 */
const M3CardDescription = React.forwardRef<
	HTMLParagraphElement,
	React.ComponentProps<"p">
>(({ className, ...props }, ref) => (
	<p
		ref={ref}
		className={cn(
			"md-body-medium text-(--md-sys-color-on-surface-variant)",
			className,
		)}
		{...props}
	/>
));
M3CardDescription.displayName = "M3CardDescription";

/**
 * Card Content Component
 */
const M3CardContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
));
M3CardContent.displayName = "M3CardContent";

/**
 * Card Footer Component
 */
const M3CardFooter = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex items-center p-4 pt-0 gap-2", className)}
		{...props}
	/>
));
M3CardFooter.displayName = "M3CardFooter";

export { M3Card, M3CardHeader, M3CardTitle, M3CardDescription, M3CardContent };
