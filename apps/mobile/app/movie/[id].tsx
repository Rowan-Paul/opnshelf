import { Ionicons } from "@expo/vector-icons";
import type { TmdbMovieDetailDto } from "@opnshelf/api";
import {
	authControllerMeOptions,
	listsControllerGetListsForItemOptions,
	type MovieListsForItemDto,
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetMovieWatchHistoryOptions,
	moviesControllerGetMovieWatchHistoryQueryKey,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useCallback, useMemo, useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	Share,
	StyleSheet,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddToListModal } from "@/components/AddToListModal";
import { WatchDatePickerModal } from "@/components/WatchDatePickerModal";
import {
	CastSection,
	CrewSection,
	DetailActions,
	DetailHero,
	GenresSection,
	MetadataPills,
	OverviewSection,
	WatchHistoryModal,
} from "@/components/detail";
import { ScrollRevealHeader } from "@/components/ScrollRevealHeader";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import { useScrollRevealHeader } from "@/hooks/useScrollRevealHeader";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";

function formatRuntime(minutes: number, useHours: boolean): string {
	if (!useHours) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}m`;
}

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

function formatDateOnly(dateString: string): string {
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export default function MovieDetailScreen() {
	const { id: movieId, title } = useLocalSearchParams<{
		id: string;
		title?: string;
	}>();
	const router = useRouter();
	const { colors: themeColors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const posthog = usePostHog();

	const { data: user, refetch: refetchUser } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const [showDateModal, setShowDateModal] = useState(false);
	const [showAddToListModal, setShowAddToListModal] = useState(false);
	const [showHistoryModal, setShowHistoryModal] = useState(false);
	const { showCompactHeader, onScroll } = useScrollRevealHeader();

	const {
		data: movieData,
		isLoading: isMovieLoading,
		isRefetching: isMovieRefetching,
		refetch: refetchMovie,
	} = useQuery({
		...moviesControllerGetMovieDetailsOptions({
			path: { movieId },
		}),
	});

	const movie = movieData as TmdbMovieDetailDto | undefined;

	const movieColors = movie?.colors || {
		primary: "#F59E0B",
		secondary: "#D97706",
		accent: "#FBBF24",
		muted: "#92400E",
	};

	const {
		data: trackedMovies,
		isRefetching: isTrackedMoviesRefetching,
		refetch: refetchTrackedMovies,
	} = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	const {
		data: watchHistory,
		isRefetching: isWatchHistoryRefetching,
		refetch: refetchWatchHistory,
	} = useQuery({
		...moviesControllerGetMovieWatchHistoryOptions({
			path: { userDid: user?.did || "", movieId },
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

	const {
		data: listsForMovie,
		isRefetching: isListsRefetching,
		refetch: refetchListsForMovie,
	} = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "movie", mediaId: movieId },
		}),
		enabled: !!user?.did,
	});

	const isRefreshing =
		(isMovieRefetching ||
			isTrackedMoviesRefetching ||
			isWatchHistoryRefetching ||
			isUserSettingsRefetching ||
			isListsRefetching) &&
		!isMovieLoading;

	const handleRefresh = useCallback(async () => {
		const refetchPromises: Promise<unknown>[] = [refetchMovie(), refetchUser()];
		if (user?.did) {
			refetchPromises.push(
				refetchTrackedMovies(),
				refetchWatchHistory(),
				refetchUserSettings(),
				refetchListsForMovie(),
			);
		}
		await Promise.all(refetchPromises);
	}, [
		user?.did,
		refetchMovie,
		refetchUser,
		refetchTrackedMovies,
		refetchWatchHistory,
		refetchUserSettings,
		refetchListsForMovie,
	]);

	const listsForMovieTyped = (listsForMovie || []) as MovieListsForItemDto[];
	const listsCount = listsForMovieTyped.filter((l) => l.isInList).length;

	const userTimezone = userSettings?.timezone || "UTC";
	const is24Hour = userSettings?.timeFormat === "24h";

	const isWatched = useMemo(() => {
		if (!trackedMovies) return false;
		return trackedMovies.some((tm) => tm.movieId === movieId);
	}, [trackedMovies, movieId]);

	const trackedMovie = useMemo(() => {
		if (!trackedMovies) return null;
		return trackedMovies.find((tm) => tm.movieId === movieId) || null;
	}, [trackedMovies, movieId]);

	const formattedWatchedDate = useMemo(() => {
		if (!trackedMovie?.watchedDate) return null;
		return formatWatchDate(trackedMovie.watchedDate, userTimezone, is24Hour);
	}, [trackedMovie, userTimezone, is24Hour]);

	const markMutation = useMutation({
		mutationKey: ["movies", movieId, "markWatched"],
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			invalidateUserShelfQueries(queryClient, user?.did);
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
					path: { userDid: user?.did || "", movieId },
				}),
			});
			setShowDateModal(false);
			showToast("Added to your shelf", "success");
			posthog.capture("movie_marked_watched", {
				movie_id: movieId,
				...(movie?.title ? { movie_title: movie.title } : {}),
				...(movie?.release_date
					? { movie_year: new Date(movie.release_date).getFullYear() }
					: {}),
			});
		},
		onError: () => {
			showToast("Failed to add. Please try again.", "error");
		},
	});

	const unmarkMutation = useMutation({
		mutationKey: ["movies", movieId, "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			invalidateUserShelfQueries(queryClient, user?.did);
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
					path: { userDid: user?.did || "", movieId },
				}),
			});
			showToast("Removed from your shelf", "success");
			posthog.capture("movie_unmarked_watched", {
				movie_id: movieId,
				...(movie?.title ? { movie_title: movie.title } : {}),
			});
		},
		onError: () => {
			showToast("Failed to remove. Please try again.", "error");
		},
	});

	const deleteWatchEntryMutation = useMutation({
		mutationKey: ["movies", movieId, "deleteWatchEntry"],
		...moviesControllerDeleteWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			invalidateUserShelfQueries(queryClient, user?.did);
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
					path: { userDid: user?.did || "", movieId },
				}),
			});
			showToast("Watch entry removed", "success");
		},
		onError: () => {
			showToast("Failed to remove watch entry. Please try again.", "error");
		},
	});

	const handleMarkWatched = useCallback(() => {
		markMutation.mutate({ body: { movieId } });
	}, [markMutation, movieId]);

	const handleMarkWatchedWithDate = useCallback((date: Date) => {
		const watchedAt = date.toISOString();
		markMutation.mutate({
			body: { movieId, watchedAt },
		});
	}, [markMutation, movieId]);

	const handleUnmarkWatched = useCallback(() => {
		unmarkMutation.mutate({
			path: { movieId },
			query: { mode: "all" },
		});
	}, [unmarkMutation, movieId]);

	const handleDeleteWatchEntry = useCallback(
		(trackedMovieId: string) => {
			deleteWatchEntryMutation.mutate({ path: { trackedMovieId } });
		},
		[deleteWatchEntryMutation],
	);

	const handleShare = useCallback(async () => {
		const displayTitle = movie?.title || title;
		const shareUrl = `https://opnshelf.xyz/movies/${movieId}/${title || ""}`;
		try {
			await Share.share({
				message: `Check out ${displayTitle} on OpnShelf!\n\n${shareUrl}`,
				title: `Check out ${displayTitle} on OpnShelf`,
			});
			posthog.capture("movie_shared", {
				movie_id: movieId,
				...(displayTitle ? { movie_title: displayTitle } : {}),
			});
		} catch {
			showToast("Failed to share", "error");
		}
	}, [movie?.title, movieId, title, showToast, posthog]);

	const openDateModal = useCallback(() => {
		setShowDateModal(true);
	}, []);

	const releaseYear = movie?.release_date
		? new Date(movie.release_date).getFullYear()
		: null;

	const backdropUrl = movie?.backdrop_path
		? `${BACKDROP_BASE_URL}${movie.backdrop_path}`
		: null;

	const posterUrl = movie?.poster_path
		? `${POSTER_BASE_URL}${movie.poster_path}`
		: null;

	const isPending =
		markMutation.isPending && markMutation.variables?.body?.movieId === movieId;

	const metadataItems = useMemo(() => {
		const items = [];
		if (movie?.release_date) {
			items.push({
				icon: (
					<Ionicons
						name="calendar-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: formatDateOnly(movie.release_date),
			});
		}
		if (movie?.runtime) {
			items.push({
				icon: (
					<Ionicons
						name="time-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: formatRuntime(movie.runtime, false),
			});
		}
		if (movie?.vote_average) {
			items.push({
				icon: (
					<Ionicons
						name="star-outline"
						size={14}
						color={themeColors.onSurfaceVariant}
					/>
				),
				label: `${movie.vote_average.toFixed(1)}/10`,
			});
		}
		return items;
	}, [movie, themeColors]);

	if (isMovieLoading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={movieColors.primary} />
				</View>
			</SafeAreaView>
		);
	}

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
					title={movie?.title || title || ""}
					subtitle={releaseYear ? String(releaseYear) : undefined}
					backdropUrl={backdropUrl}
					posterUrl={posterUrl}
					colors={movieColors}
					onBack={() => router.back()}
					isLoading={isMovieLoading}
				/>

				<View style={styles.content}>
					<DetailActions
						mediaType="movie"
						mediaId={movieId}
						colors={movieColors}
						isWatched={isWatched}
						watchedDate={formattedWatchedDate}
						totalWatches={watchHistory?.length ?? 0}
						onMarkWatched={handleMarkWatched}
						onUnmarkWatched={handleUnmarkWatched}
						onShowDatePicker={openDateModal}
						isMarkingPending={isPending}
						isUnmarkingPending={unmarkMutation.isPending}
						listsCount={listsCount}
						onShowListModal={() => setShowAddToListModal(true)}
						onViewHistory={() => setShowHistoryModal(true)}
						onShare={handleShare}
						isLoggedIn={!!user}
						onLogin={() => router.push("/login")}
					/>

					<MetadataPills items={metadataItems} />

					<OverviewSection
						titleColor={movieColors.primary}
						content={movie?.overview || ""}
					/>
					<GenresSection
						titleColor={movieColors.primary}
						textColor={movieColors.accent}
						genres={movie?.genres}
					/>
					<CastSection titleColor={movieColors.primary} cast={movie?.credits?.cast} />
					<CrewSection titleColor={movieColors.primary} crew={movie?.credits?.crew} />
				</View>
			</ScrollView>

			<WatchDatePickerModal
				visible={showDateModal}
				onDismiss={() => setShowDateModal(false)}
				onConfirm={handleMarkWatchedWithDate}
				isLoading={markMutation.isPending}
				is24Hour={is24Hour}
			/>

			<WatchHistoryModal
				visible={showHistoryModal}
				onClose={() => setShowHistoryModal(false)}
				description={`All the times you've watched ${movie?.title || "this movie"}`}
				items={watchHistory ?? []}
				formatWatchDate={(watchedDate) =>
					formatWatchDate(watchedDate, userTimezone, is24Hour)
				}
				onDelete={handleDeleteWatchEntry}
				isDeleting={deleteWatchEntryMutation.isPending}
				deletingId={deleteWatchEntryMutation.variables?.path?.trackedMovieId}
			/>

			<AddToListModal
				visible={showAddToListModal}
				onClose={() => setShowAddToListModal(false)}
				mediaType="movie"
				mediaId={movieId}
				mediaTitle={movie?.title || title || ""}
			/>

			<ScrollRevealHeader
				visible={showCompactHeader}
				onBack={() => router.back()}
				title={movie?.title || title || "Movie"}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: spacing.xxl,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	content: {
		paddingHorizontal: spacing.md,
		gap: spacing.lg,
		paddingTop: spacing.lg,
	},
	section: {
		gap: spacing.sm,
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
		padding: spacing.md,
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
	modalTitleContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "700",
	},
	modalDescription: {
		fontSize: 14,
	},
	dateTimeContainer: {
		gap: spacing.sm,
	},
	dateTimeButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		padding: spacing.md,
		backgroundColor: "#111827",
		borderRadius: borderRadius.md,
	},
	dateTimeText: {
		fontSize: 16,
	},
	modalActionsSplit: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	buttonText: {
		color: "#f9fafb",
		fontSize: 16,
		fontWeight: "600",
	},
	secondaryButtonText: {
		color: "#9ca3af",
		fontSize: 15,
		fontWeight: "500",
	},
	historyList: {
		maxHeight: 300,
	},
	historyItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: spacing.md,
		borderRadius: borderRadius.md,
		marginBottom: spacing.sm,
	},
	historyDate: {
		fontSize: 14,
		fontWeight: "500",
	},
	historyDeleteButton: {
		padding: spacing.sm,
	},
	emptyHistory: {
		textAlign: "center",
		color: "#6b7280",
		padding: spacing.xl,
	},
});
