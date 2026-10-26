import { forwardRef, type ReactNode } from "react";
import {
	ActivityIndicator,
	Pressable,
	type PressableProps,
	useColorScheme,
	View,
	type ViewInstance,
} from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "md" | "sm";

/**
 * Spinner tints, which cannot come from a class: ActivityIndicator takes a
 * colour prop. These mirror the tokens in global.css - `--color-primary-
 * foreground` is the same in both themes, `--color-destructive` and
 * `--color-foreground` are not.
 */
const SPINNER = {
	primary: "#3f2e00",
	destructive: { light: "#dc2626", dark: "#ef4444" },
	foreground: { light: "#0f172a", dark: "#f8fafc" },
} as const;

/** Every dimmed button dims by the same amount. It was 0.5, 0.6 and 0.7. */
const DISABLED_OPACITY = 0.6;

const VARIANT = {
	primary: { box: "bg-primary", label: "text-primary-foreground" },
	secondary: { box: "border border-border", label: "text-foreground" },
	/** Dismiss-style action beside a primary one, like the web `btn-ghost`. */
	ghost: { box: "", label: "text-foreground" },
	destructive: { box: "border border-destructive", label: "text-destructive" },
} as const;

/**
 * Primary is the exception to dimming. Fading the amber fill collapses the
 * contrast against its dark label, so a disabled primary gets a muted fill
 * instead - a rule `integration-permission-row` worked out on its own before
 * this primitive existed.
 */
const DISABLED_PRIMARY = {
	box: "border border-border bg-background-subtle",
	label: "text-muted-foreground",
} as const;

/**
 * `md` matches the provider sign-in buttons, whose height Apple and Google
 * both constrain, so an auth screen reads as one stack.
 */
const SIZE = {
	md: { box: "h-12 px-4", label: "text-base" },
	sm: { box: "h-10 px-3", label: "text-sm" },
} as const;

export interface ButtonProps
	extends Omit<PressableProps, "children" | "style" | "disabled"> {
	label: string;
	/** A smaller muted second line under the label, e.g. a target's "S1E2". */
	description?: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
	/** Blocks presses and dims, without implying anything is in flight. */
	disabled?: boolean;
	/** Blocks presses and shows a centered spinner unless loadingLabel is set. */
	loading?: boolean;
	/** Replaces `label` and the spinner while loading, e.g. "Creating account". */
	loadingLabel?: string;
	/** Rendered before the label, usually an icon. */
	leading?: ReactNode;
	/** Rendered after the label. Hidden while loading. */
	trailing?: ReactNode;
	/** Layout classes for the button itself: `flex-1`, `mt-2`, `self-start`. */
	className?: string;
}

/**
 * The app's button.
 *
 * Exists because 200-odd hand-rolled Pressables had drifted into three
 * paddings, three disabled opacities, four hardcoded spinner tints and one
 * stray radius - differences nobody chose and no reviewer could catch, because
 * each one only looks wrong beside a button on another screen.
 *
 * A spinner replaces the visible label without changing its layout width, so
 * compact buttons cannot put a spinner on top of their text.
 */
export const Button = forwardRef<ViewInstance, ButtonProps>(function Button(
	{
		label,
		description,
		variant = "primary",
		size = "md",
		disabled = false,
		loading = false,
		loadingLabel,
		leading,
		trailing,
		className,
		...props
	},
	// Forwarded because `<Link asChild>` clones this and needs the handle.
	ref,
) {
	const dark = useColorScheme() === "dark";
	const locked = disabled || loading;
	const showSpinner = loading && !loadingLabel;
	// Loading keeps the filled look: it is momentary, and the spinner needs the
	// same contrast the label has.
	const muted = variant === "primary" && disabled && !loading;
	const spinner =
		variant === "primary"
			? SPINNER.primary
			: variant === "destructive"
				? dark
					? SPINNER.destructive.dark
					: SPINNER.destructive.light
				: dark
					? SPINNER.foreground.dark
					: SPINNER.foreground.light;

	// Android can wrap the last word below this fixed-height button.
	const labelText = (
		<Text
			numberOfLines={1}
			className={cn(
				"font-semibold",
				muted ? DISABLED_PRIMARY.label : VARIANT[variant].label,
				// Two lines must share the fixed height, so the label steps down.
				description ? SIZE.sm.label : SIZE[size].label,
				showSpinner && !description && "opacity-0",
			)}
		>
			{loading ? (loadingLabel ?? label) : label}
		</Text>
	);

	return (
		<Pressable
			ref={ref}
			accessibilityRole="button"
			accessibilityLabel={description ? `${label}, ${description}` : label}
			accessibilityState={{ disabled: locked, busy: loading }}
			disabled={locked}
			className={cn(
				"flex-row items-center justify-center gap-2 rounded-lg",
				muted ? DISABLED_PRIMARY.box : VARIANT[variant].box,
				// Two lines need the md height but sit side by side in pairs, so
				// they keep the compact padding.
				description ? "h-12 px-3" : SIZE[size].box,
				className,
			)}
			style={{ opacity: locked && !muted ? DISABLED_OPACITY : 1 }}
			{...props}
		>
			{leading}
			{description ? (
				<View className={cn("shrink items-center", showSpinner && "opacity-0")}>
					{labelText}
					<Text
						numberOfLines={1}
						className={cn(
							"text-xs",
							variant === "primary" && !muted
								? "text-primary-foreground"
								: "text-muted-foreground",
						)}
					>
						{description}
					</Text>
				</View>
			) : (
				labelText
			)}
			{showSpinner ? (
				<View className="absolute inset-0 items-center justify-center">
					<ActivityIndicator size="small" color={spinner} />
				</View>
			) : !loading ? (
				trailing
			) : null}
		</Pressable>
	);
});
