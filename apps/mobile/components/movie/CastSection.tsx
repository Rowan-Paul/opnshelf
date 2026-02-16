import type { TmdbCastDto, TmdbMovieDetailDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { getTmdbProfileUrl } from "@/lib/utils";

interface CastSectionProps {
	movie: TmdbMovieDetailDto | null;
}

export function CastSection({ movie }: CastSectionProps) {
	const { colors } = useTheme();

	if (!movie?.credits?.cast || movie.credits.cast.length === 0) return null;

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: colors.primary }]}>
				Cast
			</Text>
			<View style={styles.castContainer}>
				<View style={styles.castScrollContent}>
					{movie.credits.cast.map((person: TmdbCastDto) => {
						const profileUrl = getTmdbProfileUrl(person.profile_path);
						return (
							<TouchableOpacity
								key={person.id}
								style={styles.castCard}
								activeOpacity={0.8}
							>
								<View style={styles.castImageContainer}>
									{profileUrl ? (
										<Image
											source={{ uri: profileUrl }}
											style={styles.castImage}
											contentFit="cover"
										/>
									) : (
										<View style={styles.castImagePlaceholder}>
											<Text style={[styles.castImagePlaceholderText, { color: colors.onSurfaceVariant }]}>
												No photo
											</Text>
										</View>
									)}
								</View>
								<Text style={[styles.castName, { color: colors.onSurface }]} numberOfLines={2}>
									{person.name}
								</Text>
								{person.character && (
									<Text
										style={[
											styles.castCharacter,
											{ color: colors.onSurfaceVariant },
										]}
									>
										as {person.character}
									</Text>
								)}
							</TouchableOpacity>
						);
					})}
				</View>
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
		marginTop: spacing.lg,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		marginBottom: spacing.md,
	},
	castContainer: {
		position: "relative",
	},
	castScrollContent: {
		flexDirection: "row",
		gap: spacing.md,
		paddingRight: spacing.xl,
	},
	castCard: {
		width: 100,
		alignItems: "center",
	},
	castImageContainer: {
		width: 80,
		height: 80,
		borderRadius: 40,
		overflow: "hidden",
		marginBottom: spacing.sm,
	},
	castImage: {
		width: "100%",
		height: "100%",
	},
	castImagePlaceholder: {
		width: "100%",
		height: "100%",
		justifyContent: "center",
		alignItems: "center",
	},
	castImagePlaceholderText: {
		fontSize: 10,
		textAlign: "center",
	},
	castName: {
		fontSize: 12,
		fontWeight: "600",
		textAlign: "center",
		marginBottom: 2,
	},
	castCharacter: {
		fontSize: 10,
		textAlign: "center",
	},
	castGradient: {
		position: "absolute",
		right: 0,
		top: 0,
		bottom: 40,
		width: 40,
	},
});
