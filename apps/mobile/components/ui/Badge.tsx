import { StyleSheet, View, Text, type StyleProp, type ViewStyle } from "react-native";
import { borderRadius } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface BadgeProps {
	children: React.ReactNode;
	variant?: "default" | "secondary" | "success" | "outline";
	style?: StyleProp<ViewStyle>;
}

export function Badge({ children, variant = "default", style }: BadgeProps) {
	const { colors } = useTheme();

	const getVariantStyles = () => {
		switch (variant) {
			case "secondary":
				return {
					backgroundColor: colors.surfaceContainerHigh,
					textColor: colors.onSurfaceVariant,
				};
			case "success":
				return {
					backgroundColor: colors.tertiary,
					textColor: colors.onTertiary,
				};
			case "outline":
				return {
					backgroundColor: "transparent",
					borderColor: colors.outline,
					textColor: colors.onSurfaceVariant,
				};
			default:
				return {
					backgroundColor: colors.primary,
					textColor: colors.onPrimary,
				};
		}
	};

	const variantStyles = getVariantStyles();

	return (
		<View style={[styles.base, { backgroundColor: variantStyles.backgroundColor, borderColor: variantStyles.borderColor }, style]}>
			<Text style={[styles.text, { color: variantStyles.textColor }]}>{children}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	base: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: borderRadius.full,
		alignSelf: "flex-start",
		borderWidth: 1,
	},
	text: {
		fontSize: 12,
		fontWeight: "500",
	},
});
