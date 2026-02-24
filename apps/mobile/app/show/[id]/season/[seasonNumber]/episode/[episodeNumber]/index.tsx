import { Ionicons } from "@expo/vector-icons";
import type { TmdbShowDetailDto } from "@opnshelf/api";
import {
	authControllerMeOptions,
	type EpisodeHistoryItemDto,
	listsControllerGetListsForItemOptions,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	type TmdbEpisodeDto,
	type TmdbSeasonDetailDto,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddToListModal } from "@/components/AddToListModal";
import {
	DetailActions,
	DetailHero,
	EpisodeNav,
	type EpisodeSummary,
	MetadataPills,
} from "@/components/detail";
import { Button } from "@/components/ui/Button";
import { ThemedRefreshControl } from "@/components/ui/ThemedRefreshControl";
import { WatchDatePickerModal } from "@/components/WatchDatePickerModal";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import {
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
	getTmdbProfileUrl,
} from "@/lib/utils";

function formatWatchDate(
	dateString: string,
	timezone: string,
	is24Hour: boolean,
): string {
	return new Date(dateString).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: !is24Hour,
		timeZone: timezone,
	});
}

function formatDateOnly(dateString?: string): string {
	if (!dateString) return "Unknown";
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export default function ShowEpisodeScreen() {
	const { id, seasonNumber, episodeNumber, title } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
		episodeNumber: string;
		title?: string;
	}>();
	const router = useRouter();
	const { colors: themeColors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const [showDateModal, setShowDateModal] = useState(false);
	const [showAddToListModal, setShowAddToListModal] = useState(false);
	const [showHistoryModal, setShowHistoryModal] = useState(false);

	const { data: user, refetch: refetchUser } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const resolvedUserDid = user?.did || "";

	const {
		data: showData,
		isRefetching: isShowRefetching,
		refetch: refetchShow,
	} = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: id },
		}),
	});

	const {
		data: episode,
		isRefetching: isEpisodeRefetching,
		refetch: refetchEpisode,
	} = useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId: id, seasonNumber, episodeNumber },
		}),
	});

	const {
		data: seasonData,
		isRefetching: isSeasonRefetching,
		refetch: refetchSeason,
	} = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId: id, seasonNumber },
		}),
	});
	const season = seasonData as TmdbSeasonDetailDto | undefined;

	const {
		data: history,
		isRefetching: isHistoryRefetching,
		refetch: refetchHistory,
	} = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: resolvedUserDid, showId: id },
		}),
		enabled: !!resolvedUserDid,
	});

	const {
		data: userSettings,
		isRefetching: isUserSettingsRefetching,
		refetch: refetchUserSettings,
	} = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!resolvedUserDid,
	});

	const {
		data: listsForShow,
		isRefetching: isListsRefetching,
		refetch: refetchLists,
	} = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: id },
		}),
		enabled: !!resolvedUserDid,
	});

	const isRefreshing =
		isShowRefetching ||
		isEpisodeRefetching ||
		isSeasonRefetching ||
		isHistoryRefetching ||
		isUserSettingsRefetching ||
		isListsRefetching;

	const handleRefresh = useCallback(async () => {
		const refetchPromises: Promise<unknown>[] = [
			refetchShow(),
			refetchEpisode(),
			refetchSeason(),
			refetchUser(),
		];
		if (resolvedUserDid) {
			refetchPromises.push(
				refetchHistory(),
				refetchUserSettings(),
				refetchLists(),
			);
		}
		await Promise.all(refetchPromises);
	}, [
		resolvedUserDid,
		refetchShow,
		refetchEpisode,
		refetchSeason,
		refetchUser,
		refetchHistory,
		refetchUserSettings,
		refetchLists,
	]);

	const show = showData as TmdbShowDetailDto | undefined;

	const showColors = show?.colors || {
		primary: themeColors.primary,
		secondary: themeColors.secondary,
		accent: themeColors.tertiary,
		muted: themeColors.surfaceContainerHighest,
	};
	const backdropUrl = getTmdbBackdropUrl(
		(episode as TmdbEpisodeDto)?.still_path || show?.backdrop_path,
	);
	const posterUrl = getTmdbPosterUrl(show?.poster_path, "w500");

	const userTimezone = userSettings?.timezone || "UTC";
	const is24Hour = userSettings?.timeFormat === "24h";
	const listsCount = listsForShow?.filter((list) => list.isInList).length ?? 0;

	const episodeWatchHistory = useMemo(() => {
		if (!history?.length) return [];
		return history
			.filter(
				(item) =>
					item.seasonNumber === Number(seasonNumber) &&
					item.episodeNumber === Number(episodeNumber),
			)
			.sort(
				(a, b) =>
					new Date(b.watchedDate).getTime() - new Date(a.watchedDate).getTime(),
			);
	}, [history, seasonNumber, episodeNumber]);
	const latestEpisodeWatch = episodeWatchHistory[0] || null;
	const watchedCount = episodeWatchHistory.length;
	const isWatchedEpisode = watchedCount > 0;

	const seasonEpisodeContext = useMemo(() => {
		if (!season?.episodes?.length) {
			return { previous: null, current: null, next: null };
		}

		const sortedEpisodes = [...season.episodes].sort(
			(a, b) => a.episode_number - b.episode_number,
		);
		const currentIndex = sortedEpisodes.findIndex(
			(item) => item.episode_number === Number(episodeNumber),
		);
		if (currentIndex < 0) {
			return { previous: null, current: null, next: null };
		}

		return {
			previous: sortedEpisodes[currentIndex - 1] ?? null,
			current: sortedEpisodes[currentIndex] ?? null,
			next: sortedEpisodes[currentIndex + 1] ?? null,
		};
	}, [season?.episodes, episodeNumber]);

	const markMutation = useMutation({
		mutationKey: ["shows", id, "episodes", episodeNumber, "markWatched"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId: id },
				}),
			});
			setShowDateModal(false);
			showToast("Added to your shelf", "success");
		},
		onError: () => {
			showToast("Failed to add. Please try again.", "error");
		},
	});

	const unmarkMutation = useMutation({
		mutationKey: ["shows", id, "episodes", episodeNumber, "unmarkWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId: id },
				}),
			});
			showToast("Removed from your shelf", "success");
		},
		onError: () => {
			showToast("Failed to remove from shelf. Please try again.", "error");
		},
	});

	const deleteWatchEntryMutation = useMutation({
		mutationKey: ["shows", id, "episodes", episodeNumber, "deleteWatchEntry"],
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId: id },
				}),
			});
			showToast("Watch entry removed", "success");
		},
		onError: () => {
			showToast("Failed to remove watch entry. Please try again.", "error");
		},
	});

	const handleMarkWatched = () => {
		markMutation.mutate({
			body: {
				showId: id,
				seasonNumber: Number(seasonNumber),
				episodeNumber: Number(episodeNumber),
			},
		});
	};

	const handleMarkWatchedWithDate = (date: Date) => {
		markMutation.mutate({
			body: {
				showId: id,
				seasonNumber: Number(seasonNumber),
				episodeNumber: Number(episodeNumber),
				watchedAt: date.toISOString(),
			},
		});
	};

	const handleUnmarkWatched = () => {
		unmarkMutation.mutate({
			path: { showId: id },
			query: {
				mode: "all",
				seasonNumber,
				episodeNumber,
			},
		});
	};

	const handleShare = async () => {
		const shareUrl = `https://opnshelf.xyz/shows/${id}/season/${seasonNumber}/episode/${episodeNumber}`;
		try {
			await Share.share({
				message: `Check out S${seasonNumber}E${episodeNumber} of ${show?.name || title || "this show"} on OpnShelf!\n\n${shareUrl}`,
				title: `Check out S${seasonNumber}E${episodeNumber} of ${show?.name || title || "this show"}`,
			});
		} catch {
			showToast("Failed to share", "error");
		}
	};

	const handleOpenDateModal = () => {
		setShowDateModal(true);
	};

	const navigateToEpisode = (targetEpisode: TmdbEpisodeDto) => {
		router.push({
			pathname: "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
			params: {
				id,
				seasonNumber,
				episodeNumber: String(targetEpisode.episode_number),
				title: title || "",
			},
		});
	};

	const formattedWatchedDate = useMemo(() => {
		if (!latestEpisodeWatch) return null;
		return formatWatchDate(
			latestEpisodeWatch.watchedDate,
			userTimezone,
			is24Hour,
		);
	}, [latestEpisodeWatch, userTimezone, is24Hour]);

	const metadataItems = useMemo(() => {
		const items = [];
		items.push({
			icon: (
				<Ionicons
					name="layers-outline"
					size={14}
					color={themeColors.onSurfaceVariant}
				/>
			),
			label: `Season ${seasonNumber}`,
			onPress: () =>
				router.push({
					pathname: "/show/[id]/season/[seasonNumber]",
					params: { id, seasonNumber, title: title || "" },
				}),
		});
		items.push({
			icon: (
				<Ionicons
					name="film-outline"
					size={14}
					color={themeColors.onSurfaceVariant}
				/>
			),
			label: `Episode ${episodeNumber}`,
		});
		if ((episode as TmdbEpisodeDto)?.air_date) {
			items.push({
				icon: (
					<Ionicons
						name="calendar-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: formatDateOnly((episode as TmdbEpisodeDto).air_date),
			});
		}
		if ((episode as TmdbEpisodeDto)?.vote_average) {
			items.push({
				icon: (
					<Ionicons
						name="star-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: `${(episode as TmdbEpisodeDto).vote_average?.toFixed(1)}/10`,
			});
		}
		return items;
	}, [episode, seasonNumber, episodeNumber, id, title, router, themeColors]);

	const isPending =
		markMutation.isPending &&
		markMutation.variables?.body?.showId === id &&
		markMutation.variables?.body?.seasonNumber === Number(seasonNumber) &&
		markMutation.variables?.body?.episodeNumber === Number(episodeNumber);

	return (
		<>
			<SafeAreaView
				style={[styles.container, { backgroundColor: themeColors.background }]}
			>
				<ScrollView
					contentContainerStyle={styles.scrollContent}
					refreshControl={
						<ThemedRefreshControl
							refreshing={isRefreshing}
							onRefresh={handleRefresh}
						/>
					}
				>
					<DetailHero
						title={show?.name || title || "Show"}
						subtitle={`S${seasonNumber} · E${episodeNumber}: ${(episode as TmdbEpisodeDto)?.name || ""}`}
						backdropUrl={backdropUrl}
						posterUrl={posterUrl}
						colors={showColors}
						onBack={() => router.back()}
						posterLinkTo={{
							onPress: () =>
								router.push({ pathname: "/show/[id]", params: { id } }),
						}}
					/>

					<View style={styles.content}>
						<MetadataPills items={metadataItems} />

						<DetailActions
							mediaType="episode"
							mediaId={id}
							seasonNumber={seasonNumber}
							episodeNumber={episodeNumber}
							colors={showColors}
							isWatched={isWatchedEpisode}
							watchedDate={formattedWatchedDate}
							totalWatches={episodeWatchHistory.length}
							onMarkWatched={handleMarkWatched}
							onUnmarkWatched={handleUnmarkWatched}
							onShowDatePicker={handleOpenDateModal}
							isMarkingPending={isPending}
							isUnmarkingPending={unmarkMutation.isPending}
							listsCount={listsCount}
							onShowListModal={() => setShowAddToListModal(true)}
							onViewHistory={() => setShowHistoryModal(true)}
							onShare={handleShare}
						/>

						{seasonEpisodeContext.current && (
							<EpisodeNav
								previousEpisode={
									seasonEpisodeContext.previous as EpisodeSummary | null
								}
								currentEpisode={seasonEpisodeContext.current as EpisodeSummary}
								nextEpisode={seasonEpisodeContext.next as EpisodeSummary | null}
								colors={showColors}
								variant="sidebar"
								onPreviousPress={() =>
									navigateToEpisode(
										seasonEpisodeContext.previous as TmdbEpisodeDto,
									)
								}
								onNextPress={() =>
									navigateToEpisode(seasonEpisodeContext.next as TmdbEpisodeDto)
								}
							/>
						)}

						{(episode as TmdbEpisodeDto)?.overview && (
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
									{(episode as TmdbEpisodeDto).overview}
								</Text>
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
															<View style={styles.castImagePlaceholder}>
																<Text style={styles.castImagePlaceholderText}>
																	No photo
																</Text>
															</View>
														)}
													</View>
													<Text style={styles.castName} numberOfLines={2}>
														{person.name}
													</Text>
													{person.character ? (
														<Text
															style={styles.castCharacter}
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
											style={styles.crewCard}
											activeOpacity={0.8}
										>
											<Text style={styles.crewName} numberOfLines={1}>
												{person.name}
											</Text>
											<Text style={styles.crewJob} numberOfLines={1}>
												{person.job || person.department || "Crew"}
											</Text>
										</TouchableOpacity>
									))}
								</View>
							</View>
						)}
					</View>
				</ScrollView>
			</SafeAreaView>

			<WatchDatePickerModal
				visible={showDateModal}
				onDismiss={() => setShowDateModal(false)}
				onConfirm={handleMarkWatchedWithDate}
				isLoading={markMutation.isPending}
				is24Hour={is24Hour}
			/>

			<Modal
				visible={showHistoryModal}
				animationType="fade"
				transparent={true}
				onRequestClose={() => setShowHistoryModal(false)}
			>
				<View style={styles.modalOverlay}>
					<View
						style={[
							styles.modalContent,
							{ backgroundColor: themeColors.surfaceContainerHigh },
						]}
					>
						<View style={styles.modalHeader}>
							<Text
								style={[styles.modalTitle, { color: themeColors.onSurface }]}
							>
								Watch History
							</Text>
							<Pressable onPress={() => setShowHistoryModal(false)}>
								<Ionicons
									name="close"
									size={24}
									color={themeColors.onSurface}
								/>
							</Pressable>
						</View>
						<Text
							style={[
								styles.modalDescription,
								{ color: themeColors.onSurfaceVariant },
							]}
						>
							All watches for this episode
						</Text>

						<ScrollView style={styles.historyList}>
							{episodeWatchHistory.length > 0 ? (
								episodeWatchHistory.map((watch: EpisodeHistoryItemDto) => (
									<View
										key={watch.id}
										style={[
											styles.historyItem,
											{
												backgroundColor: themeColors.surfaceContainer,
												borderColor: themeColors.outline,
											},
										]}
									>
										<Text
											style={[
												styles.historyDate,
												{ color: themeColors.onSurface },
											]}
										>
											{formatWatchDate(
												watch.watchedDate,
												userTimezone,
												is24Hour,
											)}
										</Text>
										<TouchableOpacity
											onPress={() =>
												deleteWatchEntryMutation.mutate({
													path: { trackedEpisodeId: watch.id },
												})
											}
											disabled={deleteWatchEntryMutation.isPending}
											activeOpacity={0.7}
										>
											{deleteWatchEntryMutation.isPending &&
											deleteWatchEntryMutation.variables?.path
												?.trackedEpisodeId === watch.id ? (
												<ActivityIndicator
													size="small"
													color={themeColors.onSurfaceVariant}
												/>
											) : (
												<Ionicons
													name="trash-outline"
													size={18}
													color="#ef4444"
												/>
											)}
										</TouchableOpacity>
									</View>
								))
							) : (
								<Text
									style={[
										styles.emptyHistory,
										{ color: themeColors.onSurfaceVariant },
									]}
								>
									No watch history found
								</Text>
							)}
						</ScrollView>

						<Button
							variant="outlined"
							onPress={() => setShowHistoryModal(false)}
						>
							<Text
								style={[
									styles.modalCancelText,
									{ color: themeColors.onSurfaceVariant },
								]}
							>
								Close
							</Text>
						</Button>
					</View>
				</View>
			</Modal>

			<AddToListModal
				visible={showAddToListModal}
				onClose={() => setShowAddToListModal(false)}
				mediaType="show"
				mediaId={id}
				mediaTitle={show?.name || title || "Show"}
			/>
		</>
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
		backgroundColor: "#1f2937",
	},
	castImage: {
		width: 100,
		height: 140,
	},
	castImagePlaceholder: {
		width: 100,
		height: 140,
		backgroundColor: "#1f2937",
		justifyContent: "center",
		alignItems: "center",
	},
	castImagePlaceholderText: {
		fontSize: 12,
		color: "#6b7280",
		textAlign: "center",
		paddingHorizontal: 8,
	},
	castName: {
		fontSize: 13,
		fontWeight: "500",
		color: "#e5e7eb",
		marginBottom: 2,
	},
	castCharacter: {
		fontSize: 11,
		color: "#6b7280",
	},
	crewGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	crewCard: {
		backgroundColor: "#111827",
		borderRadius: borderRadius.md,
		padding: spacing.md,
		flex: 1,
		minWidth: "45%",
	},
	crewName: {
		fontSize: 14,
		fontWeight: "500",
		color: "#e5e7eb",
		marginBottom: 2,
	},
	crewJob: {
		fontSize: 12,
		color: "#6b7280",
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		padding: spacing.lg,
	},
	modalContent: {
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		gap: spacing.md,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "700",
	},
	modalDescription: {
		fontSize: 14,
	},
	modalCancelText: {
		fontSize: 14,
		fontWeight: "600",
	},
	historyList: {
		maxHeight: 320,
	},
	historyItem: {
		padding: spacing.md,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		marginBottom: spacing.sm,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	historyDate: {
		fontSize: 14,
		flex: 1,
	},
	emptyHistory: {
		fontSize: 14,
		textAlign: "center",
		paddingVertical: spacing.xl,
	},
});
