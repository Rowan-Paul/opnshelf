import type { TmdbCrewDto, TmdbMovieDetailDto } from "@opnshelf/api";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, colors, spacing } from "@/constants/theme";

interface CrewSectionProps {
	movie: TmdbMovieDetailDto | null;
}

export function CrewSection({ movie }: CrewSectionProps) {
	if (!movie?.credits?.crew || movie.credits.crew.length === 0) return null;

	const movieColors = {
		primary: "#8b5cf6",
		muted: "#4c1d95",
	};

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: movieColors.primary }]}>
				Crew
			</Text>
			<View style={styles.crewGrid}>
				{movie.credits.crew.map((person: TmdbCrewDto) => (
					<TouchableOpacity
						key={`${person.id}-${person.job}`}
						style={styles.crewCard}
						activeOpacity={0.8}
					>
						<Text style={styles.crewName} numberOfLines={1}>
							{person.name}
						</Text>
						<Text
							style={[styles.crewJob, { color: movieColors.muted }]}
						>
							{person.job}
						</Text>
					</TouchableOpacity>
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
	crewGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	crewCard: {
		backgroundColor: colors.card,
		padding: spacing.md,
		borderRadius: borderRadius.md,
		minWidth: "45%",
		flex: 1,
	},
	crewName: {
		color: colors.text,
		fontSize: 14,
		fontWeight: "600",
		marginBottom: 2,
	},
	crewJob: {
		fontSize: 12,
	},
});
