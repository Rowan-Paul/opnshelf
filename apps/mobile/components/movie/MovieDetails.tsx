import type { TmdbMovieDetailDto } from "@opnshelf/api";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { formatRuntime } from "@/lib/utils";

interface MovieDetailsProps {
	movie: TmdbMovieDetailDto | null;
	showHours: boolean;
	onToggleHours: () => void;
}

export function MovieDetails({ movie, showHours, onToggleHours }: MovieDetailsProps) {
	const { colors } = useTheme();

	if (!movie) return null;

	return (
		<View style={styles.infoGrid}>
			{movie.release_date && (
				<View style={[styles.infoCard, { backgroundColor: colors.surfaceContainer }]}>
					<Text style={[styles.infoLabel, { color: colors.onSurfaceVariant }]}>Release Date</Text>
					<Text style={[styles.infoValue, { color: colors.primary }]}>
						{new Date(movie.release_date).toLocaleDateString("en-US", {
							year: "numeric",
							month: "short",
							day: "numeric",
						})}
					</Text>
				</View>
			)}
			{movie.runtime && (
				<TouchableOpacity
					onPress={onToggleHours}
					style={[styles.infoCard, { backgroundColor: colors.surfaceContainer }]}
					activeOpacity={0.8}
				>
					<Text style={[styles.infoLabel, { color: colors.onSurfaceVariant }]}>Runtime</Text>
					<Text style={[styles.infoValue, { color: colors.primary }]}>
						{formatRuntime(movie.runtime, showHours)}
					</Text>
				</TouchableOpacity>
			)}
			{movie.vote_average !== undefined && (
				<View style={[styles.infoCard, { backgroundColor: colors.surfaceContainer }]}>
					<Text style={[styles.infoLabel, { color: colors.onSurfaceVariant }]}>Rating</Text>
					<Text style={[styles.infoValue, { color: colors.primary }]}>
						{movie.vote_average.toFixed(1)}/10
					</Text>
				</View>
			)}
			{movie.vote_count !== undefined && (
				<View style={[styles.infoCard, { backgroundColor: colors.surfaceContainer }]}>
					<Text style={[styles.infoLabel, { color: colors.onSurfaceVariant }]}>Votes</Text>
					<Text style={[styles.infoValue, { color: colors.primary }]}>
						{movie.vote_count.toLocaleString()}
					</Text>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	infoGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		marginTop: spacing.lg,
		gap: spacing.sm,
	},
	infoCard: {
		padding: spacing.md,
		borderRadius: borderRadius.md,
		minWidth: "45%",
		flex: 1,
	},
	infoLabel: {
		fontSize: 12,
		marginBottom: spacing.xs,
	},
	infoValue: {
		fontSize: 16,
		fontWeight: "600",
	},
});
