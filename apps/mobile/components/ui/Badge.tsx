import { StyleSheet, View, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, borderRadius } from "@/constants/theme";

interface BadgeProps {
	children: React.ReactNode;
	variant?: "default" | "secondary" | "success" | "outline";
	style?: StyleProp<ViewStyle>;
}

export function Badge({ children, variant = "default", style }: BadgeProps) {
	return (
		<View style={[styles.base, styles[variant], style]}>
			<Text style={[styles.text, styles[`${variant}Text`]]}>{children}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	base: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: borderRadius.full,
		alignSelf: "flex-start",
	},
	default: {
		backgroundColor: colors.primary,
	},
	secondary: {
		backgroundColor: colors.cardMuted,
	},
	success: {
		backgroundColor: colors.success,
	},
	outline: {
		backgroundColor: "transparent",
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	text: {
		fontSize: 12,
		fontWeight: "500",
	},
	defaultText: {
		color: colors.text,
	},
	secondaryText: {
		color: colors.textMuted,
	},
	successText: {
		color: colors.text,
	},
	outlineText: {
		color: colors.textMuted,
	},
});
