import {
	authControllerMeOptions,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	ArrowLeft,
	Calendar,
	Check,
	Clock,
	History,
	Loader2,
	Plus,
	RotateCcw,
	Trash2,
	X,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

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

interface TrackedMovie {
	id: string;
	movieId: string;
	watchedDate?: string;
	watchCount?: number;
	movie: {
		title: string;
		posterPath?: string;
	};
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
	const router = useRouter();
	const dateInputId = useId();
	const timeInputId = useId();
	const [showHours, setShowHours] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);
	const [customDate, setCustomDate] = useState("");
	const [customTime, setCustomTime] = useState("");
	const [showRemoveModal, setShowRemoveModal] = useState(false);

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
		return trackedMovies.some((tm: TrackedMovie) => tm.movieId === movieId);
	}, [trackedMovies, movieId]);

	// Find the tracked movie entry to get watched date and count
	const trackedMovie = useMemo(() => {
		if (!trackedMovies) return null;
		return (
			trackedMovies.find((tm: TrackedMovie) => tm.movieId === movieId) || null
		);
	}, [trackedMovies, movieId]);

	// Format the watched date with time
	const formattedWatchedDate = useMemo(() => {
		if (!trackedMovie?.watchedDate) return null;
		return new Date(trackedMovie.watchedDate).toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	}, [trackedMovie]);

	// Use server-provided colors with fallbacks
	const colors = movie?.colors || {
		primary: "#8b5cf6",
		secondary: "#6366f1",
		accent: "#a855f7",
		muted: "#4c1d95",
	};

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
			setShowDateModal(false);
			setCustomDate("");
			setCustomTime("");
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
			setShowRemoveModal(false);
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const handleMarkWatched = () => {
		markMutation.mutate({ body: { movieId } });
	};

	const handleMarkWatchedWithDate = () => {
		if (!customDate) return;

		const dateTime = customTime
			? `${customDate}T${customTime}`
			: `${customDate}T00:00:00`;

		markMutation.mutate({
			body: {
				movieId,
				watchedAt: dateTime,
			},
		});
	};

	const handleRemoveLatest = () => {
		unmarkMutation.mutate({
			path: { movieId },
			query: { mode: "latest" },
		});
	};

	const handleRemoveAll = () => {
		unmarkMutation.mutate({
			path: { movieId },
			query: { mode: "all" },
		});
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

	// Initialize date/time inputs to current values when modal opens
	const openDateModal = () => {
		const now = new Date();
		setCustomDate(now.toISOString().split("T")[0]);
		setCustomTime(now.toTimeString().slice(0, 5));
		setShowDateModal(true);
	};

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
				<button
					type="button"
					onClick={() => router.history.back()}
					className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors cursor-pointer"
				>
					<ArrowLeft className="w-5 h-5" />
				</button>

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
							<div className="flex-1 flex flex-col gap-2 justify-center">
								{user ? (
									!isWatched ? (
										<button
											type="button"
											onClick={handleMarkWatched}
											disabled={isPending}
											className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
											style={{
												background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
												boxShadow: `0 10px 30px -10px ${colors.primary}60`,
											}}
										>
											{isPending ? (
												<Loader2 className="w-5 h-5 animate-spin" />
											) : (
												<>
													<Plus className="w-5 h-5" />
													Add to Shelf
												</>
											)}
										</button>
									) : (
										<>
											<button
												type="button"
												onClick={openDateModal}
												disabled={isPending}
												className="w-full py-2 px-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 text-sm"
												style={{
													background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
													boxShadow: `0 10px 30px -10px ${colors.primary}60`,
												}}
											>
												<RotateCcw className="w-4 h-4" />
												Watch Again
											</button>
											<button
												type="button"
												onClick={() => setShowRemoveModal(true)}
												className="w-full py-2 px-4 rounded-xl font-medium text-white transition-all duration-200 flex items-center justify-center gap-2 text-sm bg-red-600/80 hover:bg-red-600"
											>
												<Trash2 className="w-4 h-4" />
												Remove
											</button>
										</>
									)
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
						{isWatched && trackedMovie && (
							<div className="mt-4 p-4 rounded-xl bg-gray-900/50">
								<div className="flex items-center gap-2 text-green-400 mb-1">
									<Check className="w-5 h-5" />
									<span className="font-semibold">On Your Shelf</span>
								</div>
								{formattedWatchedDate && (
									<p className="text-sm text-gray-400">
										Watched on {formattedWatchedDate}
										{trackedMovie.watchCount && trackedMovie.watchCount > 1 && (
											<span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded-full">
												{trackedMovie.watchCount} watches
											</span>
										)}
									</p>
								)}
							</div>
						)}
					</div>

					{/* Desktop Actions */}
					<div className="hidden md:block space-y-4">
						{user ? (
							!isWatched ? (
								<button
									type="button"
									onClick={handleMarkWatched}
									disabled={isPending}
									className="w-full py-4 px-6 rounded-xl font-semibold text-white text-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 hover:scale-[1.02]"
									style={{
										background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
										boxShadow: `0 15px 35px -10px ${colors.primary}60`,
									}}
								>
									{isPending ? (
										<Loader2 className="w-5 h-5 animate-spin" />
									) : (
										<>
											<Plus className="w-5 h-5" />
											Add to Shelf
										</>
									)}
								</button>
							) : (
								<div className="space-y-3">
									<div className="p-4 rounded-xl bg-gray-900/50">
										<div className="flex items-center gap-2 text-green-400 mb-2">
											<Check className="w-5 h-5" />
											<span className="font-semibold">On Your Shelf</span>
										</div>
										{formattedWatchedDate && (
											<p className="text-sm text-gray-400">
												Watched on {formattedWatchedDate}
											</p>
										)}
										{trackedMovie?.watchCount &&
											trackedMovie.watchCount > 1 && (
												<div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
													<History className="w-3 h-3" />
													<span>{trackedMovie.watchCount} total watches</span>
												</div>
											)}
									</div>
									<button
										type="button"
										onClick={openDateModal}
										disabled={isPending}
										className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 hover:scale-[1.02]"
										style={{
											background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
											boxShadow: `0 10px 30px -10px ${colors.primary}60`,
										}}
									>
										<RotateCcw className="w-4 h-4" />
										Watch Again
									</button>
									<button
										type="button"
										onClick={() => setShowRemoveModal(true)}
										className="w-full py-3 px-6 rounded-xl font-medium text-white transition-all duration-200 flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-600 hover:scale-[1.02]"
									>
										<Trash2 className="w-4 h-4" />
										Remove from Shelf
									</button>
								</div>
							)
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

			{/* Date Picker Modal */}
			{showDateModal && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
					<div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full">
						<div className="flex justify-between items-center mb-6">
							<h3 className="text-xl font-semibold">Watch Again</h3>
							<button
								type="button"
								onClick={() => setShowDateModal(false)}
								className="p-2 hover:bg-gray-800 rounded-full transition-colors"
							>
								<X className="w-5 h-5" />
							</button>
						</div>
						<p className="text-gray-400 mb-4">When did you watch this movie?</p>
						<div className="space-y-4">
							<div>
								<label
									htmlFor={dateInputId}
									className="block text-sm text-gray-400 mb-2"
								>
									Date
								</label>
								<input
									id={dateInputId}
									type="date"
									value={customDate}
									onChange={(e) => setCustomDate(e.target.value)}
									className="w-full px-4 py-3 bg-gray-800 rounded-xl border border-gray-700 text-white focus:outline-none focus:border-purple-500"
								/>
							</div>
							<div>
								<label
									htmlFor={timeInputId}
									className="block text-sm text-gray-400 mb-2"
								>
									Time (optional)
								</label>
								<input
									id={timeInputId}
									type="time"
									value={customTime}
									onChange={(e) => setCustomTime(e.target.value)}
									className="w-full px-4 py-3 bg-gray-800 rounded-xl border border-gray-700 text-white focus:outline-none focus:border-purple-500"
								/>
							</div>
							<div className="flex gap-3 pt-4">
								<button
									type="button"
									onClick={() => setShowDateModal(false)}
									className="flex-1 py-3 px-4 rounded-xl font-medium text-gray-300 hover:bg-gray-800 transition-colors"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleMarkWatchedWithDate}
									disabled={!customDate || markMutation.isPending}
									className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									{markMutation.isPending ? (
										<Loader2 className="w-5 h-5 animate-spin mx-auto" />
									) : (
										"Add Watch"
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Remove Options Modal */}
			{showRemoveModal && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
					<div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full">
						<div className="flex justify-between items-center mb-6">
							<h3 className="text-xl font-semibold">Remove from Shelf</h3>
							<button
								type="button"
								onClick={() => setShowRemoveModal(false)}
								className="p-2 hover:bg-gray-800 rounded-full transition-colors"
							>
								<X className="w-5 h-5" />
							</button>
						</div>
						<p className="text-gray-400 mb-4">
							How would you like to remove this movie?
						</p>
						<div className="space-y-3">
							<button
								type="button"
								onClick={handleRemoveLatest}
								disabled={unmarkMutation.isPending}
								className="w-full py-4 px-6 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors text-left"
							>
								<div className="font-medium">Remove Latest Watch</div>
								<div className="text-sm text-gray-400">
									Remove only the most recent watch entry
								</div>
							</button>
							<button
								type="button"
								onClick={handleRemoveAll}
								disabled={unmarkMutation.isPending}
								className="w-full py-4 px-6 rounded-xl bg-red-900/30 hover:bg-red-900/50 border border-red-800 transition-colors text-left"
							>
								<div className="font-medium text-red-400">
									Remove All Watches
								</div>
								<div className="text-sm text-red-300/70">
									Remove all watch history for this movie
								</div>
							</button>
						</div>
						<button
							type="button"
							onClick={() => setShowRemoveModal(false)}
							className="w-full mt-4 py-3 px-4 rounded-xl font-medium text-gray-300 hover:bg-gray-800 transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

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
