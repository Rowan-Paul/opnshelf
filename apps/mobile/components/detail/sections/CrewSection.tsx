import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type CrewMember = {
	id: number;
	name: string;
	job?: string | null;
	department?: string | null;
};

type CrewSectionProps = {
	titleColor?: string;
	crew?: CrewMember[];
};

function getPersonSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export function CrewSection({ titleColor, crew }: CrewSectionProps) {
	const { colors } = useTheme();
	const router = useRouter();

	if (!crew?.length) {
		return null;
	}

	const handlePress = (person: CrewMember) => {
		router.push({
			pathname: "/person/[id]",
			params: {
				id: String(person.id),
				name: person.name,
			},
		});
	};

	// Separate directors from other crew
	const directors = crew.filter((person) => person.job === "Director");
	const otherCrew = crew.filter((person) => person.job !== "Director");

	const renderCrewCard = (person: CrewMember) => (
		<TouchableOpacity
			key={`${person.id}-${person.job || "crew"}`}
			style={[styles.crewCard, { backgroundColor: colors.surfaceContainer }]}
			activeOpacity={0.8}
			onPress={() => handlePress(person)}
		>
			<Text style={[styles.crewName, { color: colors.onSurface }]} numberOfLines={1}>
				{person.name}
			</Text>
			<Text style={[styles.crewJob, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
				{person.job || person.department || "Crew"}
			</Text>
		</TouchableOpacity>
	);

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: titleColor ?? colors.primary }]}>Crew</Text>
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
		gap: spacing.md,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
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
		flex: 1,
		minWidth: "45%",
	},
	crewName: {
		fontSize: 14,
		fontWeight: "500",
		marginBottom: 2,
	},
	crewJob: {
		fontSize: 12,
	},
});
