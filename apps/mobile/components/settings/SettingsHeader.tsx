import { ArrowLeft, Globe } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ExtendedThemeColors } from "@/constants/extended-theme";
import { spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface SettingsHeaderProps {
	onBack: () => void;
}

export function SettingsHeader({ onBack }: SettingsHeaderProps) {
	const { colors } = useTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);

	return (
		<View style={styles.header}>
			<TouchableOpacity onPress={onBack} style={styles.backButton}>
				<ArrowLeft size={24} color={colors.onBackground} />
			</TouchableOpacity>
			<View style={styles.headerLeft}>
				<Globe size={28} color={colors.primary} />
				<Text style={styles.title}>Settings</Text>
			</View>
		</View>
	);
}

const createStyles = (colors: ExtendedThemeColors) =>
	StyleSheet.create({
		header: {
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.md,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
		},
		backButton: {
			padding: spacing.sm,
		},
		headerLeft: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		title: {
			fontSize: 28,
			fontWeight: "bold",
			color: colors.text,
		},
	});
