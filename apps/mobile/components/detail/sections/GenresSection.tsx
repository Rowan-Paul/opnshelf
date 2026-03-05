import { StyleSheet, Text, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";

type GenreItem = {
	id: number;
	name: string;
};

type GenresSectionProps = {
	titleColor?: string;
	textColor?: string;
	genres?: GenreItem[];
};

export function GenresSection({
	titleColor,
	textColor,
	genres,
}: GenresSectionProps) {
	if (!genres?.length) {
		return null;
	}

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: titleColor }]}>Genres</Text>
			<View style={styles.genresContainer}>
				{genres.map((genre) => (
					<View
						key={genre.id}
						style={[
							styles.genreBadge,
							{
								backgroundColor: `${titleColor ?? "#ffffff"}20`,
								borderColor: `${titleColor ?? "#ffffff"}40`,
							},
						]}
					>
						<Text style={[styles.genreText, { color: textColor ?? titleColor }]}>
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
		gap: spacing.sm,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
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
