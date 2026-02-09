import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetMovieWatchHistory,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import type { TmdbMovieDetailDto, WatchHistoryItemDto } from "@opnshelf/api";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	ArrowLeft,
	Calendar,
	Check,
	Clock,
	Eye,
	History,
	Loader2,
	Plus,
	RotateCcw,
	Trash2,
	X,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
	Alert,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, spacing, borderRadius } from "@/constants/theme";
import { Image } from "expo-image";
import { format } from "date-fns";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";

function formatRuntime(minutes: number, useHours: boolean): string {
	if (!useHours) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}m`;
}

export default function MovieDetailScreen() {
	const { id: movieId, title } = useLocalSearchParams<{ id: string; title?: string }>();
	const router = useRouter();
	const { user } = useAuth();
	const queryClient = useQueryClient();

	const [showHours, setShowHours] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);
	const [customDate, setCustomDate] = useState<Date>(new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [showTimePicker, setShowTimePicker] = useState(false);
	const [showHistoryModal, setShowHistoryModal] = useState(false);

	// Fetch movie details
	const { data: movieData, isLoading: isMovieLoading } = useQuery({
		...moviesControllerGetMovieDetailsOptions({
			path: { movieId },
		}),
	});

	const movie = movieData as TmdbMovieDetailDto | undefined;

	// Fetch user's tracked movies
	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	// Fetch watch history for this movie
	const { data: watchHistory } = useQuery<WatchHistoryItemDto[]>({
		queryKey: ["watchHistory", user?.did, movieId],
		queryFn: async () => {
			if (!user?.did) return [];
			const { data } = await moviesControllerGetMovieWatchHistory({
				path: { userDid: user.did, movieId },
			});
			return data || [];
		},
		enabled: !!user?.did && !!movieId,
	});

	// Check if this movie is in user's watched list
	const isWatched = useMemo(() => {
		if (!trackedMovies) return false;
		return trackedMovies.some((tm) => tm.movieId === movieId);
	}, [trackedMovies, movieId]);

	// Find the tracked movie entry
	const trackedMovie = useMemo(() => {
		if (!trackedMovies) return null;
		return trackedMovies.find((tm) => tm.movieId === movieId) || null;
	}, [trackedMovies, movieId]);

	// Format the watched date
	const formattedWatchedDate = useMemo(() => {
		if (!trackedMovie?.watchedDate) return null;
		return format(new Date(trackedMovie.watchedDate), "MMM d, yyyy HH:mm");
	}, [trackedMovie]);

	// Use server-provided colors with fallbacks
	const movieColors = movie?.colors || {
		primary: "#8b5cf6",
		secondary: "#6366f1",
		accent: "#a855f7",
		muted: "#4c1d95",
	};

	// Mutations
	const markMutation = useMutation({
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["watchHistory", user?.did, movieId],
			});
			setShowDateModal(false);
			Alert.alert("Success", "Added to your shelf");
		},
		onError: () => {
			Alert.alert("Error", "Failed to add. Please try again.");
		},
	});

	const unmarkMutation = useMutation({
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["watchHistory", user?.did, movieId],
			});
			Alert.alert("Success", "Removed from your shelf");
		},
		onError: () => {
			Alert.alert("Error", "Failed to remove. Please try again.");
		},
	});

	const deleteWatchEntryMutation = useMutation({
		...moviesControllerDeleteWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["watchHistory", user?.did, movieId],
			});
			Alert.alert("Success", "Watch entry removed");
		},
		onError: () => {
			Alert.alert("Error", "Failed to remove watch entry. Please try again.");
		},
	});

	const handleMarkWatched = useCallback(() => {
		markMutation.mutate({ body: { movieId } });
	}, [markMutation, movieId]);

	const handleMarkWatchedWithDate = useCallback(() => {
		const watchedAt = customDate.toISOString();
		markMutation.mutate({
			body: { movieId, watchedAt },
		});
	}, [markMutation, movieId, customDate]);

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
		[deleteWatchEntryMutation]
	);

	const onDateChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
		setShowDatePicker(false);
		if (selectedDate) {
			const newDate = new Date(customDate);
			newDate.setFullYear(selectedDate.getFullYear());
			newDate.setMonth(selectedDate.getMonth());
			newDate.setDate(selectedDate.getDate());
			setCustomDate(newDate);
			setShowTimePicker(true);
		}
	}, [customDate]);

	const onTimeChange = useCallback((event: DateTimePickerEvent, selectedTime?: Date) => {
		setShowTimePicker(false);
		if (selectedTime) {
			const newDate = new Date(customDate);
			newDate.setHours(selectedTime.getHours());
			newDate.setMinutes(selectedTime.getMinutes());
			setCustomDate(newDate);
		}
	}, [customDate]);

	const openDateModal = useCallback(() => {
		setCustomDate(new Date());
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

	if (isMovieLoading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<Skeleton width={80} height={80} borderRadius={borderRadius.full} />
					<View style={{ marginTop: spacing.lg }}>
						<Skeleton width={200} height={24} />
					</View>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<View style={styles.container}>
			<ScrollView>
				{/* Hero Section with Backdrop */}
				<View style={styles.heroContainer}>
					{backdropUrl ? (
						<>
							<Image
								source={{ uri: backdropUrl }}
								style={styles.backdrop}
								contentFit="cover"
							/>
							<View style={[styles.gradientOverlay, styles.bottomGradient]} />
							<View style={[styles.gradientOverlay, styles.sideGradient]} />
						</>
					) : (
						<View
							style={[
								styles.backdrop,
								{ backgroundColor: movieColors.muted },
							]}
						/>
					)}

					{/* Back button */}
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<ArrowLeft size={24} color={colors.text} />
					</Pressable>

					{/* Hero Content */}
					<View style={styles.heroContent}>
						{posterUrl && (
							<View
								style={[
									styles.posterContainer,
									{ shadowColor: movieColors.primary },
								]}
							>
								<Image
									source={{ uri: posterUrl }}
									style={styles.poster}
									contentFit="cover"
								/>
							</View>
						)}

						<View style={styles.titleContainer}>
							<Text style={[styles.title, { textShadowColor: `${movieColors.primary}60` }]}>
								{movie?.title}
							</Text>
							{releaseYear && (
								<View style={styles.metaRow}>
									<View style={styles.metaItem}>
										<Calendar size={16} color={movieColors.accent} />
										<Text style={styles.metaText}>{releaseYear}</Text>
									</View>
									{movie?.runtime && (
										<Pressable onPress={() => setShowHours(!showHours)} style={styles.metaItem}>
											<Clock size={16} color={movieColors.accent} />
											<Text style={styles.metaText}>
												{formatRuntime(movie.runtime, showHours)}
											</Text>
										</Pressable>
									)}
								</View>
							)}
						</View>
					</View>
				</View>

				{/* Content */}
				<View style={styles.content}>
					{/* Actions */}
					<View style={styles.actionsContainer}>
						{user ? (
							!isWatched ? (
								<>
									<Button
										size="lg"
										onPress={handleMarkWatched}
										isLoading={isPending}
										style={[
											styles.primaryButton,
											{
												backgroundColor: movieColors.primary,
												shadowColor: movieColors.primary,
											},
										]}
									>
										<Plus size={20} color={colors.text} style={styles.buttonIcon} />
										<Text style={styles.buttonText}>Add to Shelf</Text>
									</Button>
									<Button variant="outline" onPress={openDateModal}>
										<Calendar size={16} color={colors.textMuted} style={styles.buttonIcon} />
										<Text style={styles.secondaryButtonText}>Add on Different Date</Text>
									</Button>
								</>
							) : (
								<>
									<Card style={styles.watchedCard}>
										<View style={styles.watchedHeader}>
											<Check size={20} color={colors.success} />
											<Text style={styles.watchedText}>On Your Shelf</Text>
										</View>
										{formattedWatchedDate && (
											<Text style={styles.watchedDate}>
												Watched on {formattedWatchedDate}
											</Text>
										)}
										{(watchHistory?.length ?? 0) > 1 && (
											<>
												<View style={styles.watchCount}>
													<History size={14} color={colors.textMuted} />
													<Text style={styles.watchCountText}>
														{watchHistory?.length} total watches
													</Text>
												</View>
												<Pressable
													onPress={() => setShowHistoryModal(true)}
													style={styles.viewHistoryButton}
												>
													<Eye size={16} color={colors.textMuted} />
													<Text style={styles.viewHistoryText}>View all watches</Text>
												</Pressable>
											</>
										)}
										{watchHistory?.length === 1 && (
											<Pressable
												onPress={handleUnmarkWatched}
												disabled={unmarkMutation.isPending}
												style={styles.removeButton}
											>
												{unmarkMutation.isPending ? (
													<Loader2 size={16} color={colors.error} />
												) : (
													<>
														<Trash2 size={16} color={colors.error} />
														<Text style={styles.removeButtonText}>Remove from shelf</Text>
													</>
												)}
											</Pressable>
										)}
									</Card>
									<Button
										size="lg"
										onPress={handleMarkWatched}
										isLoading={isPending}
										style={[
											styles.primaryButton,
											{
												backgroundColor: movieColors.primary,
												shadowColor: movieColors.primary,
											},
										]}
									>
										<RotateCcw size={18} color={colors.text} style={styles.buttonIcon} />
										<Text style={styles.buttonText}>Watch Now</Text>
									</Button>
									<Button variant="outline" onPress={openDateModal}>
										<Calendar size={16} color={colors.textMuted} style={styles.buttonIcon} />
										<Text style={styles.secondaryButtonText}>Watch on Different Date</Text>
									</Button>
								</>
							)
						) : (
							<Button
								size="lg"
								onPress={() => router.push("/(tabs)/shelf")}
								style={[
									styles.primaryButton,
									{
										backgroundColor: movieColors.primary,
										shadowColor: movieColors.primary,
									},
								]}
							>
								<Text style={styles.buttonText}>Sign in to Track</Text>
							</Button>
						)}
					</View>

					{/* Overview */}
					<View style={styles.section}>
						<Text style={[styles.sectionTitle, { color: movieColors.primary }]}>
							Overview
						</Text>
						<Text style={styles.overview}>{movie?.overview || "No overview available."}</Text>
					</View>

					{/* Additional Info */}
					<View style={styles.infoGrid}>
						{movie?.release_date && (
							<Card style={styles.infoCard}>
								<Text style={styles.infoLabel}>Release Date</Text>
								<Text style={[styles.infoValue, { color: movieColors.accent }]}>
									{format(new Date(movie.release_date), "MMMM d, yyyy")}
								</Text>
							</Card>
						)}
						{movie?.runtime && (
							<Pressable onPress={() => setShowHours(!showHours)}>
								<Card style={styles.infoCard}>
									<Text style={styles.infoLabel}>Runtime</Text>
									<Text style={[styles.infoValue, { color: movieColors.accent }]}>
										{formatRuntime(movie.runtime, showHours)}
									</Text>
								</Card>
							</Pressable>
						)}
						{movie?.vote_average && (
							<Card style={styles.infoCard}>
								<Text style={styles.infoLabel}>Rating</Text>
								<Text style={[styles.infoValue, { color: movieColors.accent }]}>
									{movie.vote_average.toFixed(1)}/10
								</Text>
							</Card>
						)}
						{movie?.vote_count && (
							<Card style={styles.infoCard}>
								<Text style={styles.infoLabel}>Votes</Text>
								<Text style={[styles.infoValue, { color: movieColors.accent }]}>
									{movie.vote_count.toLocaleString()}
								</Text>
							</Card>
						)}
					</View>

					{/* Genres */}
					{movie?.genres && movie.genres.length > 0 && (
						<View style={styles.section}>
							<Text style={[styles.sectionTitle, { color: movieColors.primary }]}>
								Genres
							</Text>
							<View style={styles.genresContainer}>
								{movie.genres.map((genre) => (
									<Badge
										key={genre.id}
										variant="outline"
										style={[
											styles.genreBadge,
											{
												backgroundColor: `${movieColors.primary}20`,
												borderColor: `${movieColors.primary}40`,
											},
										]}
									>
										<Text style={[styles.genreText, { color: movieColors.accent }]}>
											{genre.name}
										</Text>
									</Badge>
								))}
							</View>
						</View>
					)}
				</View>
			</ScrollView>

			{/* Date Picker Modal */}
			<Modal
				visible={showDateModal}
				animationType="slide"
				transparent={true}
				onRequestClose={() => setShowDateModal(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>Watch Again</Text>
							<Pressable onPress={() => setShowDateModal(false)}>
								<X size={24} color={colors.text} />
							</Pressable>
						</View>
						<Text style={styles.modalDescription}>When did you watch this movie?</Text>

						<View style={styles.dateTimeContainer}>
							<Pressable onPress={() => setShowDatePicker(true)} style={styles.dateTimeButton}>
								<Calendar size={20} color={colors.textMuted} />
								<Text style={styles.dateTimeText}>
									{format(customDate, "MMMM d, yyyy")}
								</Text>
							</Pressable>
							<Pressable onPress={() => setShowTimePicker(true)} style={styles.dateTimeButton}>
								<Clock size={20} color={colors.textMuted} />
								<Text style={styles.dateTimeText}>
									{format(customDate, "HH:mm")}
								</Text>
							</Pressable>
						</View>

						<View style={styles.modalActions}>
							<Button variant="outline" onPress={() => setShowDateModal(false)}>
								<Text style={styles.secondaryButtonText}>Cancel</Text>
							</Button>
							<Button
								onPress={handleMarkWatchedWithDate}
								isLoading={markMutation.isPending}
								style={{ backgroundColor: colors.primary }}
							>
								<Text style={styles.buttonText}>Add Play</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>

			{/* History Modal */}
			<Modal
				visible={showHistoryModal}
				animationType="slide"
				transparent={true}
				onRequestClose={() => setShowHistoryModal(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<View style={styles.modalHeader}>
							<View style={styles.modalTitleContainer}>
								<History size={20} color={colors.text} />
								<Text style={styles.modalTitle}>Watch History</Text>
							</View>
							<Pressable onPress={() => setShowHistoryModal(false)}>
								<X size={24} color={colors.text} />
							</Pressable>
						</View>
						<Text style={styles.modalDescription}>
							All the times you've watched {movie?.title}
						</Text>

						<ScrollView style={styles.historyList}>
							{watchHistory && watchHistory.length > 0 ? (
								watchHistory.map((watch) => (
									<View key={watch.id} style={styles.historyItem}>
										<Text style={styles.historyDate}>
											{format(new Date(watch.watchedDate), "MMM d, yyyy HH:mm")}
										</Text>
										<Pressable
											onPress={() => handleDeleteWatchEntry(watch.id)}
											disabled={deleteWatchEntryMutation.isPending}
											style={styles.historyDeleteButton}
										>
											{deleteWatchEntryMutation.isPending &&
											deleteWatchEntryMutation.variables?.path?.trackedMovieId === watch.id ? (
												<Loader2 size={16} color={colors.textMuted} />
											) : (
												<Trash2 size={16} color={colors.error} />
											)}
										</Pressable>
									</View>
								))
							) : (
								<Text style={styles.emptyHistory}>No watch history found</Text>
							)}
						</ScrollView>

						<Button variant="outline" onPress={() => setShowHistoryModal(false)}>
							<Text style={styles.secondaryButtonText}>Close</Text>
						</Button>
					</View>
				</View>
			</Modal>

			{/* Date/Time Pickers */}
			{showDatePicker && (
				<DateTimePicker
					value={customDate}
					mode="date"
					onChange={onDateChange}
				/>
			)}
			{showTimePicker && (
				<DateTimePicker
					value={customDate}
					mode="time"
					is24Hour={true}
					onChange={onTimeChange}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	heroContainer: {
		height: 400,
		position: "relative",
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
	},
	gradientOverlay: {
		...StyleSheet.absoluteFillObject,
	},
	bottomGradient: {
		backgroundColor: "rgba(3, 7, 18, 0.6)",
	},
	sideGradient: {
		backgroundColor: "rgba(3, 7, 18, 0.4)",
	},
	backButton: {
		position: "absolute",
		top: spacing.lg,
		left: spacing.lg,
		zIndex: 10,
		padding: spacing.sm,
		borderRadius: borderRadius.full,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	heroContent: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		padding: spacing.lg,
		flexDirection: "row",
		alignItems: "flex-end",
	},
	posterContainer: {
		width: 120,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.5,
		shadowRadius: 20,
		elevation: 10,
	},
	poster: {
		width: "100%",
		aspectRatio: 2 / 3,
	},
	titleContainer: {
		flex: 1,
		marginLeft: spacing.md,
		paddingBottom: spacing.sm,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: colors.text,
		textShadowOffset: { width: 0, height: 4 },
		textShadowRadius: 30,
		marginBottom: spacing.sm,
	},
	metaRow: {
		flexDirection: "row",
		gap: spacing.md,
	},
	metaItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	metaText: {
		fontSize: 14,
		color: colors.textMuted,
	},
	content: {
		padding: spacing.lg,
	},
	actionsContainer: {
		gap: spacing.md,
		marginBottom: spacing.xl,
	},
	primaryButton: {
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.3,
		shadowRadius: 15,
		elevation: 5,
	},
	buttonIcon: {
		marginRight: spacing.sm,
	},
	buttonText: {
		color: colors.text,
		fontSize: 16,
		fontWeight: "600",
	},
	secondaryButtonText: {
		color: colors.textMuted,
		fontSize: 16,
		fontWeight: "600",
	},
	watchedCard: {
		padding: spacing.md,
	},
	watchedHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		marginBottom: spacing.xs,
	},
	watchedText: {
		color: colors.success,
		fontSize: 16,
		fontWeight: "600",
	},
	watchedDate: {
		fontSize: 14,
		color: colors.textMuted,
		marginBottom: spacing.xs,
	},
	watchCount: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		marginTop: spacing.xs,
	},
	watchCountText: {
		fontSize: 12,
		color: colors.textMuted,
	},
	viewHistoryButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		marginTop: spacing.sm,
	},
	viewHistoryText: {
		fontSize: 14,
		color: colors.textMuted,
	},
	removeButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		marginTop: spacing.md,
	},
	removeButtonText: {
		fontSize: 14,
		color: colors.error,
	},
	section: {
		marginBottom: spacing.xl,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: "600",
		marginBottom: spacing.md,
	},
	overview: {
		fontSize: 16,
		color: colors.textMuted,
		lineHeight: 24,
	},
	infoGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.md,
		marginBottom: spacing.xl,
	},
	infoCard: {
		flex: 1,
		minWidth: "45%",
		padding: spacing.md,
	},
	infoLabel: {
		fontSize: 12,
		color: colors.textMuted,
		marginBottom: spacing.xs,
	},
	infoValue: {
		fontSize: 16,
		fontWeight: "600",
	},
	genresContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	genreBadge: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	genreText: {
		fontSize: 14,
		fontWeight: "500",
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		padding: spacing.lg,
	},
	modalContent: {
		backgroundColor: colors.card,
		borderRadius: borderRadius.xl,
		padding: spacing.lg,
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
		fontWeight: "bold",
		color: colors.text,
	},
	modalDescription: {
		fontSize: 14,
		color: colors.textMuted,
	},
	dateTimeContainer: {
		gap: spacing.md,
	},
	dateTimeButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		padding: spacing.md,
		backgroundColor: colors.cardMuted,
		borderRadius: borderRadius.lg,
	},
	dateTimeText: {
		fontSize: 16,
		color: colors.text,
	},
	modalActions: {
		flexDirection: "row",
		gap: spacing.md,
		marginTop: spacing.md,
	},
	historyList: {
		maxHeight: 300,
	},
	historyItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: spacing.md,
		backgroundColor: colors.cardMuted,
		borderRadius: borderRadius.lg,
		marginBottom: spacing.sm,
	},
	historyDate: {
		fontSize: 14,
		color: colors.text,
		fontWeight: "500",
	},
	historyDeleteButton: {
		padding: spacing.sm,
	},
	emptyHistory: {
		textAlign: "center",
		color: colors.textMuted,
		padding: spacing.xl,
	},
});
