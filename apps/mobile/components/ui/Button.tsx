import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors, borderRadius } from "@/constants/theme";

interface ButtonProps extends PressableProps {
	variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
	size?: "sm" | "md" | "lg";
	isLoading?: boolean;
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
}

export function Button({
	variant = "primary",
	size = "md",
	isLoading = false,
	children,
	style,
	disabled,
	...props
}: ButtonProps) {
	const buttonStyles = [
		styles.base,
		styles[variant],
		styles[size],
		(disabled || isLoading) && styles.disabled,
		style,
	];

	return (
		<Pressable style={buttonStyles} disabled={disabled || isLoading} {...props}>
			{isLoading ? (
				<ActivityIndicator size="small" color={variant === "primary" ? colors.text : colors.primary} />
			) : typeof children === "string" ? (
				<Text style={[styles.text, styles[`${variant}Text`]]}>{children}</Text>
			) : (
				children
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: borderRadius.lg,
	},
	sm: {
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	md: {
		paddingVertical: 10,
		paddingHorizontal: 16,
	},
	lg: {
		paddingVertical: 14,
		paddingHorizontal: 24,
	},
	primary: {
		backgroundColor: colors.primary,
	},
	secondary: {
		backgroundColor: colors.card,
	},
	outline: {
		backgroundColor: "transparent",
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	ghost: {
		backgroundColor: "transparent",
	},
	destructive: {
		backgroundColor: colors.error,
	},
	disabled: {
		opacity: 0.5,
	},
	text: {
		fontSize: 16,
		fontWeight: "600",
	},
	primaryText: {
		color: colors.text,
	},
	secondaryText: {
		color: colors.text,
	},
	outlineText: {
		color: colors.text,
	},
	ghostText: {
		color: colors.textMuted,
	},
	destructiveText: {
		color: colors.text,
	},
});
