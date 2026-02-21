import { Ionicons } from "@expo/vector-icons";
import type { TmdbShowDetailDto } from "@opnshelf/api";
import {
	authControllerMeOptions,
	listsControllerGetListsForItemOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkShowWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ScrollView,
	Share,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	DetailActions,
	DetailHero,
	MetadataPills,
	SeasonCard,
} from "@/components/detail";
import { WatchDatePickerModal } from "@/components/WatchDatePickerModal";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
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

export default function ShowDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { colors: themeColors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const [_showListModal, setShowListModal] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: showData, isLoading } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: id },
		}),
	});

	const show = showData as TmdbShowDetailDto | undefined;

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: user?.did || "", showId: id },
		}),
		enabled: !!user?.did,
	});

	const { data: listsForShow } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: id },
		}),
		enabled: !!user?.did,
	});

	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});

	const listsCount = listsForShow?.filter((l) => l.isInList).length ?? 0;
	const watchedEpisodeCount = history?.length ?? 0;
	const is24Hour = userSettings?.timeFormat === "24h";

	const showColors = show?.colors || {
		primary: themeColors.primary,
		secondary: themeColors.secondary,
		accent: themeColors.tertiary,
		muted: themeColors.surfaceContainerHighest,
	};

	const backdropUrl = getTmdbBackdropUrl(show?.backdrop_path);
	const posterUrl = getTmdbPosterUrl(show?.poster_path, "w500");
	const seasonCount = show?.number_of_seasons || 0;

	const markShowWatchedMutation = useMutation({
		mutationKey: ["shows", id, "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["showsControllerGetShowWatchHistory"],
			});
			showToast(`Marked ${data.count} episodes as watched`);
		},
		onError: () => {
			showToast("Failed to mark show as watched. Please try again.", "error");
		},
	});

	const handleMarkWatched = () => {
		markShowWatchedMutation.mutate({
			body: { showId: id },
		});
	};

	const handleMarkWatchedWithDate = (date: Date) => {
		markShowWatchedMutation.mutate({
			body: { showId: id, watchedAt: date.toISOString() },
		});
	};

	const unmarkShowWatchedMutation = useMutation({
		mutationKey: ["shows", id, "unmarkShowWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: user?.did || "", showId: id },
				}),
			});
			showToast("Removed all episodes from your shelf");
		},
		onError: () => {
			showToast("Failed to remove from shelf. Please try again.", "error");
		},
	});

	const handleUnmarkWatched = () => {
		unmarkShowWatchedMutation.mutate({
			path: { showId: id },
			query: { mode: "all" },
		});
	};

	const handleShare = async () => {
		const shareUrl = `https://opnshelf.app/show/${id}`;
		try {
			await Share.share({
				message: `Check out ${show?.name} on OpnShelf!\n\n${shareUrl}`,
				title: show?.name,
			});
		} catch {
			// User cancelled or error
		}
	};

	const seasonWatchedCounts = useMemo(() => {
		if (!history) return new Map<number, number>();
		const counts = new Map<number, number>();
		for (const h of history) {
			const current = counts.get(h.seasonNumber) ?? 0;
			counts.set(h.seasonNumber, current + 1);
		}
		return counts;
	}, [history]);

	const metadataItems = useMemo(() => {
		const items = [];
		if (show?.first_air_date) {
			items.push({
				icon: (
					<Ionicons
						name="calendar-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: formatDateOnly(show.first_air_date),
			});
		}
		if (seasonCount > 0) {
			items.push({
				icon: (
					<Ionicons
						name="tv-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: `${seasonCount} season${seasonCount !== 1 ? "s" : ""}`,
			});
		}
		if (show?.number_of_episodes) {
			items.push({
				icon: (
					<Ionicons
						name="film-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: `${show.number_of_episodes} episodes`,
			});
		}
		return items;
	}, [show, seasonCount, themeColors]);

	const seasonList = useMemo(() => {
		if (!show?.seasons) return [];
		return show.seasons.filter((s) => s.season_number > 0);
	}, [show?.seasons]);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: themeColors.background }]}
		>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<DetailHero
					title={show?.name || "Show"}
					backdropUrl={backdropUrl}
					posterUrl={posterUrl}
					colors={showColors}
					onBack={() => router.back()}
					isLoading={isLoading}
				/>

				<View style={styles.content}>
					<DetailActions
						mediaType="show"
						mediaId={id}
						colors={showColors}
						isWatched={watchedEpisodeCount > 0}
						watchedDate={null}
						totalWatches={watchedEpisodeCount}
						onMarkWatched={handleMarkWatched}
						onUnmarkWatched={handleUnmarkWatched}
						onShowDatePicker={() => setShowDateModal(true)}
						isMarkingPending={markShowWatchedMutation.isPending}
						isUnmarkingPending={unmarkShowWatchedMutation.isPending}
						listsCount={listsCount}
						onShowListModal={() => setShowListModal(true)}
						isLoggedIn={!!user}
						onLogin={() => router.push("/login")}
						onShare={handleShare}
					/>

					<MetadataPills items={metadataItems} />

					{show?.overview && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: showColors.primary }]}
							>
								Overview
							</Text>
							<Text
								style={[
									styles.overview,
									{ color: themeColors.onSurfaceVariant },
								]}
							>
								{show.overview}
							</Text>
						</View>
					)}

					{show?.genres && show.genres.length > 0 && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: showColors.primary }]}
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
												backgroundColor: `${showColors.primary}20`,
												borderColor: `${showColors.primary}40`,
											},
										]}
									>
										<Text
											style={[styles.genreText, { color: showColors.primary }]}
										>
											{genre.name}
										</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{seasonList.length > 0 && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: showColors.primary }]}
							>
								Seasons
							</Text>
							<View style={styles.seasonsList}>
								{seasonList.map((season) => {
									const watchedCount =
										seasonWatchedCounts.get(season.season_number) ?? 0;
									return (
										<SeasonCard
											key={season.id}
											showId={id}
											seasonNumber={season.season_number}
											posterUrl={season.poster_path}
											airDate={season.air_date}
											episodeCount={season.episode_count ?? 0}
											watchedCount={watchedCount}
											overview={season.overview}
											colors={showColors}
											userDid={user?.did}
											onPress={() =>
												router.push({
													pathname: "/show/[id]/season/[seasonNumber]",
													params: {
														id,
														seasonNumber: String(season.season_number),
														title: show?.name || "",
													},
												})
											}
										/>
									);
								})}
							</View>
						</View>
					)}

					{show?.credits?.cast && show.credits.cast.length > 0 && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: showColors.primary }]}
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
																{
																	backgroundColor: themeColors.surfaceContainer,
																},
															]}
														>
															<Text
																style={[
																	styles.castImagePlaceholderText,
																	{ color: themeColors.onSurfaceVariant },
																]}
															>
																No photo
															</Text>
														</View>
													)}
												</View>
												<Text
													style={[
														styles.castName,
														{ color: themeColors.onSurface },
													]}
													numberOfLines={2}
												>
													{person.name}
												</Text>
												{person.character ? (
													<Text
														style={[
															styles.castCharacter,
															{ color: themeColors.onSurfaceVariant },
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
					)}

					{show?.credits?.crew && show.credits.crew.length > 0 && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: showColors.primary }]}
							>
								Crew
							</Text>
							<View style={styles.crewGrid}>
								{show.credits.crew.map((person) => (
									<TouchableOpacity
										key={`${person.id}-${person.job || "crew"}`}
										style={[
											styles.crewCard,
											{ backgroundColor: themeColors.surfaceContainer },
										]}
										activeOpacity={0.8}
									>
										<Text
											style={[
												styles.crewName,
												{ color: themeColors.onSurface },
											]}
											numberOfLines={1}
										>
											{person.name}
										</Text>
										<Text
											style={[
												styles.crewJob,
												{ color: themeColors.onSurfaceVariant },
											]}
											numberOfLines={1}
										>
											{person.job || person.department || "Crew"}
										</Text>
									</TouchableOpacity>
								))}
							</View>
						</View>
					)}
				</View>
			</ScrollView>

			<WatchDatePickerModal
				visible={showDateModal}
				onDismiss={() => setShowDateModal(false)}
				onConfirm={handleMarkWatchedWithDate}
				isLoading={markShowWatchedMutation.isPending}
				is24Hour={is24Hour}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	scrollContent: {
		paddingBottom: spacing.xxl,
	},
	content: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.lg,
		gap: spacing.lg,
	},
	section: {
		gap: spacing.md,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
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
	seasonsList: {
		gap: spacing.md,
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
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.lg,
	},
	modalContent: {
		borderRadius: 28,
		padding: spacing.lg,
		width: "100%",
		maxWidth: 340,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: spacing.sm,
	},
	modalTitle: {
		fontSize: 22,
		fontWeight: "600",
	},
	modalDescription: {
		fontSize: 14,
		marginBottom: spacing.lg,
	},
	dateTimeContainer: {
		gap: spacing.sm,
	},
	dateTimeButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
		padding: spacing.md,
		borderRadius: borderRadius.md,
		borderWidth: 1,
	},
	dateTimeText: {
		fontSize: 14,
		fontWeight: "500",
	},
	modalButtons: {
		flexDirection: "row",
		gap: spacing.md,
	},
	modalButton: {
		flex: 1,
		padding: spacing.md,
		borderRadius: borderRadius.md,
		alignItems: "center",
	},
	modalButtonOutline: {
		borderWidth: 1,
	},
	modalButtonPrimary: {},
	modalButtonText: {
		fontSize: 14,
		fontWeight: "600",
	},
	modalButtonTextPrimary: {
		fontSize: 14,
		fontWeight: "600",
		color: "#fff",
	},
});
