import type { TmdbMovieDetailDto } from "@opnshelf/api";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants/theme";

interface MovieOverviewProps {
	movie: TmdbMovieDetailDto | null;
}

export function MovieOverview({ movie }: MovieOverviewProps) {
	if (!movie?.overview) return null;

	const movieColors = {
		primary: "#8b5cf6",
		accent: "#a855f7",
	};

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: movieColors.primary }]}>
				Overview
			</Text>
			<Text style={styles.overview}>{movie.overview}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		marginTop: spacing.lg,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		marginBottom: spacing.md,
	},
	overview: {
		color: colors.text,
		fontSize: 14,
		lineHeight: 22,
	},
});
