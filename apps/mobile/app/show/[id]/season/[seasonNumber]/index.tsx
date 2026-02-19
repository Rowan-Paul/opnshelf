import { Ionicons } from "@expo/vector-icons";
import {
	authControllerMeOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	type TmdbEpisodeDto,
	type TmdbSeasonDetailDto,
	type TmdbShowDetailDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
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
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
	getTmdbProfileUrl,
} from "@/lib/utils";

function formatDateOnly(dateString?: string): string {
	if (!dateString) return "Unknown";
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export default function ShowSeasonScreen() {
	const { id, seasonNumber, title } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
		title?: string;
	}>();
	const router = useRouter();
	const { colors } = useTheme();

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const resolvedUserDid = user?.did || "";

	const { data: showData } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: id },
		}),
	});
	const show = showData as TmdbShowDetailDto | undefined;

	const { data } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId: id, seasonNumber },
		}),
	});
	const season = data as TmdbSeasonDetailDto | undefined;

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: resolvedUserDid, showId: id },
		}),
		enabled: !!resolvedUserDid,
	});

	const showColors = show?.colors || {
		primary: colors.primary,
		secondary: colors.secondary,
		accent: colors.tertiary,
		muted: colors.surfaceContainer,
	};

	const backdropUrl = getTmdbBackdropUrl(show?.backdrop_path);
	const posterUrl = season?.poster_path
		? getTmdbPosterUrl(season.poster_path, "w500")
		: getTmdbPosterUrl(show?.poster_path, "w500");

	const episodeWatchCounts = useMemo(() => {
		if (!history?.length) return new Map<number, number>();
		const counts = new Map<number, number>();
		for (const item of history) {
			if (item.seasonNumber === Number(seasonNumber)) {
				const current = counts.get(item.episodeNumber) || 0;
				counts.set(item.episodeNumber, current + 1);
			}
		}
		return counts;
	}, [history, seasonNumber]);

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
						<TouchableOpacity
							style={[
								styles.posterWrapper,
								{ shadowColor: showColors.primary || colors.primary },
							]}
							onPress={() =>
								router.push({ pathname: "/show/[id]", params: { id } })
							}
							activeOpacity={0.8}
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
						</TouchableOpacity>
						<View style={styles.titleWrapper}>
							<Text
								style={[styles.title, { textShadowColor: showColors.primary }]}
								numberOfLines={2}
							>
								{show?.name || title || "Show"}
							</Text>
							<Text style={styles.subtitle}>Season {seasonNumber}</Text>
						</View>
					</View>
				</View>

				<View style={styles.content}>
					<View style={styles.infoCards}>
						<View
							style={[
								styles.infoCard,
								{ backgroundColor: colors.surfaceContainer },
							]}
						>
							<Text
								style={[styles.infoLabel, { color: colors.onSurfaceVariant }]}
							>
								Air Date
							</Text>
							<Text style={[styles.infoValue, { color: colors.onSurface }]}>
								{formatDateOnly(season?.air_date)}
							</Text>
						</View>
						<View
							style={[
								styles.infoCard,
								{ backgroundColor: colors.surfaceContainer },
							]}
						>
							<Text
								style={[styles.infoLabel, { color: colors.onSurfaceVariant }]}
							>
								Episodes
							</Text>
							<Text style={[styles.infoValue, { color: colors.onSurface }]}>
								{season?.episodes?.length || 0}
							</Text>
						</View>
					</View>

					{season?.overview && (
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
								{season.overview}
							</Text>
						</View>
					)}

					<View style={styles.section}>
						<Text
							style={[
								styles.sectionTitle,
								{ color: showColors.primary || colors.primary },
							]}
						>
							Episodes
						</Text>
						<View style={styles.episodesList}>
							{(season?.episodes || [])
								.sort((a, b) => a.episode_number - b.episode_number)
								.map((episode) => (
									<EpisodeCard
										key={episode.id}
										episode={episode}
										watchCount={
											episodeWatchCounts.get(episode.episode_number) || 0
										}
										isAuthenticated={!!resolvedUserDid}
										onPress={() =>
											router.push({
												pathname:
													"/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
												params: {
													id,
													seasonNumber,
													episodeNumber: String(episode.episode_number),
													title: show?.name || title || "",
												},
											})
										}
									/>
								))}
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

interface EpisodeCardProps {
	episode: TmdbEpisodeDto;
	watchCount: number;
	isAuthenticated: boolean;
	onPress: () => void;
}

function EpisodeCard({
	episode,
	watchCount,
	isAuthenticated,
	onPress,
}: EpisodeCardProps) {
	const { colors } = useTheme();

	const stillUrl = episode.still_path
		? `https://image.tmdb.org/t/p/w300${episode.still_path}`
		: null;

	return (
		<TouchableOpacity
			style={[
				styles.episodeCard,
				{
					borderColor: colors.outline,
					backgroundColor: `${colors.surfaceContainer}50`,
				},
			]}
			onPress={onPress}
			activeOpacity={0.8}
		>
			<View style={styles.episodeRow}>
				<View style={styles.episodeThumbnail}>
					{stillUrl ? (
						<Image
							source={{ uri: stillUrl }}
							style={styles.episodeImage}
							contentFit="cover"
						/>
					) : (
						<View
							style={[
								styles.episodeImage,
								{ backgroundColor: colors.surfaceVariant },
							]}
						/>
					)}
				</View>
				<View style={styles.episodeInfo}>
					<View style={styles.episodeHeader}>
						<Text
							style={[styles.episodeTitle, { color: colors.onSurface }]}
							numberOfLines={1}
						>
							E{episode.episode_number} · {episode.name}
						</Text>
						<View style={styles.episodeMeta}>
							{episode.vote_average ? (
								<View style={styles.ratingBadge}>
									<Ionicons name="star" size={12} color="#fbbf24" />
									<Text style={styles.ratingText}>
										{episode.vote_average.toFixed(1)}
									</Text>
								</View>
							) : null}
							{isAuthenticated && watchCount > 0 && (
								<View style={styles.watchedBadge}>
									<Ionicons name="checkmark-circle" size={12} color="#22c55e" />
									<Text style={styles.watchedText}>{watchCount}x</Text>
								</View>
							)}
						</View>
					</View>
					<Text
						style={[styles.episodeOverview, { color: colors.onSurfaceVariant }]}
						numberOfLines={2}
					>
						{episode.overview || "No overview available."}
					</Text>
					<View style={styles.episodeFooter}>
						{episode.air_date && (
							<Text
								style={[styles.episodeDate, { color: colors.onSurfaceVariant }]}
							>
								{formatDateOnly(episode.air_date)}
							</Text>
						)}
					</View>
				</View>
			</View>
		</TouchableOpacity>
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
		top: 8,
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
	subtitle: {
		fontSize: 17,
		fontWeight: "600",
		color: "#d1d5db",
		marginTop: 4,
	},
	content: {
		marginTop: 64,
		paddingHorizontal: 16,
		gap: spacing.md,
	},
	infoCards: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	infoCard: {
		flex: 1,
		padding: spacing.md,
		borderRadius: borderRadius.md,
		alignItems: "center",
	},
	infoLabel: {
		fontSize: 11,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 4,
	},
	infoValue: {
		fontSize: 16,
		fontWeight: "600",
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
	episodesList: {
		gap: spacing.sm,
	},
	episodeCard: {
		borderWidth: 1,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
	},
	episodeRow: {
		flexDirection: "row",
		gap: spacing.md,
	},
	episodeThumbnail: {
		width: 120,
		height: 80,
		backgroundColor: "#111827",
	},
	episodeImage: {
		width: "100%",
		height: "100%",
	},
	episodeInfo: {
		flex: 1,
		paddingVertical: spacing.sm,
		paddingRight: spacing.sm,
		justifyContent: "center",
	},
	episodeHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		gap: spacing.sm,
	},
	episodeTitle: {
		fontSize: 14,
		fontWeight: "500",
		flex: 1,
	},
	episodeMeta: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	ratingBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 2,
	},
	ratingText: {
		fontSize: 11,
		color: "#fbbf24",
		fontWeight: "600",
	},
	watchedBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 2,
	},
	watchedText: {
		fontSize: 11,
		color: "#22c55e",
		fontWeight: "600",
	},
	episodeOverview: {
		fontSize: 12,
		marginTop: 4,
		lineHeight: 16,
	},
	episodeFooter: {
		flexDirection: "row",
		marginTop: 4,
	},
	episodeDate: {
		fontSize: 11,
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
