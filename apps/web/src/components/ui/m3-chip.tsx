import { cva, type VariantProps } from "class-variance-authority";
import { Check, X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Material Design 3 Chip Component
 *
 * Types:
 * - assist: Action chip with icon
 * - filter: Selection chip with checkmark
 * - input: Input chip with avatar/label and delete icon
 * - suggestion: Simple suggestion chip
 *
 * States:
 * - selected: For filter chips
 * - disabled: All types
 */

const m3ChipVariants = cva(
	[
		"inline-flex items-center justify-center gap-2",
		"h-8 px-4",
		"rounded-[var(--md-sys-shape-corner-small)]",
		"border border-[var(--md-sys-color-outline)]",
		"transition-all duration-200",
		"disabled:pointer-events-none disabled:opacity-38",
		"md-label-large",
		"cursor-pointer",
		"md-ripple",
	].join(" "),
	{
		variants: {
			variant: {
				/**
				 * Assist Chip
				 * - For actions, shows icon + text
				 * - Elevated appearance
				 */
				assist: [
					"bg-[var(--md-sys-color-surface-container-low)]",
					"text-[var(--md-sys-color-on-surface)]",
					"md-elevation-1",
					"hover:md-elevation-2",
				].join(" "),

				/**
				 * Filter Chip
				 * - For filtering/sorting
				 * - Can be selected/deselected
				 */
				filter: [
					"bg-transparent",
					"text-[var(--md-sys-color-on-surface-variant)]",
					"hover:bg-[var(--md-sys-color-on-surface-variant)]/10",
				].join(" "),

				/**
				 * Input Chip
				 * - For entered information
				 * - Shows avatar/label + delete icon
				 */
				input: [
					"bg-[var(--md-sys-color-surface-container-highest)]",
					"text-[var(--md-sys-color-on-surface)]",
				].join(" "),

				/**
				 * Suggestion Chip
				 * - For suggestions
				 * - Simple text-only chip
				 */
				suggestion: [
					"bg-transparent",
					"text-[var(--md-sys-color-on-surface-variant)]",
					"hover:bg-[var(--md-sys-color-on-surface-variant)]/10",
				].join(" "),
			},
			/**
			 * Selected state (for filter chips)
			 */
			selected: {
				true: "",
				false: "",
			},
		},
		compoundVariants: [
			{
				variant: "filter",
				selected: true,
				class: [
					"bg-[var(--md-sys-color-secondary-container)]",
					"text-[var(--md-sys-color-on-secondary-container)]",
					"border-[var(--md-sys-color-secondary-container)]",
				].join(" "),
			},
		],
		defaultVariants: {
			variant: "assist",
			selected: false,
		},
	},
);

interface M3ChipProps
	extends React.ComponentProps<"button">,
		VariantProps<typeof m3ChipVariants> {
	icon?: React.ReactNode;
	avatar?: React.ReactNode;
	selected?: boolean;
	onDelete?: () => void;
}

function M3Chip({
	className,
	variant = "assist",
	selected = false,
	icon,
	avatar,
	children,
	onDelete,
	disabled,
	...props
}: M3ChipProps) {
	const isFilter = variant === "filter";
	const isInput = variant === "input";

	return (
		<button
			type="button"
			disabled={disabled}
			data-slot="m3-chip"
			data-variant={variant}
			data-selected={selected}
			className={cn(m3ChipVariants({ variant, selected, className }))}
			{...props}
		>
			{/* Avatar for input chips */}
			{isInput && avatar && (
				<span className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden">
					{avatar}
				</span>
			)}

			{/* Icon or Checkmark */}
			{isFilter && selected ? (
				<Check className="w-[18px] h-[18px]" />
			) : (
				icon && <span className="flex-shrink-0">{icon}</span>
			)}

			{/* Label */}
			<span>{children}</span>

			{/* Delete button for input chips */}
			{isInput && onDelete && (
				<button
					type="button"
					className="flex-shrink-0 ml-1 -mr-1 p-0.5 rounded-full hover:bg-[var(--md-sys-color-on-surface)]/10 cursor-pointer"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
				>
					<X className="w-4 h-4" />
				</button>
			)}
		</button>
	);
}

/**
 * Chip Group Component
 * For grouping multiple chips together
 */
interface M3ChipGroupProps extends React.ComponentProps<"fieldset"> {
	children: React.ReactNode;
}

function M3ChipGroup({ className, children, ...props }: M3ChipGroupProps) {
	return (
		<fieldset className={cn("flex flex-wrap gap-2", className)} {...props}>
			{children}
		</fieldset>
	);
}

export { M3Chip, M3ChipGroup, m3ChipVariants };
export type { M3ChipProps, M3ChipGroupProps };
