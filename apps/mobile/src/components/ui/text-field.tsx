import { forwardRef, type ReactNode } from "react";
import { TextInput, type TextInputProps, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/** slate-400 — shared placeholder tint across every input. */
const PLACEHOLDER_COLOR = "#94a3b8";

export interface TextFieldProps extends TextInputProps {
	/** Label rendered above the field. */
	label?: string;
	/** Hint rendered below the field. Suppressed while `error` is set. */
	helperText?: string;
	/** Error message rendered below the field (replaces `helperText`). */
	error?: string;
	/** Surface variant: `card` for screens, `subtle` for bottom sheets. */
	variant?: "card" | "subtle";
	/** Node rendered inside the field before the input (e.g. a search icon). */
	leading?: ReactNode;
	/** Node rendered inside the field after the input (e.g. a clear button or handle suffix). */
	trailing?: ReactNode;
	/** Extra classes for the outer wrapper (label + field + hint). */
	containerClassName?: string;
	/** Extra classes for the `TextInput` itself (e.g. `min-h-36` for multiline). */
	className?: string;
}

/**
 * Shared text input: themed border + surface, optional label and helper/error
 * text, and optional leading/trailing adornments.
 *
 * The input is styled `text-[16px]` (font-size only) rather than `text-base`:
 * `text-base` also sets a `lineHeight`, which clips descenders in a single-line
 * iOS TextInput. Keep it font-size-only — do not "canonicalise" to `text-base`.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(
	function TextField(
		{
			label,
			helperText,
			error,
			variant = "card",
			leading,
			trailing,
			containerClassName,
			className,
			multiline,
			placeholderTextColor = PLACEHOLDER_COLOR,
			...props
		},
		ref,
	) {
		return (
			<View className={cn("gap-1.5", containerClassName)}>
				{label ? (
					<Text className="font-medium text-foreground text-sm">{label}</Text>
				) : null}

				<View
					className={cn(
						"flex-row gap-2 rounded-lg border border-border px-4",
						variant === "subtle" ? "bg-background-subtle" : "bg-card",
						multiline ? "items-start" : "items-center",
					)}
				>
					{leading}
					<TextInput
						ref={ref}
						multiline={multiline}
						textAlignVertical={multiline ? "top" : undefined}
						placeholderTextColor={placeholderTextColor}
						className={cn(
							"flex-1 py-3 font-sans text-[16px] text-foreground",
							// Multiline can't clip the way a single line does, so restore a
							// comfortable line-height for readability (single-line stays
							// line-height-free to avoid the iOS descender clipping).
							multiline && "leading-6",
							className,
						)}
						{...props}
					/>
					{trailing}
				</View>

				{error ? (
					<Text className="text-destructive text-xs">{error}</Text>
				) : helperText ? (
					<Text className="text-muted-foreground text-xs">{helperText}</Text>
				) : null}
			</View>
		);
	},
);
