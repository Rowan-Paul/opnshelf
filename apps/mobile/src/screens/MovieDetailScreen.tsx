import {
	authControllerMeOptions,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetMovieWatchHistory,
	type TmdbMovieDetailDto,
	type TrackedMovieDto,
	type WatchHistoryItemDto,
} from '@opnshelf/api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
	Image,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
	ActivityIndicator,
	useWindowDimensions,
	TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DatePicker from 'react-native-date-picker';
import type { RootStackParamList } from '../navigation/types';
import { useIsLandscape } from '../utils';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogClose,
	DialogScrollContent,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type MovieDetailScreenProps = NativeStackScreenProps<
	RootStackParamList,
	'MovieDetail'
>;

export function MovieDetailScreen({
	navigation,
	route,
}: MovieDetailScreenProps) {
	const { movieId, title } = route.params;
	const queryClient = useQueryClient();
	const [showHours, setShowHours] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);
	const [customDate, setCustomDate] = useState<Date | null>(null);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [showHistoryDialog, setShowHistoryDialog] = useState(false);
	const isLandscape = useIsLandscape();
	const backdropHeight = isLandscape ? 'h-80' : 'h-64';

	const formatRuntime = (minutes: number, useHours: boolean) => {
		if (!useHours) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (mins === 0) return `${hours} hours`;
		return `${hours}h ${mins}m`;
	};

	// Fetch auth state
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	// Fetch movie details
	const { data: movieData, isLoading: isMovieLoading } = useQuery({
		...moviesControllerGetMovieDetailsOptions({
			path: { movieId },
		}),
	});

	const movie = movieData as TmdbMovieDetailDto | undefined;

	// Use server-provided colors with fallbacks
	const colors = movie?.colors || {
		primary: '#8b5cf6',
		secondary: '#6366f1',
		accent: '#a855f7',
		muted: '#4c1d95',
	};

	// Fetch user's tracked movies
	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || '' },
		}),
		enabled: !!user?.did,
	});

	// Fetch watch history for this movie
	const { data: watchHistory } = useQuery<WatchHistoryItemDto[]>({
		queryKey: ['watchHistory', user?.did, movieId],
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
		return trackedMovies.some((tm: TrackedMovieDto) => tm.movieId === movieId);
	}, [trackedMovies, movieId]);

	// Find the tracked movie entry to get watched date
	const trackedMovie = useMemo(() => {
		if (!trackedMovies) return null;
		return (
			trackedMovies.find((tm: TrackedMovieDto) => tm.movieId === movieId) || null
		);
	}, [trackedMovies, movieId]);

	// Format the watched date with time (24-hour notation)
	const formattedWatchedDate = useMemo(() => {
		if (!trackedMovie?.watchedDate) return null;
		return new Date(trackedMovie.watchedDate).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
	}, [trackedMovie]);

	// Format watch history dates (24-hour notation)
	const formatWatchDate = (dateString: string) => {
		return new Date(dateString).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
	};

	// Mutation for marking as watched
	const markMutation = useMutation({
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || '' },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ['watchHistory', user?.did, movieId],
			});
			setShowDateModal(false);
			setCustomDate(null);
		},
	});

	// Delete individual watch history entry
	const deleteWatchEntryMutation = useMutation({
		...moviesControllerDeleteWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || '' },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ['watchHistory', user?.did, movieId],
			});
		},
	});

	// Unmark movie as watched (remove entirely or latest)
	const unmarkMutation = useMutation({
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || '' },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ['watchHistory', user?.did, movieId],
			});
		},
	});

	const handleMarkWatchedNow = () => {
		if (!user) {
			navigation.navigate('Login', {});
			return;
		}
		
		markMutation.mutate({
			body: { movieId },
		});
	};

	const handleMarkWatchedWithDate = () => {
		if (!user) {
			navigation.navigate('Login', {});
			return;
		}
		
		markMutation.mutate({
			body: {
				movieId,
				watchedAt: customDate ? customDate.toISOString() : undefined,
			},
		});
	};

	const handleUnmarkWatched = () => {
		unmarkMutation.mutate({
			path: { movieId },
			query: { mode: 'all' },
		});
	};

	const openDateModal = () => {
		setCustomDate(new Date());
		setShowDateModal(true);
	};

	const isPending =
		markMutation.isPending && markMutation.variables?.body?.movieId === movieId;

	const releaseYear = movie?.release_date
		? new Date(movie.release_date).getFullYear()
		: null;

	const backdropUrl = movie?.backdrop_path
		? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
		: null;

	const posterUrl = movie?.poster_path
		? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
		: null;

	if (isMovieLoading) {
		return (
			<View
				className="flex-1 justify-center items-center"
				style={{ backgroundColor: '#030712' }}
			>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		);
	}

	return (
		<>
			<ScrollView
				className="flex-1 bg-gray-950"
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				{/* Header with Backdrop */}
				<View className="relative">
					{/* Backdrop Image */}
					{backdropUrl ? (
						<Image
							source={{ uri: backdropUrl }}
							className={`w-full ${backdropHeight}`}
							resizeMode="cover"
						/>
					) : (
						<View
							className={`w-full ${backdropHeight}`}
							style={{
								backgroundColor: colors.muted,
							}}
						/>
					)}

					{/* Back Button */}
					<TouchableOpacity
						onPress={() => navigation.goBack()}
						className="absolute top-12 left-4 p-2 rounded-full bg-black/50"
						activeOpacity={0.8}
					>
						<Ionicons name="arrow-back" size={24} color="#f9fafb" />
					</TouchableOpacity>

					{/* Poster and Title */}
					<View className="absolute -bottom-16 left-4 flex-row items-end">
						{/* Poster */}
						<View
							className="rounded-lg overflow-hidden shadow-lg"
							style={{
								shadowColor: colors.primary,
								shadowOffset: { width: 0, height: 4 },
								shadowOpacity: 0.4,
								shadowRadius: 8,
								elevation: 8,
							}}
						>
							{posterUrl ? (
								<Image
									source={{ uri: posterUrl }}
									className="w-28 h-40"
									resizeMode="cover"
								/>
							) : (
								<View className="w-28 h-40 bg-gray-900 justify-center items-center">
									<Text className="text-gray-600 text-xs">No poster</Text>
								</View>
							)}
						</View>

						{/* Title */}
						<View className="ml-4 mb-4 flex-1">
							<Text
								className="text-2xl font-bold text-gray-50"
								style={{ textShadowColor: colors.primary, textShadowRadius: 8 }}
								numberOfLines={2}
							>
								{movie?.title || title}
							</Text>
							<View className="flex-row items-center mt-2" style={{ gap: 12 }}>
								{!!releaseYear && (
									<View className="flex-row items-center">
										<Ionicons
											name="calendar-outline"
											size={14}
											color={colors.accent}
										/>
										<Text className="text-gray-400 text-sm ml-1">
											{releaseYear}
										</Text>
									</View>
								)}
								{movie?.runtime && (
									<View className="flex-row items-center">
										<Ionicons
											name="time-outline"
											size={14}
											color={colors.accent}
										/>
										<Text className="text-gray-400 text-sm ml-1">
											{movie.runtime} min
										</Text>
									</View>
								)}
							</View>
						</View>
					</View>
				</View>

				{/* Main Content */}
				<View className="mt-20 px-4">
					{/* Action Buttons */}
					<View className="mb-6" style={{ gap: 12 }}>
						{user ? (
							isWatched ? (
								<>
									{/* Watch Now Button */}
									<TouchableOpacity
										onPress={handleMarkWatchedNow}
										disabled={isPending}
										activeOpacity={0.8}
										className="rounded-xl py-4 px-6 items-center justify-center"
										style={{
											backgroundColor: colors.primary,
											opacity: isPending ? 0.7 : 1,
										}}
									>
										{isPending ? (
											<ActivityIndicator color="#f9fafb" />
										) : (
											<View className="flex-row items-center">
												<Ionicons name="refresh" size={20} color="#f9fafb" />
												<Text className="text-white font-semibold text-lg ml-2">
													Watch Now
												</Text>
											</View>
										)}
									</TouchableOpacity>

									{/* Watch on Different Date Button */}
									<TouchableOpacity
										onPress={openDateModal}
										activeOpacity={0.8}
										className="rounded-xl py-3 px-6 items-center justify-center border border-gray-700"
									>
										<View className="flex-row items-center">
											<Ionicons name="calendar" size={18} color="#9ca3af" />
											<Text className="text-gray-400 font-medium ml-2">
												Watch on Different Date
											</Text>
										</View>
									</TouchableOpacity>
								</>
							) : (
								<>
									{/* Watch Now Button */}
									<TouchableOpacity
										onPress={handleMarkWatchedNow}
										disabled={isPending}
										activeOpacity={0.8}
										className="rounded-xl py-4 px-6 items-center justify-center"
										style={{
											backgroundColor: colors.primary,
											opacity: isPending ? 0.7 : 1,
										}}
									>
										{isPending ? (
											<ActivityIndicator color="#f9fafb" />
										) : (
											<View className="flex-row items-center">
												<Ionicons name="add" size={20} color="#f9fafb" />
											<Text className="text-white font-semibold text-lg ml-2">
												Add to Shelf
											</Text>
											</View>
										)}
									</TouchableOpacity>

									{/* Watch on Different Date Button */}
									<TouchableOpacity
										onPress={openDateModal}
										activeOpacity={0.8}
										className="rounded-xl py-3 px-6 items-center justify-center border border-gray-700"
									>
										<View className="flex-row items-center">
											<Ionicons name="calendar" size={18} color="#9ca3af" />
											<Text className="text-gray-400 font-medium ml-2">
												Add on Different Date
											</Text>
										</View>
									</TouchableOpacity>
								</>
							)
						) : (
							<TouchableOpacity
								onPress={() => navigation.navigate('Login', {})}
								activeOpacity={0.8}
								className="rounded-xl py-4 px-6 items-center justify-center"
								style={{ backgroundColor: colors.primary }}
							>
								<Text className="text-white font-semibold text-lg">
									Sign in to Track
								</Text>
							</TouchableOpacity>
						)}
					</View>

					{/* Watched Status Info */}
					{isWatched && (
						<View className="mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
							<View className="flex-row items-center mb-2">
								<Ionicons name="checkmark-circle" size={20} color="#22c55e" />
								<Text className="text-green-500 font-semibold ml-2">
									On Your Shelf
								</Text>
							</View>
							{formattedWatchedDate && (
								<View className="flex-row items-center">
									<Text className="text-sm text-gray-400">
										Watched on {formattedWatchedDate}
									</Text>
									{watchHistory && watchHistory.length > 1 && (
										<View className="ml-2">
											<Badge variant="secondary">
												{watchHistory.length} watches
											</Badge>
										</View>
									)}
								</View>
							)}
							{watchHistory && watchHistory.length > 1 && (
								<TouchableOpacity
									onPress={() => setShowHistoryDialog(true)}
									className="mt-3 flex-row items-center"
									activeOpacity={0.7}
								>
									<Ionicons name="eye" size={16} color="#9ca3af" />
									<Text className="text-sm text-gray-400 ml-2">
										View all watches
									</Text>
								</TouchableOpacity>
							)}

							{/* Remove button when only watched once */}
							{watchHistory && watchHistory.length === 1 && (
								<TouchableOpacity
									onPress={handleUnmarkWatched}
									disabled={unmarkMutation.isPending}
									className="mt-3 flex-row items-center"
									activeOpacity={0.7}
								>
									{unmarkMutation.isPending ? (
										<ActivityIndicator size="small" color="#ef4444" />
									) : (
										<>
											<Ionicons name="trash-outline" size={16} color="#ef4444" />
											<Text className="text-sm text-red-400 ml-2">
												Remove from shelf
											</Text>
										</>
									)}
								</TouchableOpacity>
							)}
						</View>
					)}

					{/* Overview */}
					{movie?.overview && (
						<View className="mb-6">
							<Text
								className="text-xl font-semibold mb-2"
								style={{ color: colors.primary }}
							>
								Overview
							</Text>
							<Text className="text-gray-300 text-base leading-relaxed">
								{movie.overview}
							</Text>
						</View>
					)}

					{/* Info Grid */}
					<View className="flex-row flex-wrap gap-3 mb-6">
						{movie?.release_date && (
							<View
								className="bg-gray-900 rounded-lg p-3"
								style={{ flex: 1, minWidth: '45%' }}
							>
								<Text className="text-gray-500 text-xs mb-1">Release Date</Text>
								<Text style={{ color: colors.accent }} className="font-medium">
									{new Date(movie.release_date).toLocaleDateString('en-US', {
										year: 'numeric',
										month: 'short',
										day: 'numeric',
									})}
								</Text>
							</View>
						)}

						{movie?.runtime && (
							<TouchableOpacity
								onPress={() => setShowHours(!showHours)}
								activeOpacity={0.8}
								className="bg-gray-900 rounded-lg p-3"
								style={{ flex: 1, minWidth: '45%' }}
							>
								<Text className="text-gray-500 text-xs mb-1">Runtime</Text>
								<Text style={{ color: colors.accent }} className="font-medium">
									{formatRuntime(movie.runtime, showHours)}
								</Text>
							</TouchableOpacity>
						)}

						{movie?.vote_average !== undefined && (
							<View
								className="bg-gray-900 rounded-lg p-3"
								style={{ flex: 1, minWidth: '45%' }}
							>
								<Text className="text-gray-500 text-xs mb-1">Rating</Text>
								<Text style={{ color: colors.accent }} className="font-medium">
									{movie.vote_average.toFixed(1)}/10
								</Text>
							</View>
						)}

						{movie?.vote_count !== undefined && (
							<View
								className="bg-gray-900 rounded-lg p-3"
								style={{ flex: 1, minWidth: '45%' }}
							>
								<Text className="text-gray-500 text-xs mb-1">Votes</Text>
								<Text style={{ color: colors.accent }} className="font-medium">
									{movie.vote_count.toLocaleString()}
								</Text>
							</View>
						)}
					</View>

					{/* Genres */}
					{movie?.genres && movie.genres.length > 0 && (
						<View>
							<Text
								className="text-xl font-semibold mb-3"
								style={{ color: colors.primary }}
							>
								Genres
							</Text>
							<View className="flex-row flex-wrap gap-2">
								{movie.genres.map((genre) => (
									<View
										key={genre.id}
										className="px-3 py-2 rounded-full"
										style={{
											backgroundColor: `${colors.primary}20`,
											borderWidth: 1,
											borderColor: `${colors.primary}40`,
										}}
									>
										<Text style={{ color: colors.accent }} className="text-sm">
											{genre.name}
										</Text>
									</View>
								))}
								</View>
							</View>
						)}
					</View>
				</ScrollView>

			{/* Watch History Dialog */}
			<Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
				<DialogContent>
					<DialogClose onPress={() => setShowHistoryDialog(false)} />
					<DialogHeader>
						<DialogTitle className="flex-row items-center gap-2">
							<Ionicons name="time" size={20} color="#a855f7" />
							Watch History
						</DialogTitle>
						<DialogDescription>
							All the times you've watched {movie?.title}
						</DialogDescription>
					</DialogHeader>
					<DialogScrollContent>
						<View style={{ gap: 12 }}>
							{watchHistory && watchHistory.length > 0 ? (
								watchHistory.map((watch) => (
									<View
										key={watch.id}
										className="flex-row items-center gap-3 p-3 rounded-lg bg-gray-800/50"
									>
										<View className="flex-1">
											<Text className="text-sm font-medium text-white">
												{formatWatchDate(watch.watchedDate)}
											</Text>
										</View>
										<TouchableOpacity
											onPress={() =>
												deleteWatchEntryMutation.mutate({
													path: { trackedMovieId: watch.id },
												})
											}
											disabled={deleteWatchEntryMutation.isPending}
											className="p-2 rounded-lg"
											activeOpacity={0.7}
										>
											{deleteWatchEntryMutation.isPending &&
											deleteWatchEntryMutation.variables?.path?.trackedMovieId ===
												watch.id ? (
												<ActivityIndicator size="small" color="#9ca3af" />
											) : (
												<Ionicons name="trash-outline" size={18} color="#ef4444" />
											)}
										</TouchableOpacity>
									</View>
								))
							) : (
								<View className="items-center py-8">
									<Text className="text-gray-500">
										No watch history found
									</Text>
								</View>
							)}
						</View>
					</DialogScrollContent>
					<DialogFooter>
						<Button
							variant="outline"
							onPress={() => setShowHistoryDialog(false)}
						>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Date Picker Modal */}
			<Dialog open={showDateModal} onOpenChange={setShowDateModal}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>When did you watch this?</DialogTitle>
						<DialogDescription>
							Select the date and time you watched {movie?.title}
						</DialogDescription>
					</DialogHeader>
					<View className="py-4" style={{ gap: 16 }}>
						<TouchableOpacity
							onPress={() => setShowDatePicker(true)}
							className="flex-row items-center justify-between p-4 bg-gray-800 rounded-lg"
							activeOpacity={0.7}
						>
							<Text className="text-gray-300">Date & Time</Text>
							<Text className="text-white font-medium">
								{customDate
									? customDate.toLocaleString('en-US', {
											year: 'numeric',
											month: 'short',
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit',
											hour12: false,
									  })
									: 'Select date and time'}
							</Text>
						</TouchableOpacity>
					</View>
					<DialogFooter>
						<Button
							variant="outline"
							onPress={() => setShowDateModal(false)}
						>
							Cancel
						</Button>
						<Button
							onPress={handleMarkWatchedWithDate}
							isLoading={markMutation.isPending}
						>
							Add Watch
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<DatePicker
				modal
				open={showDatePicker}
				date={customDate || new Date()}
				mode="datetime"
				maximumDate={new Date()}
				onConfirm={(date) => {
					setShowDatePicker(false);
					setCustomDate(date);
				}}
				onCancel={() => setShowDatePicker(false)}
			/>
		</>
	);
}
