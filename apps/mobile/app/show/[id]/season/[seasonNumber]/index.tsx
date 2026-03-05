import { Ionicons } from "@expo/vector-icons";
import {
	authControllerMeOptions,
	listsControllerGetListsForItemOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	type TmdbSeasonDetailDto,
	type TmdbShowDetailDto,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
	RefreshControl,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddToListModal } from "@/components/AddToListModal";
import {
	CastSection,
	CrewSection,
	DetailActions,
	DetailHero,
	EpisodeCard,
	type EpisodeSummary,
	GenresSection,
	MetadataPills,
	OverviewSection,
	SeasonNav,
} from "@/components/detail";
import { ScrollRevealHeader } from "@/components/ScrollRevealHeader";
import { WatchDatePickerModal } from "@/components/WatchDatePickerModal";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import { useScrollRevealHeader } from "@/hooks/useScrollRevealHeader";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";
import {
	buildScopedShowMediaId,
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
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
	const { colors: themeColors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const [showListModal, setShowListModal] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);
	const { showCompactHeader, onScroll } = useScrollRevealHeader();

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
	const show = showData as TmdbShowDetailDto | undefined;

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
	const scopedSeasonMediaId = buildScopedShowMediaId(id, Number(seasonNumber));

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
		data: listsForShow,
		isRefetching: isListsRefetching,
		refetch: refetchLists,
	} = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: scopedSeasonMediaId },
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

	const isRefreshing =
		isShowRefetching ||
		isSeasonRefetching ||
		isHistoryRefetching ||
		isListsRefetching ||
		isUserSettingsRefetching;

	const handleRefresh = useCallback(async () => {
		const refetchPromises: Promise<unknown>[] = [
			refetchShow(),
			refetchSeason(),
			refetchUser(),
		];
		if (resolvedUserDid) {
			refetchPromises.push(
				refetchHistory(),
				refetchLists(),
				refetchUserSettings(),
			);
		}
		await Promise.all(refetchPromises);
	}, [
		resolvedUserDid,
		refetchShow,
		refetchSeason,
		refetchUser,
		refetchHistory,
		refetchLists,
		refetchUserSettings,
	]);

	const listsCount = listsForShow?.filter((l) => l.isInList).length ?? 0;
	const is24Hour = userSettings?.timeFormat === "24h";

	const showColors = show?.colors || {
		primary: themeColors.primary,
		secondary: themeColors.secondary,
		accent: themeColors.tertiary,
		muted: themeColors.surfaceContainerHighest,
	};

	const backdropUrl = getTmdbBackdropUrl(show?.backdrop_path);
	const seasonPoster = getTmdbPosterUrl(season?.poster_path, "w500");
	const seasonEpisodes = season?.episodes || [];

	const markSeasonWatchedMutation = useMutation({
		mutationKey: ["shows", id, "seasons", seasonNumber, "markSeasonWatched"],
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			invalidateUserShelfQueries(queryClient, resolvedUserDid);
			queryClient.invalidateQueries({
				queryKey: ["showsControllerGetShowWatchHistory"],
			});
			showToast(`Marked ${data.count} episodes as watched`);
		},
		onError: () => {
			showToast("Failed to mark season as watched. Please try again.", "error");
		},
	});

	const handleMarkWatched = () => {
		markSeasonWatchedMutation.mutate({
			body: {
				showId: id,
				seasonNumber: Number(seasonNumber),
			},
		});
	};

	const handleMarkWatchedWithDate = (date: Date) => {
		markSeasonWatchedMutation.mutate({
			body: {
				showId: id,
				seasonNumber: Number(seasonNumber),
				watchedAt: date.toISOString(),
			},
		});
	};

	const unmarkSeasonWatchedMutation = useMutation({
		mutationKey: ["shows", id, "seasons", seasonNumber, "unmarkSeasonWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			invalidateUserShelfQueries(queryClient, resolvedUserDid);
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId: id },
				}),
			});
			showToast("Removed season from your shelf");
		},
		onError: () => {
			showToast("Failed to remove from shelf. Please try again.", "error");
		},
	});

	const handleUnmarkWatched = () => {
		unmarkSeasonWatchedMutation.mutate({
			path: { showId: id },
			query: { mode: "all", seasonNumber: Number(seasonNumber) },
		});
	};

	const handleShare = async () => {
		const shareUrl = `https://opnshelf.xyz/shows/${id}/season/${seasonNumber}`;
		try {
			await Share.share({
				message: `Check out ${show?.name} Season ${seasonNumber} on OpnShelf!\n\n${shareUrl}`,
				title: `${show?.name} Season ${seasonNumber}`,
			});
		} catch {
			// User cancelled or error
		}
	};

	const watchedEpisodeCount = useMemo(() => {
		if (!history) return 0;
		return history.filter((h) => h.seasonNumber === Number(seasonNumber))
			.length;
	}, [history, seasonNumber]);

	const episodeWatchedCounts = useMemo(() => {
		if (!history) return new Map<number, number>();
		const counts = new Map<number, number>();
		for (const h of history) {
			if (h.seasonNumber === Number(seasonNumber)) {
				const current = counts.get(h.episodeNumber) ?? 0;
				counts.set(h.episodeNumber, current + 1);
			}
		}
		return counts;
	}, [history, seasonNumber]);

	const metadataItems = useMemo(() => {
		const items = [];
		if (season?.air_date) {
			items.push({
				icon: (
					<Ionicons
						name="calendar-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: formatDateOnly(season.air_date),
			});
		}
		if (seasonEpisodes.length > 0) {
			items.push({
				icon: (
					<Ionicons
						name="film-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: `${seasonEpisodes.length} episodes`,
			});
		}
		return items;
	}, [season, seasonEpisodes.length, themeColors]);

	const compactHeaderTitle = `${show?.name || title || "Show"} · Season ${seasonNumber}`;

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: themeColors.background }]}
		>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				onScroll={onScroll}
				scrollEventThrottle={16}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor={themeColors.primary}
						colors={[themeColors.primary]}
						progressBackgroundColor={themeColors.surfaceContainerHigh}
					/>
				}
			>
				<DetailHero
					title={show?.name || title || "Show"}
					subtitle={`Season ${seasonNumber}`}
					backdropUrl={backdropUrl}
					posterUrl={seasonPoster}
					colors={showColors}
					onBack={() => router.back()}
					posterLinkTo={{
						onPress: () =>
							router.push({ pathname: "/show/[id]", params: { id } }),
					}}
				/>

				<View style={styles.content}>
					<DetailActions
						mediaType="season"
						mediaId={id}
						seasonNumber={seasonNumber}
						colors={showColors}
						isWatched={watchedEpisodeCount > 0}
						watchedDate={null}
						totalWatches={watchedEpisodeCount}
						onMarkWatched={handleMarkWatched}
						onUnmarkWatched={handleUnmarkWatched}
						onShowDatePicker={() => setShowDateModal(true)}
						isMarkingPending={markSeasonWatchedMutation.isPending}
						isUnmarkingPending={unmarkSeasonWatchedMutation.isPending}
						listsCount={listsCount}
						onShowListModal={() => setShowListModal(true)}
						isLoggedIn={!!user}
						onLogin={() => router.push("/login")}
						onShare={handleShare}
					/>

					{(show?.number_of_seasons ?? 0) > 1 && (
						<SeasonNav
							currentSeason={Number(seasonNumber)}
							totalSeasons={show?.number_of_seasons ?? 1}
							onPreviousSeason={() =>
								router.push({
									pathname: "/show/[id]/season/[seasonNumber]",
									params: {
										id,
										seasonNumber: String(Number(seasonNumber) - 1),
										title: show?.name || title || "",
									},
								})
							}
							onNextSeason={() =>
								router.push({
									pathname: "/show/[id]/season/[seasonNumber]",
									params: {
										id,
										seasonNumber: String(Number(seasonNumber) + 1),
										title: show?.name || title || "",
									},
								})
							}
						/>
					)}

					<MetadataPills items={metadataItems} />

					<OverviewSection
						titleColor={showColors.primary}
						content={season?.overview || ""}
					/>
					<GenresSection
						titleColor={showColors.primary}
						textColor={showColors.primary}
						genres={show?.genres}
					/>

					{seasonEpisodes.length > 0 && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: showColors.primary }]}
							>
								Episodes
							</Text>
							<View style={styles.episodesList}>
								{seasonEpisodes.map((episode) => (
									<EpisodeCard
										key={episode.id}
										showId={id}
										seasonNumber={seasonNumber}
										episode={episode as EpisodeSummary}
										watchedCount={
											episodeWatchedCounts.get(episode.episode_number) ?? 0
										}
										colors={showColors}
										userDid={user?.did}
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
					)}


					<CastSection titleColor={showColors.primary} cast={show?.credits?.cast} />
					<CrewSection titleColor={showColors.primary} crew={show?.credits?.crew} />
				</View>
			</ScrollView>

			<WatchDatePickerModal
				visible={showDateModal}
				onDismiss={() => setShowDateModal(false)}
				onConfirm={handleMarkWatchedWithDate}
				isLoading={markSeasonWatchedMutation.isPending}
				is24Hour={is24Hour}
			/>

			<AddToListModal
				visible={showListModal}
				onClose={() => setShowListModal(false)}
				mediaType="show"
				mediaId={scopedSeasonMediaId}
				mediaTitle={show?.name || title || "Show"}
			/>

			<ScrollRevealHeader
				visible={showCompactHeader}
				onBack={() => router.back()}
				title={compactHeaderTitle}
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
	episodesList: {
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
