import {
	authControllerMeOptions,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Check, Clock, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePosterColors } from "../hooks/usePosterColors";

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
}

export const Route = createFileRoute("/movies/$movieId/$title")({
	loader: async ({ params, context }) => {
		const { movieId } = params;
		const { queryClient } = context;

		const data = await queryClient.fetchQuery({
			...moviesControllerGetMovieDetailsOptions({
				path: { movieId },
			}),
		});

		return data as TMDBMovieDetail;
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? `${loaderData.title} | OpnShelf`
					: "Movie | OpnShelf",
			},
		],
	}),
	component: MovieDetailPage,
});

function MovieDetailPage() {
	const { movieId } = Route.useParams();
	const queryClient = useQueryClient();
	const [showHours, setShowHours] = useState(false);

	const formatRuntime = (minutes: number, useHours: boolean) => {
		if (!useHours) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (mins === 0) return `${hours} hours`;
		return `${hours} hours ${mins} minutes`;
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

	// Fetch user's tracked movies
	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
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
		return new Date(trackedMovie.watchedDate).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}, [trackedMovie]);

	// Extract accent colors from poster
	const colors = usePosterColors(movie?.poster_path);

	// Mutations for watchlist
	const markMutation = useMutation({
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			toast.success("Added to your shelf");
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
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
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
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

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			{/* Hero Section with Backdrop */}
			<div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
				{backdropUrl ? (
					<>
						<img
							src={backdropUrl}
							alt=""
							className="w-full h-full object-cover"
						/>
						{/* Gradient overlays */}
						<div
							className="absolute inset-0"
							style={{
								background: `linear-gradient(to bottom, transparent 0%, rgba(3, 7, 18, 0.6) 60%, rgb(3, 7, 18) 100%)`,
							}}
						/>
						<div
							className="absolute inset-0"
							style={{
								background: `linear-gradient(to right, rgba(3, 7, 18, 0.8) 0%, transparent 50%)`,
							}}
						/>
					</>
				) : (
					<div
						className="w-full h-full"
						style={{
							background: `linear-gradient(135deg, ${colors.muted} 0%, rgb(3, 7, 18) 100%)`,
						}}
					/>
				)}

				{/* Back button */}
				<Link
					to="/search"
					search={{ q: "" }}
					className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
				>
					<ArrowLeft className="w-5 h-5" />
				</Link>

				{/* Hero Content */}
				<div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
					<div className="container mx-auto max-w-6xl">
						<div className="flex items-end gap-4 md:gap-8">
							{/* Poster */}
							<div className="hidden md:block flex-shrink-0">
								<div
									className="w-48 lg:w-64 rounded-lg overflow-hidden shadow-2xl"
									style={{
										boxShadow: `0 25px 50px -12px ${colors.primary}40`,
									}}
								>
									{posterUrl ? (
										<img
											src={posterUrl}
											alt={movie?.title}
											className="w-full aspect-2/3 object-cover"
										/>
									) : (
										<div className="w-full aspect-2/3 bg-gray-900 flex items-center justify-center">
											<span className="text-gray-600">No poster</span>
										</div>
									)}
								</div>
							</div>

							{/* Title and Meta */}
							<div className="flex-1 pb-2">
								<h1
									className="text-3xl md:text-5xl lg:text-6xl font-bold mb-2"
									style={{
										textShadow: `0 4px 30px ${colors.primary}60`,
									}}
								>
									{movie?.title}
								</h1>
								{releaseYear && (
									<div className="flex items-center gap-4 text-lg text-gray-300">
										<span className="flex items-center gap-2">
											<Calendar
												className="w-4 h-4"
												style={{ color: colors.accent }}
											/>
											{releaseYear}
										</span>
										{movie?.runtime && (
											<button
												type="button"
												onClick={() => setShowHours(!showHours)}
												className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
											>
												<Clock
													className="w-4 h-4"
													style={{ color: colors.accent }}
												/>
												{formatRuntime(movie.runtime, showHours)}
											</button>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="container mx-auto px-4 py-8 max-w-6xl">
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
					{/* Left Column - Poster (mobile) & Actions */}
					<div className="md:hidden">
						<div className="flex gap-4">
							{posterUrl && (
								<div
									className="w-32 flex-shrink-0 rounded-lg overflow-hidden"
									style={{
										boxShadow: `0 20px 40px -10px ${colors.primary}40`,
									}}
								>
									<img
										src={posterUrl}
										alt={movie?.title}
										className="w-full aspect-2/3 object-cover"
									/>
								</div>
							)}
							<div className="flex-1 flex flex-col justify-center">
								{user ? (
									<button
										type="button"
										onClick={handleToggleWatched}
										disabled={isPending}
										className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
										style={{
											background: isWatched
												? `linear-gradient(135deg, ${colors.muted} 0%, ${colors.primary} 100%)`
												: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
											boxShadow: `0 10px 30px -10px ${colors.primary}60`,
										}}
									>
										{isPending ? (
											<Loader2 className="w-5 h-5 animate-spin" />
										) : isWatched ? (
											<div className="flex flex-col items-center">
												<span className="flex items-center gap-2">
													<Check className="w-5 h-5" />
													On Your Shelf
												</span>
												{formattedWatchedDate && (
													<span className="text-xs font-normal opacity-80">
														Watched on {formattedWatchedDate}
													</span>
												)}
											</div>
										) : (
											<>
												<Plus className="w-5 h-5" />
												Add to Shelf
											</>
										)}
									</button>
								) : (
									<Link
										to="/login"
										className="w-full py-3 px-6 rounded-xl font-semibold text-white text-center transition-all duration-200"
										style={{
											background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
											boxShadow: `0 10px 30px -10px ${colors.primary}60`,
										}}
									>
										Sign in to Track
									</Link>
								)}
							</div>
						</div>
					</div>

					{/* Desktop Actions */}
					<div className="hidden md:block space-y-4">
						{user ? (
							<button
								type="button"
								onClick={handleToggleWatched}
								disabled={isPending}
								className="w-full py-4 px-6 rounded-xl font-semibold text-white text-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 hover:scale-[1.02]"
								style={{
									background: isWatched
										? `linear-gradient(135deg, ${colors.muted} 0%, ${colors.primary} 100%)`
										: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
									boxShadow: `0 15px 35px -10px ${colors.primary}60`,
								}}
							>
								{isPending ? (
									<Loader2 className="w-5 h-5 animate-spin" />
								) : isWatched ? (
									<div className="flex flex-col items-center">
										<span className="flex items-center gap-2">
											<Check className="w-5 h-5" />
											On Your Shelf
										</span>
										{formattedWatchedDate && (
											<span className="text-sm font-normal opacity-80">
												Watched on {formattedWatchedDate}
											</span>
										)}
									</div>
								) : (
									<>
										<Plus className="w-5 h-5" />
										Add to Shelf
									</>
								)}
							</button>
						) : (
							<Link
								to="/login"
								className="w-full py-4 px-6 rounded-xl font-semibold text-white text-lg text-center transition-all duration-200 block hover:scale-[1.02]"
								style={{
									background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
									boxShadow: `0 15px 35px -10px ${colors.primary}60`,
								}}
							>
								Sign in to Track
							</Link>
						)}

						{/* Color preview (subtle) */}
						<div className="pt-4 border-t border-gray-800">
							<div className="flex gap-2">
								<div
									className="w-8 h-8 rounded-full"
									style={{ backgroundColor: colors.primary }}
									title="Primary"
								/>
								<div
									className="w-8 h-8 rounded-full"
									style={{ backgroundColor: colors.secondary }}
									title="Secondary"
								/>
								<div
									className="w-8 h-8 rounded-full"
									style={{ backgroundColor: colors.accent }}
									title="Accent"
								/>
							</div>
						</div>
					</div>

					{/* Right Column - Details */}
					<div className="space-y-6">
						{/* Overview */}
						<section>
							<h2
								className="text-xl font-semibold mb-3"
								style={{ color: colors.primary }}
							>
								Overview
							</h2>
							<p className="text-gray-300 leading-relaxed text-lg">
								{movie?.overview || "No overview available."}
							</p>
						</section>

						{/* Additional Info */}
						<section className="grid grid-cols-2 gap-4">
							{movie?.release_date && (
								<div className="p-4 rounded-lg bg-gray-900/50">
									<span className="text-gray-500 text-sm block mb-1">
										Release Date
									</span>
									<span
										className="font-medium"
										style={{ color: colors.accent }}
									>
										{new Date(movie.release_date).toLocaleDateString("en-US", {
											year: "numeric",
											month: "long",
											day: "numeric",
										})}
									</span>
								</div>
							)}
							{movie?.runtime && (
								<button
									type="button"
									onClick={() => setShowHours(!showHours)}
									className="p-4 rounded-lg bg-gray-900/50 text-left cursor-pointer hover:bg-gray-800/50 transition-colors w-full"
								>
									<span className="text-gray-500 text-sm block mb-1">
										Runtime
									</span>
									<span
										className="font-medium"
										style={{ color: colors.accent }}
									>
										{formatRuntime(movie.runtime, showHours)}
									</span>
								</button>
							)}
							{movie?.vote_average && (
								<div className="p-4 rounded-lg bg-gray-900/50">
									<span className="text-gray-500 text-sm block mb-1">
										Rating
									</span>
									<span
										className="font-medium"
										style={{ color: colors.accent }}
									>
										{movie.vote_average.toFixed(1)}/10
									</span>
								</div>
							)}
							{movie?.vote_count && (
								<div className="p-4 rounded-lg bg-gray-900/50">
									<span className="text-gray-500 text-sm block mb-1">
										Votes
									</span>
									<span
										className="font-medium"
										style={{ color: colors.accent }}
									>
										{movie.vote_count.toLocaleString()}
									</span>
								</div>
							)}
						</section>

						{/* Genres */}
						{movie?.genres && movie.genres.length > 0 && (
							<section>
								<h2
									className="text-xl font-semibold mb-3"
									style={{ color: colors.primary }}
								>
									Genres
								</h2>
								<div className="flex flex-wrap gap-2">
									{movie.genres.map((genre) => (
										<span
											key={genre.id}
											className="px-4 py-2 rounded-full text-sm font-medium"
											style={{
												backgroundColor: `${colors.primary}20`,
												color: colors.accent,
												border: `1px solid ${colors.primary}40`,
											}}
										>
											{genre.name}
										</span>
									))}
								</div>
							</section>
						)}
					</div>
				</div>
			</div>

			{/* Loading State */}
			{isMovieLoading && (
				<div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50">
					<div
						className="animate-spin rounded-full h-16 w-16 border-b-2"
						style={{ borderColor: colors.primary }}
					/>
				</div>
			)}
		</div>
	);
}
