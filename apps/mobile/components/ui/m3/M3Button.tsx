import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	type PressableProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { useTheme } from "@/contexts/theme";
import { m3BorderRadius } from "@/constants/material-theme";

export type M3ButtonVariant = "elevated" | "filled" | "filled-tonal" | "outlined" | "text";
export type M3ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";

export interface M3ButtonProps extends PressableProps {
	variant?: M3ButtonVariant;
	size?: M3ButtonSize;
	isLoading?: boolean;
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
}

export function M3Button({
	variant = "filled",
	size = "default",
	isLoading = false,
	children,
	style,
	disabled,
	...props
}: M3ButtonProps) {
	const { colors } = useTheme();

	const getVariantStyles = (): ViewStyle => {
		switch (variant) {
			case "elevated":
				return {
					backgroundColor: colors.surfaceContainerLow,
					shadowColor: colors.shadow,
					shadowOffset: { width: 0, height: 1 },
					shadowOpacity: 0.15,
					shadowRadius: 3,
					elevation: 1,
				};
			case "filled":
				return {
					backgroundColor: colors.primary,
				};
			case "filled-tonal":
				return {
					backgroundColor: colors.secondaryContainer,
				};
			case "outlined":
				return {
					backgroundColor: "transparent",
					borderWidth: 1,
					borderColor: colors.outline,
				};
			case "text":
				return {
					backgroundColor: "transparent",
				};
			default:
				return {};
		}
	};

	const getTextColor = (): string => {
		switch (variant) {
			case "elevated":
				return colors.primary;
			case "filled":
				return colors.onPrimary;
			case "filled-tonal":
				return colors.onSecondaryContainer;
			case "outlined":
			case "text":
				return colors.primary;
			default:
				return colors.onSurface;
		}
	};

	const getSizeStyles = (): ViewStyle => {
		switch (size) {
			case "sm":
				return {
					paddingVertical: 6,
					paddingHorizontal: 16,
					minHeight: 32,
				};
			case "lg":
				return {
					paddingVertical: 14,
					paddingHorizontal: 24,
					minHeight: 48,
				};
			case "icon":
				return {
					width: 40,
					height: 40,
					padding: 8,
				};
			case "icon-sm":
				return {
					width: 32,
					height: 32,
					padding: 4,
				};
			case "icon-lg":
				return {
					width: 48,
					height: 48,
					padding: 12,
				};
			default:
				return {
					paddingVertical: 10,
					paddingHorizontal: 24,
					minHeight: 40,
				};
		}
	};

	const buttonStyles: ViewStyle = {
		borderRadius: m3BorderRadius.full,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		...getVariantStyles(),
		...getSizeStyles(),
		...(disabled || isLoading ? { opacity: 0.38 } : {}),
	};

	return (
		<Pressable
			style={[buttonStyles, style]}
			disabled={disabled || isLoading}
			{...props}
		>
			{isLoading ? (
				<>
					<ActivityIndicator
						size="small"
						color={variant === "filled" ? colors.onPrimary : colors.primary}
					/>
					<Text style={[styles.text, { color: getTextColor(), marginLeft: 8 }]}>
						Loading
					</Text>
				</>
			) : typeof children === "string" ? (
				<Text style={[styles.text, { color: getTextColor() }]}>{children}</Text>
			) : (
				children
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	text: {
		fontSize: 14,
		fontWeight: "600",
		letterSpacing: 0.1,
	},
});
