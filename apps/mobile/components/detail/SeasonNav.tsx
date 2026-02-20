import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface SeasonNavProps {
	currentSeason: number;
	totalSeasons: number;
	onPreviousSeason?: () => void;
	onNextSeason?: () => void;
}

export function SeasonNav({
	currentSeason,
	totalSeasons,
	onPreviousSeason,
	onNextSeason,
}: SeasonNavProps) {
	const { colors } = useTheme();
	const hasPrev = currentSeason > 1;
	const hasNext = currentSeason < totalSeasons;

	if (!hasPrev && !hasNext) {
		return null;
	}

	return (
		<View style={styles.container}>
			{hasPrev ? (
				<TouchableOpacity
					onPress={onPreviousSeason}
					style={[styles.button, { borderColor: colors.outline }]}
					activeOpacity={0.8}
				>
					<Ionicons name="arrow-back" size={18} color={colors.onSurfaceVariant} />
					<Text style={[styles.buttonText, { color: colors.onSurfaceVariant }]}>
						Season {currentSeason - 1}
					</Text>
				</TouchableOpacity>
			) : (
				<View style={styles.placeholder} />
			)}

			{hasNext ? (
				<TouchableOpacity
					onPress={onNextSeason}
					style={[styles.button, { borderColor: colors.outline }]}
					activeOpacity={0.8}
				>
					<Text style={[styles.buttonText, { color: colors.onSurfaceVariant }]}>
						Season {currentSeason + 1}
					</Text>
					<Ionicons name="arrow-forward" size={18} color={colors.onSurfaceVariant} />
				</TouchableOpacity>
			) : (
				<View style={styles.placeholder} />
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	button: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.xs,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
	},
	buttonText: {
		fontSize: 14,
		fontWeight: "500",
	},
	placeholder: {
		flex: 1,
	},
});
