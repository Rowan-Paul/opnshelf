import { Ionicons } from "@expo/vector-icons";
import type {
	TmdbCastDto,
	TmdbCrewDto,
	TmdbMovieDetailDto,
} from "@opnshelf/api";
import {
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
import { DatePickerModal, TimePickerModal } from "react-native-paper-dates";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddToListModal } from "@/components/AddToListModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { defaultColors as staticColors } from "@/constants/extended-theme";
import { borderRadius } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";

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

export default function MovieDetailScreen() {
	const { id: movieId, title } = useLocalSearchParams<{
		id: string;
		title?: string;
	}>();
	const router = useRouter();
	const { user } = useAuth();
	const { showToast } = useToast();
	const { colors } = useTheme();
	const queryClient = useQueryClient();

	const [showHours, setShowHours] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);
	const [showAddToListModal, setShowAddToListModal] = useState(false);
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

	// Use server-provided colors with fallbacks
	const movieColors = movie?.colors || {
		primary: "#F59E0B",
		secondary: "#D97706",
		accent: "#FBBF24",
		muted: "#92400E",
	};

	// Fetch user's tracked movies
	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	// Fetch watch history for this movie
	const { data: watchHistory } = useQuery({
		...moviesControllerGetMovieWatchHistoryOptions({
			path: { userDid: user?.did || "", movieId },
		}),
		enabled: !!user?.did && !!movieId,
	});

	// Fetch user settings for timezone and time format
	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});

	// Fetch lists for this movie
	const { data: listsForMovie } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "movie", mediaId: movieId },
		}),
		enabled: !!user?.did,
	});

	const listsForMovieTyped = (listsForMovie || []) as MovieListsForItemDto[];
	const listsCount = listsForMovieTyped.filter((l) => l.isInList).length;
	const isInAnyList = listsCount > 0;

	const userTimezone = userSettings?.timezone || "UTC";
	const is24Hour = userSettings?.timeFormat === "24h";

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
		return formatWatchDate(trackedMovie.watchedDate, userTimezone, is24Hour);
	}, [trackedMovie, userTimezone, is24Hour]);

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
				queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
					path: { userDid: user?.did || "", movieId },
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
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
					path: { userDid: user?.did || "", movieId },
				}),
			});
			showToast("Removed from your shelf", "success");
		},
		onError: () => {
			showToast("Failed to remove. Please try again.", "error");
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
		[deleteWatchEntryMutation],
	);

	const handleShare = useCallback(async () => {
		const url = `https://opnshelf.xyz/movie/${movieId}/${title || ""}`;
		try {
			await Share.share({
				title: `Check out ${title} on OpnShelf`,
				url,
			});
		} catch {
			showToast("Failed to share", "error");
		}
	}, [movieId, title, showToast]);

	const _openDateModal = useCallback(() => {
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
					<ActivityIndicator size="large" color={movieColors.primary} />
				</View>
			</SafeAreaView>
		);
	}

	return (
		<>
			<ScrollView
				style={styles.container}
				contentContainerStyle={styles.scrollContent}
			>
				<View style={styles.heroWrapper}>
					{backdropUrl ? (
						<Image
							source={{ uri: backdropUrl }}
							style={styles.backdrop}
							contentFit="cover"
						/>
					) : (
						<View
							style={[styles.backdrop, { backgroundColor: movieColors.muted }]}
						/>
					)}

					<TouchableOpacity
						onPress={() => router.back()}
						style={styles.backButton}
						activeOpacity={0.8}
					>
						<Ionicons name="arrow-back" size={24} color="#f9fafb" />
					</TouchableOpacity>

					<View style={styles.heroOverlay}>
						<View style={styles.posterWrapper}>
							{posterUrl ? (
								<Image
									source={{ uri: posterUrl }}
									style={styles.poster}
									contentFit="cover"
								/>
							) : (
								<View style={[styles.poster, styles.noPoster]}>
									<Text style={styles.noPosterText}>No poster</Text>
								</View>
							)}
						</View>

						<View style={styles.titleWrapper}>
							<Text
								style={[styles.title, { textShadowColor: movieColors.primary }]}
								numberOfLines={2}
								adjustsFontSizeToFit
								minimumFontScale={0.7}
							>
								{movie?.title || title}
							</Text>
							<View style={styles.metaRow}>
								{!!releaseYear && (
									<View style={styles.metaItem}>
										<Ionicons
											name="calendar-outline"
											size={14}
											color={movieColors.accent}
										/>
										<Text style={styles.metaText}>{releaseYear}</Text>
									</View>
								)}
								{movie?.runtime && (
									<TouchableOpacity
										onPress={() => setShowHours(!showHours)}
										style={styles.metaItem}
										activeOpacity={0.8}
									>
										<Ionicons
											name="time-outline"
											size={14}
											color={movieColors.accent}
										/>
										<Text style={styles.metaText}>
											{formatRuntime(movie.runtime, showHours)}
										</Text>
									</TouchableOpacity>
								)}
							</View>
						</View>
					</View>
				</View>

				<View style={styles.content}>
					<View style={styles.actionsContainer}>
						{user ? (
							!isWatched ? (
								<>
									<View style={styles.primaryButtonRow}>
										<TouchableOpacity
											onPress={handleMarkWatched}
											disabled={isPending}
											style={[
												styles.primaryButton,
												{ flex: 1, opacity: isPending ? 0.7 : 1 },
											]}
											activeOpacity={0.8}
										>
											<LinearGradient
												colors={[
													movieColors.primary || "#F59E0B",
													movieColors.secondary || "#D97706",
												]}
												start={{ x: 0, y: 0 }}
												end={{ x: 1, y: 1 }}
												style={styles.gradientButton}
											>
												{isPending ? (
													<View style={styles.buttonContent}>
														<ActivityIndicator color="#f9fafb" />
														<Text style={styles.buttonText}>Loading</Text>
													</View>
												) : (
													<View style={styles.buttonContent}>
														<Ionicons name="add" size={20} color="#1f2937" />
														<Text style={styles.buttonText}>Add to Shelf</Text>
													</View>
												)}
											</LinearGradient>
										</TouchableOpacity>

										<TouchableOpacity
											onPress={_openDateModal}
											style={styles.calendarButton}
											activeOpacity={0.8}
										>
											<Ionicons
												name="calendar-outline"
												size={22}
												color="#9ca3af"
											/>
										</TouchableOpacity>
									</View>

									<TouchableOpacity
										onPress={() => setShowAddToListModal(true)}
										style={[
											styles.secondaryButton,
											isInAnyList && {
												backgroundColor: `${movieColors.primary}20`,
												borderColor: movieColors.primary,
											},
										]}
										activeOpacity={0.8}
									>
										<View style={styles.buttonContent}>
											<Ionicons
												name={isInAnyList ? "checkmark" : "list-outline"}
												size={18}
												color={isInAnyList ? movieColors.primary : "#9ca3af"}
											/>
											<Text
												style={[
													styles.secondaryButtonText,
													isInAnyList && { color: movieColors.primary },
												]}
											>
												{isInAnyList
													? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
													: "Add to List"}
											</Text>
										</View>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={handleShare}
										style={styles.secondaryButton}
										activeOpacity={0.8}
									>
										<View style={styles.buttonContent}>
											<Ionicons
												name="share-outline"
												size={18}
												color="#9ca3af"
											/>
											<Text style={styles.secondaryButtonText}>Share</Text>
										</View>
									</TouchableOpacity>
								</>
							) : (
								<>
									<View style={styles.primaryButtonRow}>
										<TouchableOpacity
											onPress={handleMarkWatched}
											disabled={isPending}
											style={[
												styles.primaryButton,
												{ flex: 1, opacity: isPending ? 0.7 : 1 },
											]}
											activeOpacity={0.8}
										>
											<LinearGradient
												colors={[
													movieColors.primary || "#F59E0B",
													movieColors.secondary || "#D97706",
												]}
												start={{ x: 0, y: 0 }}
												end={{ x: 1, y: 1 }}
												style={styles.gradientButton}
											>
												{isPending ? (
													<View style={styles.buttonContent}>
														<ActivityIndicator color="#f9fafb" />
														<Text style={styles.buttonText}>Loading</Text>
													</View>
												) : (
													<View style={styles.buttonContent}>
														<Ionicons
															name="refresh"
															size={20}
															color="#1f2937"
														/>
														<Text style={styles.buttonText}>Watch Now</Text>
													</View>
												)}
											</LinearGradient>
										</TouchableOpacity>

										<TouchableOpacity
											onPress={_openDateModal}
											style={styles.calendarButton}
											activeOpacity={0.8}
										>
											<Ionicons
												name="calendar-outline"
												size={22}
												color="#9ca3af"
											/>
										</TouchableOpacity>
									</View>

									<TouchableOpacity
										onPress={() => setShowAddToListModal(true)}
										style={[
											styles.secondaryButton,
											isInAnyList && {
												backgroundColor: `${movieColors.primary}20`,
												borderColor: movieColors.primary,
											},
										]}
										activeOpacity={0.8}
									>
										<View style={styles.buttonContent}>
											<Ionicons
												name={isInAnyList ? "checkmark" : "list-outline"}
												size={18}
												color={isInAnyList ? movieColors.primary : "#9ca3af"}
											/>
											<Text
												style={[
													styles.secondaryButtonText,
													isInAnyList && { color: movieColors.primary },
												]}
											>
												{isInAnyList
													? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
													: "Add to List"}
											</Text>
										</View>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={handleShare}
										style={styles.secondaryButton}
										activeOpacity={0.8}
									>
										<View style={styles.buttonContent}>
											<Ionicons
												name="share-outline"
												size={18}
												color="#9ca3af"
											/>
											<Text style={styles.secondaryButtonText}>Share</Text>
										</View>
									</TouchableOpacity>
								</>
							)
						) : (
							<TouchableOpacity
								onPress={() => router.push("/login")}
								style={styles.primaryButton}
								activeOpacity={0.8}
							>
								<LinearGradient
									colors={[
										movieColors.primary || "#F59E0B",
										movieColors.secondary || "#D97706",
									]}
									start={{ x: 0, y: 0 }}
									end={{ x: 1, y: 1 }}
									style={styles.gradientButton}
								>
									<Text style={styles.buttonText}>Sign in to Track</Text>
								</LinearGradient>
							</TouchableOpacity>
						)}
					</View>

					{isWatched && (
						<View style={styles.watchedCard}>
							<View style={styles.watchedHeader}>
								<Ionicons name="checkmark-circle" size={20} color="#22c55e" />
								<Text style={styles.watchedText}>On Your Shelf</Text>
							</View>
							{formattedWatchedDate && (
								<View style={styles.watchedDateRow}>
									<Text style={styles.watchedDateText}>
										Watched on {formattedWatchedDate}
									</Text>
									{watchHistory && watchHistory.length > 1 && (
										<Badge variant="secondary">
											{watchHistory.length} watches
										</Badge>
									)}
								</View>
							)}
							{watchHistory && watchHistory.length > 1 && (
								<TouchableOpacity
									onPress={() => setShowHistoryModal(true)}
									style={styles.viewHistoryRow}
									activeOpacity={0.7}
								>
									<Ionicons name="eye" size={16} color="#9ca3af" />
									<Text style={styles.viewHistoryText}>View all watches</Text>
								</TouchableOpacity>
							)}
							{watchHistory && watchHistory.length === 1 && (
								<TouchableOpacity
									onPress={handleUnmarkWatched}
									disabled={unmarkMutation.isPending}
									style={styles.removeRow}
									activeOpacity={0.7}
								>
									{unmarkMutation.isPending ? (
										<View style={styles.removeRowContent}>
											<ActivityIndicator size="small" color="#ef4444" />
											<Text style={styles.removeText}>Loading</Text>
										</View>
									) : (
										<>
											<Ionicons
												name="trash-outline"
												size={16}
												color="#ef4444"
											/>
											<Text style={styles.removeText}>Remove from shelf</Text>
										</>
									)}
								</TouchableOpacity>
							)}
						</View>
					)}

					{movie?.overview && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: movieColors.primary }]}
							>
								Overview
							</Text>
							<Text style={styles.overview}>{movie.overview}</Text>
						</View>
					)}

					<View style={styles.infoGrid}>
						{movie?.release_date && (
							<View style={styles.infoCard}>
								<Text style={styles.infoLabel}>Release Date</Text>
								<Text style={[styles.infoValue, { color: movieColors.accent }]}>
									{new Date(movie.release_date).toLocaleDateString("en-US", {
										year: "numeric",
										month: "short",
										day: "numeric",
									})}
								</Text>
							</View>
						)}
						{movie?.runtime && (
							<TouchableOpacity
								onPress={() => setShowHours(!showHours)}
								style={styles.infoCard}
								activeOpacity={0.8}
							>
								<Text style={styles.infoLabel}>Runtime</Text>
								<Text style={[styles.infoValue, { color: movieColors.accent }]}>
									{formatRuntime(movie.runtime, showHours)}
								</Text>
							</TouchableOpacity>
						)}
						{movie?.vote_average !== undefined && (
							<View style={styles.infoCard}>
								<Text style={styles.infoLabel}>Rating</Text>
								<Text style={[styles.infoValue, { color: movieColors.accent }]}>
									{movie.vote_average.toFixed(1)}/10
								</Text>
							</View>
						)}
						{movie?.vote_count !== undefined && (
							<View style={styles.infoCard}>
								<Text style={styles.infoLabel}>Votes</Text>
								<Text style={[styles.infoValue, { color: movieColors.accent }]}>
									{movie.vote_count.toLocaleString()}
								</Text>
							</View>
						)}
					</View>

					{movie?.genres && movie.genres.length > 0 && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: movieColors.primary }]}
							>
								Genres
							</Text>
							<View style={styles.genresContainer}>
								{movie.genres.map((genre) => (
									<View
										key={genre.id}
										style={[
											styles.genreBadge,
											{
												backgroundColor: `${movieColors.primary}20`,
												borderColor: `${movieColors.primary}40`,
											},
										]}
									>
										<Text
											style={[styles.genreText, { color: movieColors.accent }]}
										>
											{genre.name}
										</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{movie?.credits?.cast && movie.credits.cast.length > 0 && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: movieColors.primary }]}
							>
								Cast
							</Text>
							<View style={styles.castContainer}>
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerStyle={styles.castScrollContent}
								>
									{movie.credits.cast.map((person: TmdbCastDto) => (
										<TouchableOpacity
											key={person.id}
											style={styles.castCard}
											activeOpacity={0.8}
										>
											<View style={styles.castImageContainer}>
												{person.profile_path ? (
													<Image
														source={{
															uri: `https://image.tmdb.org/t/p/w185${person.profile_path}`,
														}}
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
											{person.character && (
												<Text
													style={[
														styles.castCharacter,
														{ color: movieColors.muted },
													]}
												>
													as {person.character}
												</Text>
											)}
										</TouchableOpacity>
									))}
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

					{movie?.credits?.crew && movie.credits.crew.length > 0 && (
						<View style={styles.section}>
							<Text
								style={[styles.sectionTitle, { color: movieColors.primary }]}
							>
								Crew
							</Text>
							<View style={styles.crewGrid}>
								{movie.credits.crew.map((person: TmdbCrewDto) => (
									<TouchableOpacity
										key={`${person.id}-${person.job}`}
										style={styles.crewCard}
										activeOpacity={0.8}
									>
										<Text style={styles.crewName} numberOfLines={1}>
											{person.name}
										</Text>
										<Text
											style={[styles.crewJob, { color: movieColors.muted }]}
										>
											{person.job}
										</Text>
									</TouchableOpacity>
								))}
							</View>
						</View>
					)}
				</View>
			</ScrollView>

			<Modal
				visible={showDateModal}
				animationType="fade"
				transparent={true}
				onRequestClose={() => setShowDateModal(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>Watch movie</Text>
							<Pressable onPress={() => setShowDateModal(false)}>
								<Ionicons name="close" size={24} color={colors.onSurface} />
							</Pressable>
						</View>
						<Text style={styles.modalDescription}>
							When did you watch this?
						</Text>

						<View style={styles.dateTimeContainer}>
							<TouchableOpacity
								onPress={() => setShowDatePicker(true)}
								style={styles.dateTimeButton}
								activeOpacity={0.7}
							>
								<Ionicons
									name="calendar-outline"
									size={20}
									color={colors.onSurfaceVariant}
								/>
								<Text style={styles.dateTimeText}>
									{customDate.toLocaleDateString("en-US", {
										year: "numeric",
										month: "short",
										day: "numeric",
									})}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() => setShowTimePicker(true)}
								style={styles.dateTimeButton}
								activeOpacity={0.7}
							>
								<Ionicons
									name="time-outline"
									size={20}
									color={colors.onSurfaceVariant}
								/>
								<Text style={styles.dateTimeText}>
									{customDate.toLocaleTimeString("en-US", {
										hour: "2-digit",
										minute: "2-digit",
										hour12: !is24Hour,
									})}
								</Text>
							</TouchableOpacity>
						</View>

						<DatePickerModal
							visible={showDatePicker}
							mode="single"
							date={customDate}
							locale="en"
							onDismiss={() => setShowDatePicker(false)}
							onConfirm={(params) => {
								setShowDatePicker(false);
								if (params.date) {
									const newDate = new Date(customDate);
									newDate.setFullYear(params.date.getFullYear());
									newDate.setMonth(params.date.getMonth());
									newDate.setDate(params.date.getDate());
									setCustomDate(newDate);
									setShowTimePicker(true);
								}
							}}
						/>
						<TimePickerModal
							visible={showTimePicker}
							hours={customDate.getHours()}
							minutes={customDate.getMinutes()}
							locale="en"
							use24HourClock={is24Hour}
							onDismiss={() => setShowTimePicker(false)}
							onConfirm={(params) => {
								const newDate = new Date(customDate);
								newDate.setHours(params.hours);
								newDate.setMinutes(params.minutes);
								setCustomDate(newDate);
								setShowTimePicker(false);
							}}
						/>

						<View style={styles.modalActionsSplit}>
							<Button
								variant="outlined"
								onPress={() => setShowDateModal(false)}
							>
								<Text style={styles.secondaryButtonText}>Cancel</Text>
							</Button>
							<Button
								onPress={handleMarkWatchedWithDate}
								isLoading={markMutation.isPending}
								style={{ backgroundColor: colors.primary }}
							>
								<Text style={styles.buttonText}>Add Watch</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>

			<Modal
				visible={showHistoryModal}
				animationType="fade"
				transparent={true}
				onRequestClose={() => setShowHistoryModal(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<View style={styles.modalHeader}>
							<View style={styles.modalTitleContainer}>
								<Ionicons name="time" size={20} color={colors.primary} />
								<Text style={styles.modalTitle}>Watch History</Text>
							</View>
							<Pressable onPress={() => setShowHistoryModal(false)}>
								<Ionicons name="close" size={24} color={colors.onSurface} />
							</Pressable>
						</View>
						<Text style={styles.modalDescription}>
							All the times you&apos;ve watched {movie?.title}
						</Text>

						<ScrollView style={styles.historyList}>
							{watchHistory && watchHistory.length > 0 ? (
								watchHistory.map((watch) => (
									<View key={watch.id} style={styles.historyItem}>
										<Text style={styles.historyDate}>
											{formatWatchDate(
												watch.watchedDate,
												userTimezone,
												is24Hour,
											)}
										</Text>
										<TouchableOpacity
											onPress={() => handleDeleteWatchEntry(watch.id)}
											disabled={deleteWatchEntryMutation.isPending}
											style={styles.historyDeleteButton}
											activeOpacity={0.7}
										>
											{deleteWatchEntryMutation.isPending &&
											deleteWatchEntryMutation.variables?.path
												?.trackedMovieId === watch.id ? (
												<ActivityIndicator
													size="small"
													color={colors.onSurfaceVariant}
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
								<Text style={styles.emptyHistory}>No watch history found</Text>
							)}
						</ScrollView>

						<Button
							variant="outlined"
							onPress={() => setShowHistoryModal(false)}
						>
							<Text style={styles.secondaryButtonText}>Close</Text>
						</Button>
					</View>
				</View>
			</Modal>

			<AddToListModal
				visible={showAddToListModal}
				onClose={() => setShowAddToListModal(false)}
				mediaType="movie"
				mediaId={movieId}
				mediaTitle={movie?.title || title || ""}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: staticColors.background,
	},
	scrollContent: {
		paddingBottom: 32,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	heroWrapper: {
		height: 256,
		position: "relative",
	},
	backdrop: {
		width: "100%",
		height: "100%",
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
		bottom: -64,
		left: 16,
		right: 16,
		flexDirection: "row",
		alignItems: "flex-end",
	},
	posterWrapper: {
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		shadowColor: staticColors.primary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 8,
	},
	poster: {
		width: 112,
		height: 160,
	},
	noPoster: {
		backgroundColor: "#111827",
		justifyContent: "center",
		alignItems: "center",
	},
	noPosterText: {
		color: "#4b5563",
		fontSize: 12,
	},
	titleWrapper: {
		marginLeft: 16,
		marginBottom: 16,
		flex: 1,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#f9fafb",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 8,
	},
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 8,
		gap: 12,
	},
	metaItem: {
		flexDirection: "row",
		alignItems: "center",
	},
	metaText: {
		fontSize: 14,
		color: "#9ca3af",
		marginLeft: 4,
	},
	content: {
		marginTop: 80,
		paddingHorizontal: 16,
	},
	actionsContainer: {
		gap: 12,
		marginBottom: 24,
	},
	primaryButtonRow: {
		flexDirection: "row",
		gap: 12,
		alignItems: "stretch",
	},
	primaryButton: {
		borderRadius: 12,
		overflow: "hidden",
	},
	calendarButton: {
		borderRadius: 12,
		paddingVertical: 16,
		paddingHorizontal: 16,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#374151",
	},
	gradientButton: {
		paddingVertical: 16,
		paddingHorizontal: 24,
		alignItems: "center",
		justifyContent: "center",
	},
	secondaryButton: {
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 24,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#374151",
	},

	buttonContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	buttonText: {
		color: "#1f2937",
		fontSize: 18,
		fontWeight: "600",
	},
	secondaryButtonText: {
		color: "#9ca3af",
		fontSize: 16,
		fontWeight: "500",
	},

	watchedCard: {
		backgroundColor: "rgba(17, 24, 39, 0.5)",
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#1f2937",
		padding: 16,
		marginBottom: 24,
	},
	watchedHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	watchedText: {
		color: "#22c55e",
		fontSize: 16,
		fontWeight: "600",
		marginLeft: 8,
	},
	watchedDateRow: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 8,
	},
	watchedDateText: {
		fontSize: 14,
		color: "#9ca3af",
	},
	viewHistoryRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 12,
	},
	viewHistoryText: {
		fontSize: 14,
		color: "#9ca3af",
		marginLeft: 8,
	},
	removeRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 12,
	},
	removeRowContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	removeText: {
		fontSize: 14,
		color: "#ef4444",
		marginLeft: 8,
	},
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: "600",
		marginBottom: 12,
	},
	overview: {
		fontSize: 16,
		color: "#d1d5db",
		lineHeight: 24,
	},
	infoGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
		marginBottom: 24,
	},
	infoCard: {
		backgroundColor: "#111827",
		borderRadius: 8,
		padding: 12,
		flex: 1,
		minWidth: "45%",
	},
	infoLabel: {
		fontSize: 12,
		color: "#6b7280",
		marginBottom: 4,
	},
	infoValue: {
		fontSize: 16,
		fontWeight: "600",
	},
	genresContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	genreBadge: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: borderRadius.full,
		borderWidth: 1,
	},
	genreText: {
		fontSize: 14,
		fontWeight: "500",
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		padding: 16,
	},
	modalContent: {
		backgroundColor: staticColors.card,
		borderRadius: 16,
		padding: 16,
		gap: 12,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	modalTitleContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: staticColors.text,
	},
	modalDescription: {
		fontSize: 14,
		color: "#9ca3af",
	},
	dateTimeContainer: {
		gap: 12,
	},
	dateTimeButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		padding: 16,
		backgroundColor: "#111827",
		borderRadius: 12,
	},
	dateTimeText: {
		fontSize: 16,
		color: "#f9fafb",
	},
	modalActions: {
		flexDirection: "row",
		gap: 12,
		marginTop: 8,
	},
	modalActionsSplit: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 12,
		marginTop: 8,
	},
	historyList: {
		maxHeight: 300,
	},
	historyItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 12,
		backgroundColor: "#1f2937",
		borderRadius: 8,
		marginBottom: 8,
	},
	historyDate: {
		fontSize: 14,
		color: staticColors.text,
		fontWeight: "500",
	},
	historyDeleteButton: {
		padding: 8,
	},
	emptyHistory: {
		textAlign: "center",
		color: "#6b7280",
		padding: 32,
	},
	castContainer: {
		position: "relative",
	},
	castScrollContent: {
		paddingRight: 16,
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
		gap: 8,
	},
	crewCard: {
		backgroundColor: "#111827",
		borderRadius: borderRadius.md,
		padding: 12,
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
});
