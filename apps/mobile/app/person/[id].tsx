import { Ionicons } from "@expo/vector-icons";
import type {
	PersonFilmographyItemDto,
	TmdbPersonDetailDto,
} from "@opnshelf/api";
import {
	authControllerMeOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	peopleControllerGetPersonDetailsOptions,
	peopleControllerGetPersonFilmographyInfiniteOptions,
	showsControllerGetUserShowsOptions,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkShowWatchedMutation,
	showsControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Dimensions,
	RefreshControl,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddToListModal } from "@/components/AddToListModal";
import { DetailHero } from "@/components/detail";
import { MovieItem } from "@/components/MovieItem";
import { ScrollRevealHeader } from "@/components/ScrollRevealHeader";
import { ShowItem, type ShowItemData } from "@/components/ShowItem";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useScrollRevealHeader } from "@/hooks/useScrollRevealHeader";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w92";
const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w780";
const SCREEN_WIDTH = Dimensions.get("window").width;
const GAP = spacing.md;
const H_PADDING = spacing.lg;
const COLUMNS = 2;
const ITEM_MARGIN = GAP / 2;
const ITEM_WIDTH = (SCREEN_WIDTH - H_PADDING * 2) / COLUMNS - ITEM_MARGIN * 2;
const BIO_TRUNCATE_LENGTH = 300;

function formatDate(dateString?: string): string | null {
	if (!dateString) return null;
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function formatLifespan(birthday?: string, deathday?: string): string | null {
	if (!birthday) return null;
	const birthYear = new Date(birthday).getFullYear();
	if (deathday) {
		const deathYear = new Date(deathday).getFullYear();
		return `${birthYear} - ${deathYear}`;
	}
	return `${birthYear} - Present`;
}

// Truncate biography text at word boundary
function truncateBiography(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;

	// Find the last space before maxLength
	const truncated = text.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(" ");

	// If no space found, just truncate at maxLength
	if (lastSpace === -1) return `${truncated}...`;

	return `${truncated.slice(0, lastSpace)}...`;
}

// Format roles array for display
// Cast role first (with "as Character"), then crew jobs alphabetically
function formatRoles(item: PersonFilmographyItemDto): string | undefined {
	if (!item.roles || item.roles.length === 0) {
		// Fallback to legacy fields
		if (item.character) return `as ${item.character}`;
		if (item.job) return item.job;
		return undefined;
	}

	const roleStrings = item.roles
		.map((role) => {
			if (role.type === "cast" && role.character) {
				return `as ${role.character}`;
			}
			if (role.type === "crew" && role.job) {
				return role.job;
			}
			return undefined;
		})
		.filter((r): r is string => !!r);

	if (roleStrings.length === 0) return undefined;
	return roleStrings.join(" • ");
}

// Convert filmography item to MovieItem format
function toMovieItem(item: PersonFilmographyItemDto): {
	id: number;
	title: string;
	poster_path?: string;
	release_date?: string;
} {
	return {
		id: item.id,
		title: item.title,
		poster_path: item.poster_path ?? undefined,
		release_date: item.release_date,
	};
}

// Convert filmography item to ShowItem format
function toShowItem(item: PersonFilmographyItemDto): ShowItemData {
	return {
		id: item.id,
		name: item.title,
		poster_path: item.poster_path,
		first_air_date: item.first_air_date,
	};
}

export default function PersonDetailScreen() {
	const { id: personId } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { colors } = useTheme();
	const { showCompactHeader, onScroll } = useScrollRevealHeader();
	const queryClient = useQueryClient();
	const [isBioExpanded, setIsBioExpanded] = useState(false);

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const userDid = user?.did || "";

	const {
		data: personData,
		isLoading,
		isRefetching,
		refetch,
	} = useQuery({
		...peopleControllerGetPersonDetailsOptions({
			path: { personId },
		}),
	});

	const {
		data: filmographyData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useInfiniteQuery({
		...peopleControllerGetPersonFilmographyInfiniteOptions({
			path: { personId },
		}),
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
	});

	// Fetch user's tracked movies and shows
	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({ path: { userDid } }),
		enabled: !!userDid,
	});

	const { data: trackedShows } = useQuery({
		...showsControllerGetUserShowsOptions({ path: { userDid } }),
		enabled: !!userDid,
	});

	const person = personData as TmdbPersonDetailDto | undefined;

	const profileUrl = person?.profile_path
		? `${POSTER_BASE_URL}${person.profile_path}`
		: null;

	// Biography truncation logic
	const biography = person?.biography || "";
	const shouldTruncate = biography.length > BIO_TRUNCATE_LENGTH;
	const displayedBiography = useMemo(() => {
		if (!shouldTruncate || isBioExpanded) return biography;
		return truncateBiography(biography, BIO_TRUNCATE_LENGTH);
	}, [biography, shouldTruncate, isBioExpanded]);

	const subtitle = useMemo(() => {
		const lifespan = formatLifespan(person?.birthday, person?.deathday);
		if (person?.known_for_department && lifespan) {
			return `${person.known_for_department} • ${lifespan}`;
		}
		if (person?.known_for_department) {
			return person.known_for_department;
		}
		if (lifespan) {
			return lifespan;
		}
		return undefined;
	}, [person?.birthday, person?.deathday, person?.known_for_department]);

	const handleRefresh = async () => {
		await refetch();
	};

	// Flatten all filmography items
	const filmographyItems = useMemo(() => {
		return filmographyData?.pages.flatMap((page) => page.items) ?? [];
	}, [filmographyData]);

	// Get backdrop from first filmography item with a backdrop
	const backdropUrl = useMemo(() => {
		const itemWithBackdrop = filmographyItems.find(
			(item) => item.backdrop_path,
		);
		return itemWithBackdrop?.backdrop_path
			? `${BACKDROP_BASE_URL}${itemWithBackdrop.backdrop_path}`
			: null;
	}, [filmographyItems]);

	const totalFilmographyCount = filmographyData?.pages[0]?.total ?? 0;

	// Create lookup sets for watched items
	const watchedMovieIds = useMemo(() => {
		if (!trackedMovies) return new Set<string>();
		return new Set(trackedMovies.map((m) => m.movieId));
	}, [trackedMovies]);

	const watchedShowIds = useMemo(() => {
		if (!trackedShows) return new Set<string>();
		return new Set(trackedShows.map((s) => s.showId));
	}, [trackedShows]);

	// Calculate watched count
	const watchedCount = useMemo(() => {
		return filmographyItems.filter((item) => {
			if (item.media_type === "movie") {
				return watchedMovieIds.has(String(item.id));
			}
			return watchedShowIds.has(String(item.id));
		}).length;
	}, [filmographyItems, watchedMovieIds, watchedShowIds]);

	// Mutations
	const markMovieMutation = useMutation({
		mutationKey: ["movies", "markWatched"],
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({ path: { userDid } }),
			});
			invalidateUserShelfQueries(queryClient, userDid);
		},
	});

	const unmarkMovieMutation = useMutation({
		mutationKey: ["movies", "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({ path: { userDid } }),
			});
			invalidateUserShelfQueries(queryClient, userDid);
		},
	});

	const markShowMutation = useMutation({
		mutationKey: ["shows", "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({ path: { userDid } }),
			});
			invalidateUserShelfQueries(queryClient, userDid);
		},
	});

	const unmarkShowMutation = useMutation({
		mutationKey: ["shows", "unmarkWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({ path: { userDid } }),
			});
			invalidateUserShelfQueries(queryClient, userDid);
		},
	});

	// Modal state for add to list
	const [activeListModal, setActiveListModal] = useState<{
		mediaType: "movie" | "show";
		mediaId: string;
		title: string;
	} | null>(null);

	const handleToggleWatched = (item: PersonFilmographyItemDto) => {
		if (!user) return;

		const isMovie = item.media_type === "movie";
		const mediaId = String(item.id);
		const isWatched = isMovie
			? watchedMovieIds.has(mediaId)
			: watchedShowIds.has(mediaId);

		if (isWatched) {
			// Unmark immediately
			if (isMovie) {
				unmarkMovieMutation.mutate({
					path: { movieId: mediaId },
					query: { mode: "all" },
				});
			} else {
				unmarkShowMutation.mutate({
					path: { showId: mediaId },
					query: { mode: "all" },
				});
			}
		} else {
			// Mark with current date
			const now = new Date().toISOString();
			if (isMovie) {
				markMovieMutation.mutate({
					body: { movieId: mediaId, watchedAt: now },
				});
			} else {
				markShowMutation.mutate({
					body: { showId: mediaId, watchedAt: now },
				});
			}
		}
	};

	const _handleAddToList = (item: PersonFilmographyItemDto) => {
		if (!user) return;
		setActiveListModal({
			mediaType: item.media_type === "movie" ? "movie" : "show",
			mediaId: String(item.id),
			title: item.title,
		});
	};

	const handleNavigateToMedia = (item: PersonFilmographyItemDto) => {
		if (item.media_type === "movie") {
			router.push({
				pathname: "/movie/[id]",
				params: { id: String(item.id), title: item.title },
			});
		} else {
			router.push({
				pathname: "/show/[id]",
				params: { id: String(item.id), title: item.title },
			});
		}
	};

	const renderFilmographyItem = ({
		item,
	}: {
		item: PersonFilmographyItemDto;
	}) => {
		const isMovie = item.media_type === "movie";
		const mediaId = String(item.id);
		const isWatched = isMovie
			? watchedMovieIds.has(mediaId)
			: watchedShowIds.has(mediaId);

		const isMarking = isMovie
			? markMovieMutation.isPending &&
				markMovieMutation.variables?.body?.movieId === mediaId
			: markShowMutation.isPending &&
				markShowMutation.variables?.body?.showId === mediaId;

		const isUnmarking = isMovie
			? unmarkMovieMutation.isPending &&
				unmarkMovieMutation.variables?.path?.movieId === mediaId
			: unmarkShowMutation.isPending &&
				unmarkShowMutation.variables?.path?.showId === mediaId;

		const metaText = formatRoles(item);

		if (isMovie) {
			return (
				<MovieItem
					movie={toMovieItem(item)}
					isWatched={user ? isWatched : undefined}
					isMarking={user ? isMarking : undefined}
					isUnmarking={user ? isUnmarking : undefined}
					onToggle={user ? () => handleToggleWatched(item) : undefined}
					onPress={() => handleNavigateToMedia(item)}
					metaText={metaText}
					width={ITEM_WIDTH}
				/>
			);
		}

		return (
			<ShowItem
				show={toShowItem(item)}
				isWatched={user ? isWatched : undefined}
				isMarking={user ? isMarking : undefined}
				isUnmarking={user ? isUnmarking : undefined}
				onToggle={user ? () => handleToggleWatched(item) : undefined}
				onPress={() => handleNavigateToMedia(item)}
				metaText={metaText}
				width={ITEM_WIDTH}
			/>
		);
	};

	const keyExtractor = (item: PersonFilmographyItemDto) =>
		`${item.media_type}-${item.id}`;

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<FlashList
				data={filmographyItems}
				renderItem={renderFilmographyItem}
				keyExtractor={keyExtractor}
				numColumns={COLUMNS}
				contentContainerStyle={styles.listContent}
				onScroll={onScroll}
				scrollEventThrottle={16}
				refreshControl={
					<RefreshControl
						refreshing={isRefetching}
						onRefresh={handleRefresh}
						tintColor={colors.primary}
						colors={[colors.primary]}
						progressBackgroundColor={colors.surfaceContainerHigh}
					/>
				}
				ListHeaderComponent={
					<View>
						<DetailHero
							title={person?.name || "Person"}
							subtitle={subtitle}
							backdropUrl={backdropUrl}
							posterUrl={profileUrl}
							colors={{
								primary: colors.primary,
								secondary: colors.secondary,
								accent: colors.tertiary,
								muted: colors.surfaceContainerHighest,
							}}
							onBack={() => router.back()}
							isLoading={isLoading}
						/>

						<View style={styles.content}>
							{/* Personal Info Section */}
							<View style={styles.section}>
								<Text style={[styles.sectionTitle, { color: colors.primary }]}>
									Personal Info
								</Text>
								<View style={styles.infoItems}>
									{person?.birthday && (
										<View style={styles.infoItem}>
											<Ionicons
												name="calendar-outline"
												size={16}
												color={colors.onSurfaceVariant}
											/>
											<Text
												style={[
													styles.infoText,
													{ color: colors.onSurfaceVariant },
												]}
											>
												{person.deathday
													? `Born: ${formatDate(person.birthday)}`
													: `Birthday: ${formatDate(person.birthday)}`}
											</Text>
										</View>
									)}
									{person?.deathday && (
										<View style={styles.infoItem}>
											<Ionicons
												name="calendar-outline"
												size={16}
												color={colors.onSurfaceVariant}
											/>
											<Text
												style={[
													styles.infoText,
													{ color: colors.onSurfaceVariant },
												]}
											>
												Died: {formatDate(person.deathday)}
											</Text>
										</View>
									)}
									{person?.place_of_birth && (
										<View style={styles.infoItem}>
											<Ionicons
												name="location-outline"
												size={16}
												color={colors.onSurfaceVariant}
											/>
											<Text
												style={[
													styles.infoText,
													{ color: colors.onSurfaceVariant },
												]}
											>
												{person.place_of_birth}
											</Text>
										</View>
									)}
									{person?.popularity !== undefined && (
										<View style={styles.infoItem}>
											<Ionicons
												name="star-outline"
												size={16}
												color={colors.onSurfaceVariant}
											/>
											<Text
												style={[
													styles.infoText,
													{ color: colors.onSurfaceVariant },
												]}
											>
												Popularity: {person.popularity.toFixed(1)}
											</Text>
										</View>
									)}
								</View>
							</View>

							{/* Watched Progress Card */}
							{user && totalFilmographyCount > 0 && (
								<View style={styles.section}>
									<Text
										style={[styles.sectionTitle, { color: colors.primary }]}
									>
										Your Progress
									</Text>
									<Text
										style={[
											styles.progressText,
											{ color: colors.onSurfaceVariant },
										]}
									>
										<Text style={{ fontWeight: "600", color: colors.primary }}>
											{watchedCount}
										</Text>{" "}
										of{" "}
										<Text style={{ fontWeight: "500" }}>
											{totalFilmographyCount}
										</Text>{" "}
										titles watched
									</Text>
									<View
										style={[
											styles.progressBar,
											{ backgroundColor: colors.surfaceContainerHigh },
										]}
									>
										<View
											style={[
												styles.progressFill,
												{
													width: `${Math.min(100, (watchedCount / totalFilmographyCount) * 100)}%`,
													backgroundColor: colors.primary,
												},
											]}
										/>
									</View>
								</View>
							)}

							{/* Biography Section */}
							{person?.biography && (
								<View style={styles.section}>
									<Text
										style={[styles.sectionTitle, { color: colors.primary }]}
									>
										Biography
									</Text>
									<View style={styles.biographyRow}>
										<Text
											style={[
												styles.biography,
												{ color: colors.onSurfaceVariant },
											]}
										>
											{displayedBiography}
											{shouldTruncate && (
												<Text
													onPress={() => setIsBioExpanded(!isBioExpanded)}
													style={[
														styles.bioToggleTextInline,
														{ color: colors.primary },
													]}
												>
													{" "}
													{isBioExpanded ? "Show less" : "Show more"}
												</Text>
											)}
										</Text>
									</View>
								</View>
							)}

							{/* Filmography Section Header */}
							<View style={styles.filmographyHeader}>
								<Text style={[styles.sectionTitle, { color: colors.primary }]}>
									Filmography
									<Text
										style={[styles.count, { color: colors.onSurfaceVariant }]}
									>
										({totalFilmographyCount > 0 ? totalFilmographyCount : "..."}{" "}
										titles)
									</Text>
								</Text>
							</View>
						</View>
					</View>
				}
				ListFooterComponent={
					hasNextPage ? (
						<View style={styles.loadMoreContainer}>
							{isFetchingNextPage ? (
								<ActivityIndicator color={colors.primary} />
							) : (
								<TouchableOpacity
									onPress={() => fetchNextPage()}
									style={[
										styles.showMoreButton,
										{ backgroundColor: colors.surfaceContainer },
									]}
									activeOpacity={0.8}
								>
									<Text
										style={[styles.showMoreText, { color: colors.primary }]}
									>
										Show more
									</Text>
								</TouchableOpacity>
							)}
						</View>
					) : filmographyItems.length > 0 ? (
						<View style={styles.loadMoreContainer}>
							<Text
								style={[
									styles.allLoadedText,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Showing all {filmographyItems.length} titles
							</Text>
						</View>
					) : null
				}
			/>

			<ScrollRevealHeader
				visible={showCompactHeader}
				onBack={() => router.back()}
				title={person?.name || "Person"}
			/>

			{/* Add to List Modal */}
			{activeListModal && user && (
				<AddToListModal
					visible={!!activeListModal}
					onClose={() => setActiveListModal(null)}
					mediaType={activeListModal.mediaType}
					mediaId={activeListModal.mediaId}
					mediaTitle={activeListModal.title}
				/>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	listContent: {
		paddingBottom: spacing.xxl,
	},
	content: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.lg,
		gap: spacing.lg,
	},
	infoItems: {
		gap: spacing.xs,
	},
	infoItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	infoText: {
		fontSize: 14,
	},
	progressText: {
		fontSize: 14,
		marginBottom: spacing.xs,
	},
	progressBar: {
		height: 8,
		borderRadius: borderRadius.full,
		overflow: "hidden",
	},
	progressFill: {
		height: "100%",
	},
	section: {
		gap: spacing.xs,
	},
	filmographyHeader: {
		marginTop: spacing.sm,
		marginBottom: spacing.md,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	count: {
		fontSize: 14,
		fontWeight: "normal",
	},
	biography: {
		fontSize: 15,
		lineHeight: 22,
		flex: 1,
	},
	biographyRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "flex-start",
	},
	bioToggleTextInline: {
		fontSize: 15,
		lineHeight: 22,
		fontWeight: "500",
	},
	loadMoreContainer: {
		padding: spacing.md,
		alignItems: "center",
	},
	showMoreButton: {
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.lg,
		borderRadius: borderRadius.md,
		alignItems: "center",
		justifyContent: "center",
	},
	showMoreText: {
		fontSize: 14,
		fontWeight: "500",
	},
	allLoadedText: {
		fontSize: 14,
		textAlign: "center",
	},
});
