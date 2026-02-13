import {
	authControllerMeOptions,
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetMovieWatchHistory,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	type TmdbCastDto,
	type TmdbCrewDto,
	type TmdbMovieDetailDto,
	type TrackedMovieDto,
	usersControllerGetMySettingsOptions,
	type WatchHistoryItemDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { format } from "date-fns";
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
	Share2,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";

export const Route = createFileRoute("/movies/$movieId/$title")({
	loader: async ({ params, context }) => {
		const { movieId } = params;
		const { queryClient } = context;

		const data = await queryClient.fetchQuery({
			...moviesControllerGetMovieDetailsOptions({
				path: { movieId },
			}),
		});

		return data as TmdbMovieDetailDto;
	},
	head: ({ loaderData }) => {
		const posterUrl = loaderData?.poster_path
			? `https://image.tmdb.org/t/p/w780${loaderData.poster_path}`
			: null;
		const title = loaderData
			? `${loaderData.title} | OpnShelf`
			: "Movie | OpnShelf";
		const url = typeof window !== "undefined" ? window.location.href : "";

		return {
			meta: [
				{ title },
				{
					name: "description",
					content: loaderData?.overview?.slice(0, 160) || "",
				},
				{ property: "og:title", content: title },
				{
					property: "og:description",
					content: loaderData?.overview?.slice(0, 160) || "",
				},
				{ property: "og:type", content: "video.movie" },
				{ property: "og:url", content: url },
				...(posterUrl ? [{ property: "og:image", content: posterUrl }] : []),
				{ property: "og:image:width", content: "780" },
				{ property: "og:image:height", content: "1170" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: title },
				{
					name: "twitter:description",
					content: loaderData?.overview?.slice(0, 160) || "",
				},
				...(posterUrl ? [{ name: "twitter:image", content: posterUrl }] : []),
				{ name: "twitter:url", content: url },
			],
		};
	},
	component: MovieDetailPage,
});

function MovieDetailPage() {
	const { movieId } = Route.useParams();
	const queryClient = useQueryClient();
	const router = useRouter();

	const [showHours, setShowHours] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);
	const [customDate, setCustomDate] = useState("");
	const [customTime, setCustomTime] = useState("");
	const [timeDate, setTimeDate] = useState<Date | undefined>(undefined);
	const [showHistoryDialog, setShowHistoryDialog] = useState(false);

	// Sync timeDate changes to customTime string
	useEffect(() => {
		if (timeDate) {
			const hours = timeDate.getHours().toString().padStart(2, "0");
			const minutes = timeDate.getMinutes().toString().padStart(2, "0");
			setCustomTime(`${hours}:${minutes}`);
		}
	}, [timeDate]);

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

	// Fetch user settings for timezone and time format
	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});

	const userTimezone = userSettings?.timezone || "UTC";
	const is24Hour = userSettings?.timeFormat === "24h";

	// Check if this movie is in user's watched list
	const isWatched = useMemo(() => {
		if (!trackedMovies) return false;
		return trackedMovies.some((tm: TrackedMovieDto) => tm.movieId === movieId);
	}, [trackedMovies, movieId]);

	// Find the tracked movie entry to get watched date and count
	const trackedMovie = useMemo(() => {
		if (!trackedMovies) return null;
		return (
			trackedMovies.find((tm: TrackedMovieDto) => tm.movieId === movieId) ||
			null
		);
	}, [trackedMovies, movieId]);

	// Format the watched date with time (24-hour notation)
	const formattedWatchedDate = useMemo(() => {
		if (!trackedMovie?.watchedDate) return null;
		return new Date(trackedMovie.watchedDate).toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: !is24Hour,
			timeZone: userTimezone,
		});
	}, [trackedMovie, userTimezone, is24Hour]);

	// Format watch history dates (24-hour notation)
	const formatWatchDate = (dateString: string) => {
		return new Date(dateString).toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: !is24Hour,
			timeZone: userTimezone,
		});
	};

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
			queryClient.invalidateQueries({
				queryKey: ["watchHistory", user?.did, movieId],
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

	// Delete individual watch history entry
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
			toast.success("Watch entry removed");
		},
		onError: () => {
			toast.error("Failed to remove watch entry. Please try again.");
		},
	});

	// Unmark movie as watched (remove entirely or latest)
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
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf. Please try again.");
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

	const handleUnmarkWatched = () => {
		unmarkMutation.mutate({
			path: { movieId },
			query: { mode: "all" },
		});
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

	// Initialize date/time inputs to current values when modal opens
	const openDateModal = () => {
		const now = new Date();
		setCustomDate(now.toISOString().split("T")[0]);
		setCustomTime(now.toTimeString().slice(0, 5));
		setTimeDate(now);
		setShowDateModal(true);
	};

	const handleShare = async () => {
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({
					title: movie?.title,
					url,
				});
			} catch {
				// User cancelled share
			}
		} else {
			try {
				await navigator.clipboard.writeText(url);
				toast.success("Link copied to clipboard");
			} catch {
				toast.error("Failed to copy link");
			}
		}
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
							<div className="hidden md:block shrink-0">
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
			<div className="container mx-auto px-4 py-4 max-w-6xl">
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
					{/* Left Column - Poster (mobile) & Actions */}
					<div className="md:hidden min-w-0">
						<div className="flex gap-4">
							{posterUrl && (
								<div
									className="w-32 shrink-0 rounded-lg overflow-hidden"
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
										<>
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
											<button
												type="button"
												onClick={openDateModal}
												className="w-full py-2 px-4 rounded-xl font-medium text-gray-300 transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border border-gray-700"
											>
												<Calendar className="w-4 h-4" />
												Add on Different Date
											</button>
											<button
												type="button"
												onClick={handleShare}
												className="w-full py-2 px-4 rounded-xl font-medium text-gray-300 transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border border-gray-700"
											>
												<Share2 className="w-4 h-4" />
												Share
											</button>
										</>
									) : (
										<>
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
														<RotateCcw className="w-4 h-4" />
														Watch Now
													</>
												)}
											</button>
											<button
												type="button"
												onClick={openDateModal}
												className="w-full py-2 px-4 rounded-xl font-medium text-gray-300 transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border border-gray-700"
											>
												<Calendar className="w-4 h-4" />
												Watch on Different Date
											</button>
											<button
												type="button"
												onClick={handleShare}
												className="w-full py-2 px-4 rounded-xl font-medium text-gray-300 transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border border-gray-700"
											>
												<Share2 className="w-4 h-4" />
												Share
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
										{watchHistory && watchHistory.length > 1 && (
											<span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded-full">
												{watchHistory.length} watches
											</span>
										)}
									</p>
								)}
								{watchHistory && watchHistory.length > 1 && (
									<button
										type="button"
										onClick={() => setShowHistoryDialog(true)}
										className="mt-2 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2 px-3 -ml-3 rounded-lg hover:bg-gray-800/50"
									>
										<Eye className="w-4 h-4" />
										View all watches
									</button>
								)}
								{/* Remove button when only watched once */}
								{watchHistory && watchHistory.length === 1 && (
									<button
										type="button"
										onClick={handleUnmarkWatched}
										disabled={unmarkMutation.isPending}
										className="mt-2 flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors py-2 px-3 -ml-3 rounded-lg hover:bg-red-900/20 disabled:opacity-50"
									>
										{unmarkMutation.isPending ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<>
												<Trash2 className="w-4 h-4" />
												Remove from shelf
											</>
										)}
									</button>
								)}
							</div>
						)}
					</div>

					{/* Desktop Actions */}
					<div className="hidden md:block space-y-4 min-w-0">
						{user ? (
							!isWatched ? (
								<div className="space-y-3">
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
									<button
										type="button"
										onClick={openDateModal}
										className="w-full py-3 px-6 rounded-xl font-medium text-gray-300 transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border border-gray-700"
									>
										<Calendar className="w-4 h-4" />
										Add on Different Date
									</button>
									<button
										type="button"
										onClick={handleShare}
										className="w-full py-3 px-6 rounded-xl font-medium text-gray-300 transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border border-gray-700"
									>
										<Share2 className="w-4 h-4" />
										Share
									</button>
								</div>
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
										{watchHistory && watchHistory.length > 1 && (
											<>
												<div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
													<History className="w-3 h-3" />
													<span>{watchHistory.length} total watches</span>
												</div>
												<button
													type="button"
													onClick={() => setShowHistoryDialog(true)}
													className="mt-2 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2 px-3 -ml-3 rounded-lg hover:bg-gray-800/50"
												>
													<Eye className="w-4 h-4" />
													View all watches
												</button>
											</>
										)}
										{/* Remove button when only watched once */}
										{watchHistory && watchHistory.length === 1 && (
											<button
												type="button"
												onClick={handleUnmarkWatched}
												disabled={unmarkMutation.isPending}
												className="mt-2 flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors py-2 px-3 -ml-3 rounded-lg hover:bg-red-900/20 disabled:opacity-50"
											>
												{unmarkMutation.isPending ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : (
													<>
														<Trash2 className="w-4 h-4" />
														Remove from shelf
													</>
												)}
											</button>
										)}
									</div>
									<button
										type="button"
										onClick={handleMarkWatched}
										disabled={isPending}
										className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 hover:scale-[1.02]"
										style={{
											background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
											boxShadow: `0 10px 30px -10px ${colors.primary}60`,
										}}
									>
										{isPending ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<>
												<RotateCcw className="w-4 h-4" />
												Watch Now
											</>
										)}
									</button>
									<button
										type="button"
										onClick={openDateModal}
										className="w-full py-3 px-6 rounded-xl font-medium text-gray-300 transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border border-gray-700"
									>
										<Calendar className="w-4 h-4" />
										Watch on Different Date
									</button>
									<button
										type="button"
										onClick={handleShare}
										className="w-full py-3 px-6 rounded-xl font-medium text-gray-300 transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-800 border border-gray-700"
									>
										<Share2 className="w-4 h-4" />
										Share
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
					<div className="space-y-6 min-w-0 w-full">
						{/* Overview */}
						<section>
							<h2
								className="text-xl font-semibold mb-3"
								style={{ color: colors.primary }}
							>
								Overview
							</h2>
							<p className="text-gray-300 leading-relaxed text-lg wrap-break-word">
								{movie?.overview || "No overview available."}
							</p>
						</section>

						{/* Additional Info */}
						<section className="grid grid-cols-2 gap-4 min-w-0">
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

						{/* Cast */}
						{movie?.credits?.cast && movie.credits.cast.length > 0 && (
							<section className="pt-4 min-w-0">
								<h2
									className="text-xl font-semibold mb-4"
									style={{ color: colors.primary }}
								>
									Cast
								</h2>
								<div className="relative w-full overflow-hidden">
									<div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent w-full pr-8">
										{movie.credits.cast.map((person: TmdbCastDto) => (
											<div
												key={person.id}
												className="shrink-0 w-32 group cursor-pointer"
											>
												<div className="relative overflow-hidden rounded-lg bg-gray-900/50 aspect-2/3 mb-2 transition-transform duration-300 group-hover:scale-[1.02]">
													{person.profile_path ? (
														<img
															src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
															alt={person.name}
															className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
															loading="lazy"
														/>
													) : (
														<div className="w-full h-full bg-gray-800 flex items-center justify-center">
															<span className="text-gray-600 text-xs text-center px-2">
																No photo
															</span>
														</div>
													)}
												</div>
												<div className="space-y-0.5">
													<p className="text-sm font-medium text-gray-200 line-clamp-2 transition-colors duration-200 group-hover:text-white">
														{person.name}
													</p>
													{person.character && (
														<p
															className="text-xs line-clamp-2"
															style={{ color: colors.muted }}
														>
															as {person.character}
														</p>
													)}
												</div>
											</div>
										))}
									</div>
									<div
										className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none"
										style={{
											background: `linear-gradient(to left, rgb(3, 7, 18), transparent)`,
										}}
									/>
								</div>
							</section>
						)}

						{/* Crew */}
						{movie?.credits?.crew && movie.credits.crew.length > 0 && (
							<section className="pt-2">
								<h2
									className="text-xl font-semibold mb-4"
									style={{ color: colors.primary }}
								>
									Crew
								</h2>
								<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
									{movie.credits.crew.map((person: TmdbCrewDto) => (
										<div
											key={`${person.id}-${person.job}`}
											className="group p-3 rounded-lg bg-gray-900/30 hover:bg-gray-900/60 transition-all duration-200 cursor-pointer"
										>
											<p className="text-sm font-medium text-gray-200 line-clamp-1 transition-colors duration-200 group-hover:text-white">
												{person.name}
											</p>
											<p
												className="text-xs mt-0.5"
												style={{ color: colors.muted }}
											>
												{person.job}
											</p>
										</div>
									))}
								</div>
							</section>
						)}
					</div>
				</div>
			</div>

			{/* Watch History Dialog */}
			<Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
				<DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<History className="w-5 h-5" />
							Watch History
						</DialogTitle>
						<DialogDescription className="text-gray-400">
							All the times you&apos;ve watched {movie?.title}
						</DialogDescription>
					</DialogHeader>
					<div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
						{watchHistory && watchHistory.length > 0 ? (
							watchHistory.map((watch) => (
								<div
									key={watch.id}
									className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50"
								>
									<div className="flex-1">
										<p className="text-sm font-medium text-white">
											{formatWatchDate(watch.watchedDate)}
										</p>
									</div>
									<button
										type="button"
										onClick={() =>
											deleteWatchEntryMutation.mutate({
												path: { trackedMovieId: watch.id },
											})
										}
										disabled={deleteWatchEntryMutation.isPending}
										className="shrink-0 p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
										title="Remove this watch"
									>
										{deleteWatchEntryMutation.isPending &&
										deleteWatchEntryMutation.variables?.path?.trackedMovieId ===
											watch.id ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<Trash2 className="w-4 h-4" />
										)}
									</button>
								</div>
							))
						) : (
							<div className="text-center py-8 text-gray-500">
								No watch history found
							</div>
						)}
					</div>
					<div className="mt-4 flex justify-end">
						<Button
							variant="outline"
							onClick={() => setShowHistoryDialog(false)}
							className="border-gray-700 text-white hover:bg-gray-800"
						>
							Close
						</Button>
					</div>
				</DialogContent>
			</Dialog>

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
									htmlFor="date-picker"
									className="block text-sm text-gray-400 mb-2 cursor-pointer"
								>
									Date
								</label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="w-full px-4 py-3 h-auto mt-2 bg-gray-800 rounded-xl border border-gray-700 text-white hover:bg-gray-700 hover:text-white justify-start text-left font-normal"
										>
											<Calendar className="mr-2 h-4 w-4 text-gray-400" />
											{customDate ? (
												format(new Date(customDate), "PPP")
											) : (
												<span className="text-gray-400">Pick a date</span>
											)}
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="w-auto p-0 bg-gray-900 border-gray-700"
										align="start"
									>
										<CalendarComponent
											mode="single"
											selected={customDate ? new Date(customDate) : undefined}
											onSelect={(date) => {
												if (date) {
													setCustomDate(format(date, "yyyy-MM-dd"));
												}
											}}
											autoFocus
										/>
									</PopoverContent>
								</Popover>
							</div>
							<div>
								<TimePicker date={timeDate} setDate={setTimeDate} />
							</div>
							<div className="flex gap-3 pt-4">
								<Button
									type="button"
									variant="outline"
									onClick={() => setShowDateModal(false)}
									className="flex-1 border-gray-700 text-white hover:bg-gray-800"
								>
									Cancel
								</Button>
								<Button
									type="button"
									onClick={handleMarkWatchedWithDate}
									disabled={!customDate || markMutation.isPending}
									className="flex-1 bg-purple-600 hover:bg-purple-700"
								>
									{markMutation.isPending ? (
										<Loader2 className="w-5 h-5 animate-spin mx-auto" />
									) : (
										"Add Play"
									)}
								</Button>
							</div>
						</div>
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
