import type { TmdbMovieDetailDto } from "@opnshelf/api";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, colors, spacing } from "@/constants/theme";
import { formatRuntime } from "@/lib/utils";

interface MovieDetailsProps {
	movie: TmdbMovieDetailDto | null;
	showHours: boolean;
	onToggleHours: () => void;
}

export function MovieDetails({ movie, showHours, onToggleHours }: MovieDetailsProps) {
	if (!movie) return null;

	const movieColors = {
		primary: "#8b5cf6",
		accent: "#a855f7",
		muted: "#4c1d95",
	};

	return (
		<View style={styles.infoGrid}>
			{movie.release_date && (
				<View style={styles.infoCard}>
					<Text style={styles.infoLabel}>Release Date</Text>
					<Text style={[styles.infoValue, { color: movieColors.accent }]}>
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
					style={styles.infoCard}
					activeOpacity={0.8}
				>
					<Text style={styles.infoLabel}>Runtime</Text>
					<Text style={[styles.infoValue, { color: movieColors.accent }]}>
						{formatRuntime(movie.runtime, showHours)}
					</Text>
				</TouchableOpacity>
			)}
			{movie.vote_average !== undefined && (
				<View style={styles.infoCard}>
					<Text style={styles.infoLabel}>Rating</Text>
					<Text style={[styles.infoValue, { color: movieColors.accent }]}>
						{movie.vote_average.toFixed(1)}/10
					</Text>
				</View>
			)}
			{movie.vote_count !== undefined && (
				<View style={styles.infoCard}>
					<Text style={styles.infoLabel}>Votes</Text>
					<Text style={[styles.infoValue, { color: movieColors.accent }]}>
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
		backgroundColor: colors.card,
		padding: spacing.md,
		borderRadius: borderRadius.md,
		minWidth: "45%",
		flex: 1,
	},
	infoLabel: {
		color: colors.textMuted,
		fontSize: 12,
		marginBottom: spacing.xs,
	},
	infoValue: {
		fontSize: 16,
		fontWeight: "600",
	},
});
