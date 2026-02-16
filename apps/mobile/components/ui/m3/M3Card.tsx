import { StyleSheet, View, Text, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { useTheme } from "@/contexts/theme";
import { m3BorderRadius } from "@/constants/material-theme";

export type M3CardVariant = "elevated" | "filled" | "outlined";

export interface M3CardProps {
	children: ReactNode;
	style?: ViewStyle;
	variant?: M3CardVariant;
}

export function M3Card({ children, style, variant = "elevated" }: M3CardProps) {
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
					backgroundColor: colors.surfaceContainerHighest,
				};
			case "outlined":
				return {
					backgroundColor: colors.surface,
					borderWidth: 1,
					borderColor: colors.outlineVariant,
				};
			default:
				return {};
		}
	};

	return (
		<View style={[styles.card, getVariantStyles(), style]}>{children}</View>
	);
}

interface M3CardHeaderProps {
	children: ReactNode;
	style?: ViewStyle;
}

export function M3CardHeader({ children, style }: M3CardHeaderProps) {
	return <View style={[styles.header, style]}>{children}</View>;
}

interface M3CardTitleProps {
	children: string;
	style?: ViewStyle;
}

export function M3CardTitle({ children, style }: M3CardTitleProps) {
	const { colors } = useTheme();
	return (
		<Text style={[styles.title, { color: colors.onSurface }, style]}>
			{children}
		</Text>
	);
}

interface M3CardDescriptionProps {
	children: string;
	style?: ViewStyle;
}

export function M3CardDescription({ children, style }: M3CardDescriptionProps) {
	const { colors } = useTheme();
	return (
		<Text style={[styles.description, { color: colors.onSurfaceVariant }, style]}>
			{children}
		</Text>
	);
}

interface M3CardContentProps {
	children: ReactNode;
	style?: ViewStyle;
}

export function M3CardContent({ children, style }: M3CardContentProps) {
	return <View style={[styles.content, style]}>{children}</View>;
}

interface M3CardFooterProps {
	children: ReactNode;
	style?: ViewStyle;
}

export function M3CardFooter({ children, style }: M3CardFooterProps) {
	return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
	card: {
		borderRadius: m3BorderRadius.medium,
		overflow: "hidden",
	},
	header: {
		padding: 16,
		paddingBottom: 4,
	},
	title: {
		fontSize: 18,
		fontWeight: "600",
		marginBottom: 4,
	},
	description: {
		fontSize: 14,
		lineHeight: 20,
	},
	content: {
		padding: 16,
		paddingTop: 8,
	},
	footer: {
		padding: 16,
		paddingTop: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
});
