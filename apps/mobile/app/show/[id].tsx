import { Ionicons } from "@expo/vector-icons";
import {
	showsControllerGetShowDetailsOptions,
	type TmdbShowDetailDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import {
	getReleaseYear,
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
	getTmdbProfileUrl,
} from "@/lib/utils";

export default function ShowDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { colors } = useTheme();

	const { data } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: id },
		}),
	});

	const show = data as TmdbShowDetailDto | undefined;
	const seasonCount = show?.number_of_seasons || 0;

	const showColors = show?.colors || {
		primary: colors.primary,
		secondary: colors.secondary,
		accent: colors.tertiary,
		muted: colors.surfaceContainer,
	};

	const backdropUrl = getTmdbBackdropUrl(show?.backdrop_path);
	const posterUrl = getTmdbPosterUrl(show?.poster_path, "w500");
	const releaseYear = getReleaseYear(show?.first_air_date);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={styles.heroWrapper}>
					{backdropUrl ? (
						<Image
							source={{ uri: backdropUrl }}
							style={styles.backdrop}
							contentFit="cover"
						/>
					) : (
						<View
							style={[
								styles.backdrop,
								{
									backgroundColor: showColors.muted || colors.surfaceVariant,
								},
							]}
						/>
					)}
					<LinearGradient
						colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.75)", colors.background]}
						style={styles.backdropOverlay}
					/>
					<TouchableOpacity
						onPress={() => router.back()}
						style={styles.backButton}
						activeOpacity={0.8}
					>
						<Ionicons name="arrow-back" size={24} color="#f9fafb" />
					</TouchableOpacity>
					<View style={styles.heroOverlay}>
						<View
							style={[
								styles.posterWrapper,
								{ shadowColor: showColors.primary || colors.primary },
							]}
						>
							{posterUrl ? (
								<Image
									source={{ uri: posterUrl }}
									style={styles.poster}
									contentFit="cover"
								/>
							) : (
								<View
									style={[
										styles.poster,
										styles.noPoster,
										{ backgroundColor: colors.surfaceContainer },
									]}
								>
									<Text
										style={[
											styles.noPosterText,
											{ color: colors.onSurfaceVariant },
										]}
									>
										No poster
									</Text>
								</View>
							)}
						</View>
						<View style={styles.titleWrapper}>
							<Text
								style={[styles.title, { textShadowColor: showColors.primary }]}
								numberOfLines={2}
							>
								{show?.name || "Show"}
							</Text>
							<View style={styles.metaRow}>
								{releaseYear && (
									<View style={styles.metaItem}>
										<Ionicons
											name="calendar-outline"
											size={14}
											color="#d1d5db"
										/>
										<Text style={styles.metaText}>{releaseYear}</Text>
									</View>
								)}
								{show?.number_of_episodes && (
									<View style={styles.metaItem}>
										<Ionicons name="tv-outline" size={14} color="#d1d5db" />
										<Text style={styles.metaText}>
											{show.number_of_episodes} episodes
										</Text>
									</View>
								)}
							</View>
						</View>
					</View>
				</View>

				<View style={styles.content}>
					<View style={styles.metaPills}>
						{show?.first_air_date && (
							<View style={[styles.metaPill, { borderColor: colors.outline }]}>
								<Ionicons
									name="calendar-outline"
									size={14}
									color={colors.onSurfaceVariant}
								/>
								<Text
									style={[
										styles.metaPillText,
										{ color: colors.onSurfaceVariant },
									]}
								>
									{releaseYear}
								</Text>
							</View>
						)}
						<View style={[styles.metaPill, { borderColor: colors.outline }]}>
							<Ionicons
								name="tv-outline"
								size={14}
								color={colors.onSurfaceVariant}
							/>
							<Text
								style={[
									styles.metaPillText,
									{ color: colors.onSurfaceVariant },
								]}
							>
								{show?.number_of_episodes || 0} episodes
							</Text>
						</View>
						<View style={[styles.metaPill, { borderColor: colors.outline }]}>
							<Text
								style={[
									styles.metaPillText,
									{ color: colors.onSurfaceVariant },
								]}
							>
								{seasonCount} season{seasonCount !== 1 ? "s" : ""}
							</Text>
						</View>
					</View>

					{show?.overview && (
						<View style={styles.section}>
							<Text
								style={[
									styles.sectionTitle,
									{ color: showColors.primary || colors.primary },
								]}
							>
								Overview
							</Text>
							<Text
								style={[styles.overview, { color: colors.onSurfaceVariant }]}
							>
								{show.overview}
							</Text>
						</View>
					)}

					{show?.genres && show.genres.length > 0 && (
						<View style={styles.section}>
							<Text
								style={[
									styles.sectionTitle,
									{ color: showColors.primary || colors.primary },
								]}
							>
								Genres
							</Text>
							<View style={styles.genresContainer}>
								{show.genres.map((genre) => (
									<View
										key={genre.id}
										style={[
											styles.genreBadge,
											{
												backgroundColor: `${showColors.primary || colors.primary}20`,
												borderColor: `${showColors.primary || colors.primary}40`,
											},
										]}
									>
										<Text
											style={[
												styles.genreText,
												{ color: showColors.primary || colors.primary },
											]}
										>
											{genre.name}
										</Text>
									</View>
								))}
							</View>
						</View>
					)}

					<View style={styles.section}>
						<Text
							style={[
								styles.sectionTitle,
								{ color: showColors.primary || colors.primary },
							]}
						>
							Seasons
						</Text>
						<View style={styles.seasonsGrid}>
							{Array.from({ length: seasonCount }).map((_, index) => {
								const seasonNumber = index + 1;
								return (
									<TouchableOpacity
										key={seasonNumber}
										style={[
											styles.seasonCard,
											{
												borderColor: colors.outline,
												backgroundColor: colors.surfaceContainer,
											},
										]}
										onPress={() =>
											router.push({
												pathname: "/show/[id]/season/[seasonNumber]",
												params: {
													id,
													seasonNumber: String(seasonNumber),
													title: show?.name || "",
												},
											})
										}
										activeOpacity={0.8}
									>
										<Text
											style={[styles.seasonText, { color: colors.onSurface }]}
										>
											Season {seasonNumber}
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					{show?.credits?.cast && show.credits.cast.length > 0 ? (
						<View style={styles.section}>
							<Text
								style={[
									styles.sectionTitle,
									{ color: showColors.primary || colors.primary },
								]}
							>
								Cast
							</Text>
							<View style={styles.castContainer}>
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerStyle={styles.castScrollContent}
								>
									{show.credits.cast.map((person) => {
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
												<Text
													style={[styles.castName, { color: colors.onSurface }]}
													numberOfLines={2}
												>
													{person.name}
												</Text>
												{person.character ? (
													<Text
														style={[
															styles.castCharacter,
															{ color: colors.onSurfaceVariant },
														]}
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
					) : null}

					{show?.credits?.crew && show.credits.crew.length > 0 ? (
						<View style={styles.section}>
							<Text
								style={[
									styles.sectionTitle,
									{ color: showColors.primary || colors.primary },
								]}
							>
								Crew
							</Text>
							<View style={styles.crewGrid}>
								{show.credits.crew.map((person) => (
									<TouchableOpacity
										key={`${person.id}-${person.job || "crew"}`}
										style={[
											styles.crewCard,
											{ backgroundColor: colors.surfaceContainer },
										]}
										activeOpacity={0.8}
									>
										<Text
											style={[styles.crewName, { color: colors.onSurface }]}
											numberOfLines={1}
										>
											{person.name}
										</Text>
										<Text
											style={[
												styles.crewJob,
												{ color: colors.onSurfaceVariant },
											]}
											numberOfLines={1}
										>
											{person.job || person.department || "Crew"}
										</Text>
									</TouchableOpacity>
								))}
							</View>
						</View>
					) : null}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	scrollContent: {
		paddingBottom: spacing.xxl,
	},
	heroWrapper: {
		height: 280,
		position: "relative",
	},
	backdrop: {
		width: "100%",
		height: "100%",
	},
	backdropOverlay: {
		...StyleSheet.absoluteFillObject,
	},
	backButton: {
		position: "absolute",
		top: 48,
		left: 16,
		zIndex: 10,
		padding: 8,
		borderRadius: borderRadius.full,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	heroOverlay: {
		position: "absolute",
		bottom: -52,
		left: 16,
		right: 16,
		flexDirection: "row",
		alignItems: "flex-end",
	},
	posterWrapper: {
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.35,
		shadowRadius: 8,
		elevation: 8,
	},
	poster: {
		width: 96,
		height: 144,
	},
	noPoster: {
		alignItems: "center",
		justifyContent: "center",
	},
	noPosterText: {
		fontSize: 11,
	},
	titleWrapper: {
		marginLeft: spacing.md,
		marginBottom: spacing.sm,
		flex: 1,
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		color: "#f9fafb",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 10,
	},
	metaRow: {
		flexDirection: "row",
		gap: spacing.md,
		marginTop: spacing.xs,
	},
	metaItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	metaText: {
		fontSize: 14,
		color: "#d1d5db",
	},
	content: {
		marginTop: 64,
		paddingHorizontal: 16,
		gap: spacing.md,
	},
	metaPills: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	metaPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		borderWidth: 1,
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.md,
		paddingVertical: 6,
	},
	metaPillText: {
		fontSize: 13,
	},
	section: {
		marginTop: spacing.sm,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		marginBottom: spacing.md,
	},
	overview: {
		fontSize: 15,
		lineHeight: 22,
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
	seasonsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	seasonCard: {
		borderWidth: 1,
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		flex: 1,
		minWidth: 120,
		alignItems: "center",
	},
	seasonText: {
		fontSize: 14,
		fontWeight: "500",
	},
	castContainer: {
		position: "relative",
	},
	castScrollContent: {
		gap: 12,
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
		marginBottom: 8,
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
	crewGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
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
