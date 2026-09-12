import type { ReactNode } from "react";
import {
	ActivityIndicator,
	Pressable,
	type PressableProps,
	useColorScheme,
	View,
} from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "destructive";
export type ButtonSize = "md" | "sm";

/**
 * Spinner tints, which cannot come from a class: ActivityIndicator takes a
 * colour prop. These mirror the tokens in global.css - `--color-primary-
 * foreground` and `--color-destructive` are the same in both themes, and
 * `--color-foreground` is not.
 */
const SPINNER = {
	primary: "#3f2e00",
	destructive: "#ef4444",
	foreground: { light: "#0f172a", dark: "#f8fafc" },
} as const;

/** Every disabled button dims by the same amount. It was 0.5, 0.6 and 0.7. */
const DISABLED_OPACITY = 0.6;

const VARIANT = {
	primary: { box: "bg-primary", label: "text-primary-foreground" },
	secondary: { box: "border border-border", label: "text-foreground" },
	destructive: { box: "border border-destructive", label: "text-destructive" },
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
	variant?: ButtonVariant;
	size?: ButtonSize;
	/** Blocks presses and dims, without implying anything is in flight. */
	disabled?: boolean;
	/** Blocks presses and shows a spinner. */
	loading?: boolean;
	/** Replaces `label` while loading, e.g. "Creating account". */
	loadingLabel?: string;
	/** Rendered before the label, usually an icon. */
	leading?: ReactNode;
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
 * The spinner is absolutely positioned rather than inserted into the row: a
 * spinner that takes part in the layout shoves the label sideways the moment
 * you tap.
 */
export function Button({
	label,
	variant = "primary",
	size = "md",
	disabled = false,
	loading = false,
	loadingLabel,
	leading,
	className,
	...props
}: ButtonProps) {
	const dark = useColorScheme() === "dark";
	const locked = disabled || loading;
	const spinner =
		variant === "primary"
			? SPINNER.primary
			: variant === "destructive"
				? SPINNER.destructive
				: dark
					? SPINNER.foreground.dark
					: SPINNER.foreground.light;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: locked, busy: loading }}
			disabled={locked}
			className={cn(
				"flex-row items-center justify-center gap-2 rounded-lg",
				VARIANT[variant].box,
				SIZE[size].box,
				className,
			)}
			style={{ opacity: locked ? DISABLED_OPACITY : 1 }}
			{...props}
		>
			{leading}
			<Text
				className={cn(
					"font-semibold",
					VARIANT[variant].label,
					SIZE[size].label,
				)}
			>
				{loading ? (loadingLabel ?? label) : label}
			</Text>
			{loading ? (
				<View className="absolute right-4 justify-center">
					<ActivityIndicator size="small" color={spinner} />
				</View>
			) : null}
		</Pressable>
	);
}
