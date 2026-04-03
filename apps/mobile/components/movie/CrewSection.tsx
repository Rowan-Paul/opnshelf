import type { TmdbCrewDto, TmdbMovieDetailDto } from "@opnshelf/api";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface CrewSectionProps {
	movie: TmdbMovieDetailDto | null;
}

export function CrewSection({ movie }: CrewSectionProps) {
	const { colors } = useTheme();

	if (!movie?.credits?.crew || movie.credits.crew.length === 0) return null;

	const crew = movie.credits.crew;

	// Separate directors from other crew
	const directors = crew.filter((person: TmdbCrewDto) => person.job === "Director");
	const otherCrew = crew.filter((person: TmdbCrewDto) => person.job !== "Director");

	const renderCrewCard = (person: TmdbCrewDto) => (
		<TouchableOpacity
			key={`${person.id}-${person.job}`}
			style={[styles.crewCard, { backgroundColor: colors.surfaceContainer }]}
			activeOpacity={0.8}
		>
			<Text style={[styles.crewName, { color: colors.onSurface }]} numberOfLines={1}>
				{person.name}
			</Text>
			<Text style={[styles.crewJob, { color: colors.onSurfaceVariant }]}>
				{person.job}
			</Text>
		</TouchableOpacity>
	);

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: colors.primary }]}>
				Crew
			</Text>
			{directors.length > 0 && (
				<>
					<Text style={[styles.subSectionTitle, { color: colors.onSurfaceVariant }]}>
						Director{directors.length > 1 ? "s" : ""}
					</Text>
					<View style={styles.crewGrid}>
						{directors.map(renderCrewCard)}
					</View>
				</>
			)}
			{otherCrew.length > 0 && (
				<>
					{directors.length > 0 && (
						<Text style={[styles.subSectionTitle, { color: colors.onSurfaceVariant, marginTop: spacing.md }]}>
							Other Crew
						</Text>
					)}
					<View style={styles.crewGrid}>
						{otherCrew.map(renderCrewCard)}
					</View>
				</>
			)}
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
	subSectionTitle: {
		fontSize: 14,
		fontWeight: "500",
		marginBottom: spacing.xs,
	},
	crewGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	crewCard: {
		padding: spacing.md,
		borderRadius: borderRadius.md,
		minWidth: "45%",
		flex: 1,
	},
	crewName: {
		fontSize: 14,
		fontWeight: "600",
		marginBottom: 2,
	},
	crewJob: {
		fontSize: 12,
	},
});
