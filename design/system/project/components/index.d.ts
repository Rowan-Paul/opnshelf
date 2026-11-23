// Opnshelf component types. Documentation for consumers; not type-checked here.
// Source: apps/web/src/components. Every component is on window.Opnshelf.
import type * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Visual style. `default` is the amber primary action. */
	variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	/** Height: xs 24px, sm 32px, default 36px, lg 40px. The icon sizes are squares. */
	size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
	/** Render the child element (for example a link) with button styling. */
	asChild?: boolean;
}

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
	checked?: boolean;
	defaultChecked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
	/** default 32 by 18px, sm 24 by 14px. */
	size?: "sm" | "default";
}

export interface TooltipProps {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** A TooltipTrigger and a TooltipContent. */
	children: React.ReactNode;
}
export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
	side?: "top" | "right" | "bottom" | "left";
	sideOffset?: number;
}

export interface DialogProps {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** A DialogTrigger and a DialogContent. */
	children: React.ReactNode;
}
export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Show the X in the top-right corner. Default true. */
	showCloseButton?: boolean;
}
export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Append an outline "Close" button. Default false. */
	showCloseButton?: boolean;
}

export interface DropdownMenuProps {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** A DropdownMenuTrigger and a DropdownMenuContent. */
	children: React.ReactNode;
}
export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
	align?: "start" | "center" | "end";
	side?: "top" | "right" | "bottom" | "left";
	sideOffset?: number;
}
export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
	/** `destructive` for removals. */
	variant?: "default" | "destructive";
	/** Indent to align with checkbox and radio items. */
	inset?: boolean;
	disabled?: boolean;
	onSelect?: (event: Event) => void;
}

export interface SelectProps {
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	disabled?: boolean;
	/** A SelectTrigger and a SelectContent. */
	children: React.ReactNode;
}
export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** default 36px, sm 32px. */
	size?: "sm" | "default";
}
export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
	value: string;
	disabled?: boolean;
}

export interface PopoverProps {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** A PopoverTrigger and a PopoverContent. */
	children: React.ReactNode;
}
export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
	align?: "start" | "center" | "end";
	sideOffset?: number;
}

export interface StarRatingProps {
	/** The Rating on the 1 to 10 scale; half a star per point. */
	value?: number;
	/** Makes it editable. */
	onChange?: (value: number) => void;
	/** sm 14px, md 20px, lg 24px stars. */
	size?: "sm" | "md" | "lg";
	readOnly?: boolean;
	/** Show "8/10" beside the stars. Defaults to the value of readOnly. */
	showValue?: boolean;
}

export interface WatchCountBadgeProps {
	/** The viewer's own Watches. Undefined means "watched", count unknown. */
	watchCount?: number;
	/** Sizing and positioning for the surface, for example "h-6 w-6". */
	className?: string;
}

export interface ContentStateProps {
	/** A Lucide icon for the empty variant, for example Opnshelf.icons.StickyNote. */
	icon?: React.ComponentType<{ className?: string }>;
	/** One sentence. */
	message: string;
	variant?: "empty" | "error";
}

export interface MediaCardProps {
	id: string | number;
	title: string;
	displayTitle?: string;
	seasonNumber?: number;
	episodeNumber?: number;
	posterUrl: string;
	/** Opt in for initially visible cards; offscreen cards load lazily. */
	imageLoading?: "eager" | "lazy";
	backdropUrl?: string;
	type: "movie" | "show";
	tmdbRating?: number;
	globalRating?: number;
	userRating?: number;
	duration?: string;
	episodeInfo?: string;
	progressText?: string;
	isWatched?: boolean;
	/** Viewer-relative Watches represented by this card. */
	watchCount?: number;
	/** Distinct aired episode completion, used only for whole-show cards. */
	episodeProgress?: { watched: number; total: number; percentage: number };
	isProgressLoading?: boolean;
	isProgressUnavailable?: boolean;
	isInWatchlist?: boolean;
	isInAnyList?: boolean;
	watchedDate?: string;
	role?: string;
	year?: string | number;
	/** sm 120px, md 160 to 180px, lg 200 to 220px wide. */
	size?: "sm" | "md" | "lg";
	/** Stretch to fill the parent grid cell instead of using a fixed width. */
	fill?: boolean;
	layout?: "poster" | "backdrop";
	href?: string;
	onWatch?: () => void;
	onManageLists?: () => void;
	onMarkWatched?: () => void;
	onUnmarkWatched?: () => void;
	onRemove?: () => void;
	isRemoving?: boolean;
	isMarkWatchedPending?: boolean;
	isUnmarkWatchedPending?: boolean;
}
