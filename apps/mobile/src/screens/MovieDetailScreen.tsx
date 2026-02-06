import {
	authControllerMeOptions,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { RootStackParamList } from '../navigation/types';

// Movie colors from server
interface MovieColors {
	primary?: string;
	secondary?: string;
	accent?: string;
	muted?: string;
}

// TMDB Movie Detail type based on API response
interface TMDBMovieDetail {
	id: number;
	title: string;
	poster_path?: string;
	backdrop_path?: string;
	release_date?: string;
	overview?: string;
	runtime?: number;
	vote_average?: number;
	vote_count?: number;
	genres?: Array<{ id: number; name: string }>;
	colors?: MovieColors;
}

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

	const movie = movieData as TMDBMovieDetail | undefined;

	// Use server-provided colors with fallbacks
	const colors = movie?.colors || {
		primary: '#8b5cf6', // Default purple
		secondary: '#6366f1', // Default indigo
		accent: '#a855f7', // Default purple
		muted: '#4c1d95', // Default dark purple
	};

	// Fetch user's tracked movies
	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || '' },
		}),
		enabled: !!user?.did,
	});

	// Check if this movie is in user's watched list
	const isWatched = useMemo(() => {
		if (!trackedMovies) return false;
		return trackedMovies.some((tm) => tm.movieId === movieId);
	}, [trackedMovies, movieId]);

	// Find the tracked movie entry to get watched date
	const trackedMovie = useMemo(() => {
		if (!trackedMovies) return null;
		return trackedMovies.find((tm) => tm.movieId === movieId) || null;
	}, [trackedMovies, movieId]);

	// Format the watched date
	const formattedWatchedDate = useMemo(() => {
		if (!trackedMovie?.watchedDate) return null;
		return new Date(trackedMovie.watchedDate).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}, [trackedMovie]);

	// Mutations for watchlist
	const markMutation = useMutation({
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || '' },
				}),
			});
		},
	});

	const unmarkMutation = useMutation({
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || '' },
				}),
			});
		},
	});

	const handleToggleWatched = () => {
		if (isWatched) {
			unmarkMutation.mutate({ path: { movieId } });
		} else {
			markMutation.mutate({ body: { movieId } });
		}
	};

	const isPending =
		(markMutation.isPending &&
			markMutation.variables?.body?.movieId === movieId) ||
		(unmarkMutation.isPending &&
			unmarkMutation.variables?.path?.movieId === movieId);

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
						className="w-full h-64"
						resizeMode="cover"
					/>
				) : (
					<View
						className="w-full h-64"
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
						{releaseYear && (
							<View className="flex-row items-center mt-2">
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
					</View>
				</View>
			</View>

			{/* Main Content */}
			<View className="mt-20 px-4">
				{/* Action Button */}
				<View className="mb-6">
					{user ? (
						<TouchableOpacity
							onPress={handleToggleWatched}
							disabled={isPending}
							activeOpacity={0.8}
							className="rounded-xl py-4 px-6 items-center justify-center"
							style={{
								backgroundColor: isWatched
									? colors.muted
									: colors.primary,
								opacity: isPending ? 0.7 : 1,
							}}
						>
							{isPending ? (
								<ActivityIndicator color="#f9fafb" />
							) : isWatched ? (
								<View className="items-center">
									<View className="flex-row items-center">
										<Ionicons name="checkmark" size={20} color="#f9fafb" />
										<Text className="text-white font-semibold text-lg ml-2">
											On Your Shelf
										</Text>
									</View>
									{formattedWatchedDate && (
										<Text className="text-gray-300 text-sm mt-1">
											Watched on {formattedWatchedDate}
										</Text>
									)}
								</View>
							) : (
								<View className="flex-row items-center">
									<Ionicons name="add" size={20} color="#f9fafb" />
									<Text className="text-white font-semibold text-lg ml-2">
										Add to Shelf
									</Text>
								</View>
							)}
						</TouchableOpacity>
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
		);
}
