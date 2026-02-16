import { Pressable, StyleSheet, type PressableProps, type ViewStyle, type StyleProp } from "react-native";
import { useTheme } from "@/contexts/theme";
import { m3BorderRadius } from "@/constants/material-theme";

export type M3FabVariant = "primary" | "secondary" | "tertiary";
export type M3FabSize = "small" | "regular" | "large";

export interface M3FabProps extends Omit<PressableProps, "style"> {
	variant?: M3FabVariant;
	size?: M3FabSize;
	icon: React.ReactNode;
	label?: string;
	style?: StyleProp<ViewStyle>;
}

export function M3Fab({
	variant = "primary",
	size = "regular",
	icon,
	label,
	disabled,
	style,
	...props
}: M3FabProps) {
	const { colors } = useTheme();

	const getBackgroundColor = (): string => {
		switch (variant) {
			case "primary":
				return colors.primaryContainer;
			case "secondary":
				return colors.secondaryContainer;
			case "tertiary":
				return colors.tertiaryContainer;
			default:
				return colors.primaryContainer;
		}
	};

	const getIconColor = (): string => {
		switch (variant) {
			case "primary":
				return colors.onPrimaryContainer;
			case "secondary":
				return colors.onSecondaryContainer;
			case "tertiary":
				return colors.onTertiaryContainer;
			default:
				return colors.onPrimaryContainer;
		}
	};

	const getSizeStyles = (): ViewStyle => {
		switch (size) {
			case "small":
				return {
					width: 40,
					height: 40,
					borderRadius: m3BorderRadius.medium,
				};
			case "large":
				return {
					width: 96,
					height: 96,
					borderRadius: m3BorderRadius.extraLarge,
				};
			default:
				return {
					width: 56,
					height: 56,
					borderRadius: m3BorderRadius.large,
				};
		}
	};

	const fabStyles: ViewStyle = {
		backgroundColor: getBackgroundColor(),
		...getSizeStyles(),
		shadowColor: colors.shadow,
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.25,
		shadowRadius: 6,
		elevation: 3,
		...(disabled ? { opacity: 0.38 } : {}),
	};

	return (
		<Pressable
			style={[styles.fab, fabStyles, style]}
			disabled={disabled}
			{...props}
		>
			{icon}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	fab: {
		alignItems: "center",
		justifyContent: "center",
	},
});
