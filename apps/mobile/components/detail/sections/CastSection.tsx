import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { getTmdbProfileUrl } from "@/lib/utils";

type CastMember = {
	id: number;
	name: string;
	character?: string;
	profile_path?: string | null;
};

type CastSectionProps = {
	titleColor?: string;
	cast?: CastMember[];
};

function getPersonSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export function CastSection({ titleColor, cast }: CastSectionProps) {
	const { colors } = useTheme();
	const router = useRouter();

	if (!cast?.length) {
		return null;
	}

	const handlePress = (person: CastMember) => {
		const personSlug = getPersonSlug(person.name);
		router.push({
			pathname: "/person/[id]",
			params: {
				id: String(person.id),
				name: person.name,
			},
		});
	};

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: titleColor ?? colors.primary }]}>Cast</Text>
			<View style={styles.castContainer}>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.castScrollContent}
				>
					{cast.map((person) => {
						const profileUrl = getTmdbProfileUrl(person.profile_path);
						return (
							<TouchableOpacity
								key={person.id}
								style={styles.castCard}
								activeOpacity={0.8}
								onPress={() => handlePress(person)}
							>
								<View style={styles.castImageContainer}>
									{profileUrl ? (
										<Image source={{ uri: profileUrl }} style={styles.castImage} contentFit="cover" />
									) : (
										<View
											style={[
												styles.castImagePlaceholder,
												{ backgroundColor: colors.surfaceContainer },
											]}
										>
											<Text
												style={[
													styles.castImagePlaceholderText,
													{ color: colors.onSurfaceVariant },
												]}
											>
												No photo
											</Text>
										</View>
									)}
								</View>
								<Text style={[styles.castName, { color: colors.onSurface }]} numberOfLines={2}>
									{person.name}
								</Text>
								{person.character ? (
									<Text
										style={[styles.castCharacter, { color: colors.onSurfaceVariant }]}
										numberOfLines={2}
									>
										as {person.character}
									</Text>
								) : null}
							</TouchableOpacity>
						);
					})}
				</ScrollView>
				<LinearGradient
					colors={["rgba(3, 7, 18, 0)", "rgba(3, 7, 18, 1)"]}
					start={{ x: 0, y: 0.5 }}
					end={{ x: 1, y: 0.5 }}
					style={styles.castGradient}
				/>
			</View>
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
	castContainer: {
		position: "relative",
	},
	castScrollContent: {
		gap: spacing.md,
	},
	castGradient: {
		position: "absolute",
		right: 0,
		top: 0,
		bottom: 16,
		width: 48,
		pointerEvents: "none",
	},
	castCard: {
		width: 100,
	},
	castImageContainer: {
		borderRadius: borderRadius.md,
		overflow: "hidden",
		marginBottom: spacing.sm,
	},
	castImage: {
		width: 100,
		height: 140,
	},
	castImagePlaceholder: {
		width: 100,
		height: 140,
		justifyContent: "center",
		alignItems: "center",
	},
	castImagePlaceholderText: {
		fontSize: 12,
		textAlign: "center",
		paddingHorizontal: 8,
	},
	castName: {
		fontSize: 13,
		fontWeight: "500",
		marginBottom: 2,
	},
	castCharacter: {
		fontSize: 11,
	},
});
