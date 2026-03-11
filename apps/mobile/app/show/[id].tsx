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
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePostHog } from "posthog-react-native";
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
	GenresSection,
	MetadataPills,
	OverviewSection,
	SeasonCard,
	TrailerPlayerModal,
	TrailerSection,
} from "@/components/detail";
import { ScrollRevealHeader } from "@/components/ScrollRevealHeader";
import { WatchDatePickerModal } from "@/components/WatchDatePickerModal";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import { useScrollRevealHeader } from "@/hooks/useScrollRevealHeader";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";
import { getTmdbBackdropUrl, getTmdbPosterUrl } from "@/lib/utils";

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
	const posthog = usePostHog();

	const [showListModal, setShowListModal] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);
	const [activeTrailer, setActiveTrailer] = useState<
		TmdbShowDetailDto["trailer"] | null
	>(null);
	const { showCompactHeader, onScroll } = useScrollRevealHeader();

	const { data: user, refetch: refetchUser } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const {
		data: showData,
		isLoading,
		isRefetching: isShowRefetching,
		refetch: refetchShow,
	} = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: id },
		}),
	});

	const show = showData as TmdbShowDetailDto | undefined;

	const {
		data: history,
		isRefetching: isHistoryRefetching,
		refetch: refetchHistory,
	} = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: user?.did || "", showId: id },
		}),
		enabled: !!user?.did,
	});

	const {
		data: listsForShow,
		isRefetching: isListsRefetching,
		refetch: refetchLists,
	} = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: id },
		}),
		enabled: !!user?.did,
	});

	const {
		data: userSettings,
		isRefetching: isUserSettingsRefetching,
		refetch: refetchUserSettings,
	} = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});

	const isRefreshing =
		(isShowRefetching ||
			isHistoryRefetching ||
			isListsRefetching ||
			isUserSettingsRefetching) &&
		!isLoading;

	const handleRefresh = useCallback(async () => {
		const refetchPromises: Promise<unknown>[] = [refetchShow(), refetchUser()];
		if (user?.did) {
			refetchPromises.push(
				refetchHistory(),
				refetchLists(),
				refetchUserSettings(),
			);
		}
		await Promise.all(refetchPromises);
	}, [
		user?.did,
		refetchShow,
		refetchUser,
		refetchHistory,
		refetchLists,
		refetchUserSettings,
	]);

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
			invalidateUserShelfQueries(queryClient, user?.did);
			queryClient.invalidateQueries({
				queryKey: ["showsControllerGetShowWatchHistory"],
			});
			showToast(`Marked ${data.count} episodes as watched`);
			posthog.capture("show_marked_watched", {
				show_id: id,
				episode_count: data.count,
				...(show?.name ? { show_name: show.name } : {}),
				...(show?.first_air_date
					? { show_year: new Date(show.first_air_date).getFullYear() }
					: {}),
			});
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
			invalidateUserShelfQueries(queryClient, user?.did);
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: user?.did || "", showId: id },
				}),
			});
			showToast("Removed all episodes from your shelf");
			posthog.capture("show_unmarked_watched", {
				show_id: id,
				...(show?.name ? { show_name: show.name } : {}),
			});
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
		const shareUrl = `https://opnshelf.xyz/shows/${id}`;
		try {
			await Share.share({
				message: `Check out ${show?.name} on OpnShelf!\n\n${shareUrl}`,
				title: show?.name,
			});
			posthog.capture("show_shared", {
				show_id: id,
				...(show?.name ? { show_name: show.name } : {}),
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

					<OverviewSection
						titleColor={showColors.primary}
						content={show?.overview || ""}
					/>
					<TrailerSection
						mediaType="show"
						detailTrailer={show?.trailer}
						titleColor={showColors.primary}
						onPress={setActiveTrailer}
					/>
					<GenresSection
						titleColor={showColors.primary}
						textColor={showColors.primary}
						genres={show?.genres}
					/>

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

					<CastSection
						titleColor={showColors.primary}
						cast={show?.credits?.cast}
					/>
					<CrewSection
						titleColor={showColors.primary}
						crew={show?.credits?.crew}
					/>
				</View>
			</ScrollView>

			<WatchDatePickerModal
				visible={showDateModal}
				onDismiss={() => setShowDateModal(false)}
				onConfirm={handleMarkWatchedWithDate}
				isLoading={markShowWatchedMutation.isPending}
				is24Hour={is24Hour}
			/>

			<AddToListModal
				visible={showListModal}
				onClose={() => setShowListModal(false)}
				mediaType="show"
				mediaId={id}
				mediaTitle={show?.name || "Show"}
			/>

			<ScrollRevealHeader
				visible={showCompactHeader}
				onBack={() => router.back()}
				title={show?.name || "Show"}
			/>

			<TrailerPlayerModal
				visible={!!activeTrailer}
				trailer={activeTrailer ?? null}
				onClose={() => setActiveTrailer(null)}
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
