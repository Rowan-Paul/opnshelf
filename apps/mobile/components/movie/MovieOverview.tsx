import type { TmdbMovieDetailDto } from "@opnshelf/api";
import { StyleSheet, Text, View } from "react-native";
import { spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface MovieOverviewProps {
	movie: TmdbMovieDetailDto | null;
}

export function MovieOverview({ movie }: MovieOverviewProps) {
	const { colors } = useTheme();

	if (!movie?.overview) return null;

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: colors.primary }]}>
				Overview
			</Text>
			<Text style={[styles.overview, { color: colors.onSurface }]}>{movie.overview}</Text>
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
		fontSize: 14,
		lineHeight: 22,
	},
});
