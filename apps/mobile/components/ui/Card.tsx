import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, borderRadius, spacing } from "@/constants/theme";

interface CardProps {
	children: React.ReactNode;
	style?: ViewStyle;
	variant?: "default" | "muted";
}

export function Card({ children, style, variant = "default" }: CardProps) {
	return (
		<View style={[styles.base, styles[variant], style]}>
			{children}
		</View>
	);
}

interface CardContentProps {
	children: React.ReactNode;
	style?: ViewStyle;
}

export function CardContent({ children, style }: CardContentProps) {
	return <View style={[styles.content, style]}>{children}</View>;
}

interface CardHeaderProps {
	children: React.ReactNode;
	style?: ViewStyle;
}

export function CardHeader({ children, style }: CardHeaderProps) {
	return <View style={[styles.header, style]}>{children}</View>;
}

interface CardTitleProps {
	children: React.ReactNode;
}

export function CardTitle({ children }: CardTitleProps) {
	return <Text style={styles.title}>{children}</Text>;
}

interface CardDescriptionProps {
	children: React.ReactNode;
}

export function CardDescription({ children }: CardDescriptionProps) {
	return <Text style={styles.description}>{children}</Text>;
}

import { Text } from "react-native";

const styles = StyleSheet.create({
	base: {
		borderRadius: borderRadius.lg,
		overflow: "hidden",
	},
	default: {
		backgroundColor: colors.card,
		borderWidth: 1,
		borderColor: colors.border,
	},
	muted: {
		backgroundColor: colors.cardMuted,
	},
	content: {
		padding: spacing.md,
	},
	header: {
		padding: spacing.md,
		paddingBottom: spacing.sm,
	},
	title: {
		fontSize: 18,
		fontWeight: "600",
		color: colors.text,
		marginBottom: spacing.xs,
	},
	description: {
		fontSize: 14,
		color: colors.textMuted,
	},
});
