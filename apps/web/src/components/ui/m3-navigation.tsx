import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Material Design 3 Navigation Components
 *
 * Includes:
 * - Navigation Rail: For desktop/tablet (72px wide, left side)
 * - Bottom App Bar: For mobile (80px height, bottom)
 * - Navigation Drawer: For expanded navigation
 */

// ============================================
// Navigation Rail
// ============================================

const m3NavigationRailVariants = cva(
	[
		"flex flex-col items-center",
		"w-[72px] min-h-screen py-3",
		"bg-[var(--md-sys-color-surface)]",
		"border-r border-[var(--md-sys-color-outline-variant)]",
	].join(" "),
	{
		variants: {
			position: {
				left: "left-0",
				right: "right-0 border-r-0 border-l",
			},
		},
		defaultVariants: {
			position: "left",
		},
	},
);

interface M3NavigationRailProps
	extends React.ComponentProps<"nav">,
		VariantProps<typeof m3NavigationRailVariants> {
	fab?: React.ReactNode;
}

const M3NavigationRail = React.forwardRef<HTMLElement, M3NavigationRailProps>(
	({ className, position, fab, children, ...props }, ref) => (
		<nav
			ref={ref}
			className={cn(m3NavigationRailVariants({ position, className }))}
			{...props}
		>
			{/* Optional FAB */}
			{fab && <div className="mb-4">{fab}</div>}
			<div className="flex flex-col gap-1 flex-1">{children}</div>
		</nav>
	),
);
M3NavigationRail.displayName = "M3NavigationRail";

// ============================================
// Navigation Rail Item
// ============================================

const m3NavigationRailItemVariants = cva(
	[
		"flex flex-col items-center justify-center",
		"w-14 h-14",
		"rounded-[var(--md-sys-shape-corner-large)]",
		"gap-1",
		"transition-all duration-200",
		"cursor-pointer",
		"md-label-medium",
		"md-ripple",
	].join(" "),
	{
		variants: {
			active: {
				true: [
					"bg-[var(--md-sys-color-secondary-container)]",
					"text-[var(--md-sys-color-on-secondary-container)]",
				].join(" "),
				false: [
					"text-[var(--md-sys-color-on-surface-variant)]",
					"hover:bg-[var(--md-sys-color-on-surface)]/10",
				].join(" "),
			},
		},
		defaultVariants: {
			active: false,
		},
	},
);

interface M3NavigationRailItemProps
	extends React.ComponentProps<"button">,
		VariantProps<typeof m3NavigationRailItemVariants> {
	icon: React.ReactNode;
	label: string;
	badge?: number | string;
	asChild?: boolean;
}

const M3NavigationRailItem = React.forwardRef<
	HTMLButtonElement,
	M3NavigationRailItemProps
>(
	(
		{ className, active, icon, label, badge, asChild = false, ...props },
		ref,
	) => {
		const Comp = asChild ? Slot.Root : "button";

		return (
			<Comp
				ref={ref}
				className={cn(m3NavigationRailItemVariants({ active, className }))}
				{...props}
			>
				<div className="relative">
					{icon}
					{badge && (
						<span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error)] text-[10px] font-semibold flex items-center justify-center">
							{badge}
						</span>
					)}
				</div>
				<span className="text-[11px] leading-4">{label}</span>
			</Comp>
		);
	},
);
M3NavigationRailItem.displayName = "M3NavigationRailItem";

// ============================================
// Bottom App Bar
// ============================================

const m3BottomAppBarVariants = cva(
	[
		"fixed bottom-0 left-0 right-0",
		"flex items-center",
		"h-20 px-4",
		"bg-[var(--md-sys-color-surface-container)]",
		"md-elevation-2",
		"z-50",
	].join(" "),
	{
		variants: {
			fabPosition: {
				center: "justify-center",
				end: "justify-end",
			},
		},
		defaultVariants: {
			fabPosition: "center",
		},
	},
);

interface M3BottomAppBarProps
	extends React.ComponentProps<"nav">,
		VariantProps<typeof m3BottomAppBarVariants> {
	fab?: React.ReactNode;
}

const M3BottomAppBar = React.forwardRef<HTMLElement, M3BottomAppBarProps>(
	({ className, fabPosition, fab, children, ...props }, ref) => (
		<nav
			ref={ref}
			className={cn(m3BottomAppBarVariants({ fabPosition, className }))}
			{...props}
		>
			<div className="flex items-center gap-2 flex-1">{children}</div>
			{fab && <div className="mx-4 -mt-8">{fab}</div>}
		</nav>
	),
);
M3BottomAppBar.displayName = "M3BottomAppBar";

// ============================================
// Bottom App Bar Item
// ============================================

const m3BottomAppBarItemVariants = cva(
	[
		"flex flex-col items-center justify-center",
		"min-w-[64px] h-14",
		"gap-1",
		"rounded-[var(--md-sys-shape-corner-large)]",
		"transition-all duration-200",
		"cursor-pointer",
		"md-label-medium",
		"md-ripple",
	].join(" "),
	{
		variants: {
			active: {
				true: ["text-[var(--md-sys-color-on-surface)]"].join(" "),
				false: [
					"text-[var(--md-sys-color-on-surface-variant)]",
					"hover:bg-[var(--md-sys-color-on-surface)]/10",
				].join(" "),
			},
		},
		defaultVariants: {
			active: false,
		},
	},
);

interface M3BottomAppBarItemProps
	extends React.ComponentProps<"button">,
		VariantProps<typeof m3BottomAppBarItemVariants> {
	icon: React.ReactNode;
	label: string;
	activeIndicator?: boolean;
	asChild?: boolean;
}

const M3BottomAppBarItem = React.forwardRef<
	HTMLButtonElement,
	M3BottomAppBarItemProps
>(
	(
		{
			className,
			active,
			icon,
			label,
			activeIndicator = true,
			asChild = false,
			...props
		},
		ref,
	) => {
		const Comp = asChild ? Slot.Root : "button";

		return (
			<Comp
				ref={ref}
				className={cn(m3BottomAppBarItemVariants({ active, className }))}
				{...props}
			>
				<div
					className={cn(
						"flex items-center justify-center w-8 h-8 rounded-full",
						active && activeIndicator
							? "bg-[var(--md-sys-color-secondary-container)]"
							: "",
					)}
				>
					{icon}
				</div>
				<span className="text-[11px] leading-4">{label}</span>
			</Comp>
		);
	},
);
M3BottomAppBarItem.displayName = "M3BottomAppBarItem";

export {
	M3NavigationRail,
	M3NavigationRailItem,
	M3BottomAppBar,
	M3BottomAppBarItem,
	m3NavigationRailVariants,
	m3NavigationRailItemVariants,
	m3BottomAppBarVariants,
	m3BottomAppBarItemVariants,
};
export type {
	M3NavigationRailProps,
	M3NavigationRailItemProps,
	M3BottomAppBarProps,
	M3BottomAppBarItemProps,
};
