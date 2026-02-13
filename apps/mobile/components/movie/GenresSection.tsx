import type { TmdbMovieDetailDto } from "@opnshelf/api";
import { StyleSheet, Text, View } from "react-native";
import { borderRadius, spacing } from "@/constants/theme";

interface GenresSectionProps {
	movie: TmdbMovieDetailDto | null;
}

export function GenresSection({ movie }: GenresSectionProps) {
	if (!movie?.genres || movie.genres.length === 0) return null;

	const movieColors = {
		primary: "#8b5cf6",
		accent: "#a855f7",
	};

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: movieColors.primary }]}>
				Genres
			</Text>
			<View style={styles.genresContainer}>
				{movie.genres.map((genre) => (
					<View
						key={genre.id}
						style={[
							styles.genreBadge,
							{
								backgroundColor: `${movieColors.primary}20`,
								borderColor: `${movieColors.primary}40`,
							},
						]}
					>
						<Text style={[styles.genreText, { color: movieColors.accent }]}>
							{genre.name}
						</Text>
					</View>
				))}
			</View>
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
	genresContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	genreBadge: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		borderWidth: 1,
	},
	genreText: {
		fontSize: 14,
		fontWeight: "500",
	},
});
