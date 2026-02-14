import {
	authControllerMeOptions,
	listsControllerGetListsForMovieOptions,
	moviesControllerDeleteWatchHistoryEntryMutation,
	moviesControllerGetMovieDetailsOptions,
	moviesControllerGetMovieWatchHistoryOptions,
	moviesControllerGetMovieWatchHistoryQueryKey,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	type TmdbMovieDetailDto,
	type TrackedMovieDto,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	Calendar,
	Check,
	Eye,
	History,
	ListPlus,
	Loader2,
	RotateCcw,
	Share2,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddToListModal } from "@/components/AddToListModal";
import { CastSection } from "@/components/CastSection";
import { CrewSection } from "@/components/CrewSection";
import { DatePickerModal } from "@/components/DatePickerModal";
import { GenresSection } from "@/components/GenresSection";
import { MovieDetails } from "@/components/MovieDetails";
import { MovieHero } from "@/components/MovieHero";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { formatDateWithTimezone, getTmdbPosterUrl } from "@/lib/utils";

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

	const [showDateModal, setShowDateModal] = useState(false);
	const [showHistoryDialog, setShowHistoryDialog] = useState(false);
	const [showListModal, setShowListModal] = useState(false);

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: movieData, isLoading: isMovieLoading } = useQuery({
		...moviesControllerGetMovieDetailsOptions({
			path: { movieId },
		}),
	});

	const movie = movieData as TmdbMovieDetailDto | undefined;

	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});

	const { data: listsForMovie } = useQuery({
		...listsControllerGetListsForMovieOptions({
			path: { movieId },
		}),
		enabled: !!user?.did,
	});

	const listsCount = listsForMovie?.filter((l) => l.isInList).length ?? 0;
	const isInAnyList = listsCount > 0;

	const userTimezone = userSettings?.timezone || "UTC";
	const is24Hour = userSettings?.timeFormat === "24h";

	const { data: watchHistory } = useQuery({
		...moviesControllerGetMovieWatchHistoryOptions({
			path: { userDid: user?.did || "", movieId },
		}),
		enabled: !!user?.did && !!movieId,
	});

	const isWatched = useMemo(() => {
		if (!trackedMovies) return false;
		return trackedMovies.some((tm: TrackedMovieDto) => tm.movieId === movieId);
	}, [trackedMovies, movieId]);

	const trackedMovie = useMemo(() => {
		if (!trackedMovies) return null;
		return (
			trackedMovies.find((tm: TrackedMovieDto) => tm.movieId === movieId) ||
			null
		);
	}, [trackedMovies, movieId]);

	const formattedWatchedDate = useMemo(() => {
		if (!trackedMovie?.watchedDate) return null;
		return formatDateWithTimezone(trackedMovie.watchedDate, {
			timezone: userTimezone,
			is24Hour,
		});
	}, [trackedMovie, userTimezone, is24Hour]);

	const colors = movie?.colors || {
		primary: "#8b5cf6",
		secondary: "#6366f1",
		accent: "#a855f7",
		muted: "#4c1d95",
	};

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
			toast.success("Added to your shelf");
			setShowDateModal(false);
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
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetMovieWatchHistoryQueryKey({
					path: { userDid: user?.did || "", movieId },
				}),
			});
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf. Please try again.");
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
			toast.success("Watch entry removed");
		},
		onError: () => {
			toast.error("Failed to remove watch entry. Please try again.");
		},
	});

	const handleMarkWatched = () => {
		markMutation.mutate({ body: { movieId } });
	};

	const handleUnmarkWatched = () => {
		unmarkMutation.mutate({
			path: { movieId },
			query: { mode: "all" },
		});
	};

	const handleShare = async () => {
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({ url });
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

	const posterUrl = getTmdbPosterUrl(movie?.poster_path, "w500");
	const isPending =
		markMutation.isPending && markMutation.variables?.body?.movieId === movieId;

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<MovieHero movie={movie} />

			<div className="container mx-auto px-4 py-4 max-w-6xl">
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
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
													<>
														<Loader2 className="w-5 h-5 animate-spin" />
														Loading
													</>
												) : (
													<>
														<Calendar className="w-5 h-5" />
														Add to Shelf
													</>
												)}
											</button>
											<button
												type="button"
												onClick={() => setShowDateModal(true)}
												className="w-full py-2 px-4 rounded-xl font-medium text-gray-300 hover:bg-gray-800 border border-gray-700 transition-all duration-200 flex items-center justify-center gap-2"
											>
												<Calendar className="w-4 h-4" />
												Watch on different date
											</button>
											<button
												type="button"
												onClick={() => setShowListModal(true)}
												className={`w-full py-2 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 border ${
													isInAnyList
														? "bg-purple-600/20 border-purple-600 text-purple-300 hover:bg-purple-600/30"
														: "text-gray-300 hover:bg-gray-800 border-gray-700"
												}`}
											>
												{isInAnyList ? (
													<Check className="w-4 h-4" />
												) : (
													<ListPlus className="w-4 h-4" />
												)}
												{isInAnyList
													? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
													: "Add to List"}
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
													<>
														<Loader2 className="w-5 h-5 animate-spin" />
														Loading
													</>
												) : (
													<>
														<RotateCcw className="w-4 h-4" />
														Watch Now
													</>
												)}
											</button>
											<button
												type="button"
												onClick={() => setShowDateModal(true)}
												className="w-full py-2 px-4 rounded-xl font-medium text-gray-300 hover:bg-gray-800 border border-gray-700 transition-all duration-200 flex items-center justify-center gap-2"
											>
												<Calendar className="w-4 h-4" />
												Watch on different date
											</button>
											<button
												type="button"
												onClick={() => setShowListModal(true)}
												className={`w-full py-2 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 border ${
													isInAnyList
														? "bg-purple-600/20 border-purple-600 text-purple-300 hover:bg-purple-600/30"
														: "text-gray-300 hover:bg-gray-800 border-gray-700"
												}`}
											>
												{isInAnyList ? (
													<Check className="w-4 h-4" />
												) : (
													<ListPlus className="w-4 h-4" />
												)}
												{isInAnyList
													? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
													: "Add to List"}
											</button>
										</>
									)
								) : (
									<button
										type="button"
										className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
										style={{
											background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
											boxShadow: `0 10px 30px -10px ${colors.primary}60`,
										}}
										onClick={() => router.navigate({ to: "/login" })}
									>
										Sign in to Track
									</button>
								)}
							</div>
						</div>
					</div>

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
											<>
												<Loader2 className="w-5 h-5 animate-spin" />
												Loading
											</>
										) : (
											<>
												<Calendar className="w-5 h-5" />
												Add to Shelf
											</>
										)}
									</button>
									<button
										type="button"
										onClick={() => setShowDateModal(true)}
										className="w-full py-3 px-6 rounded-xl font-medium text-gray-300 hover:bg-gray-800 border border-gray-700 transition-all duration-200 flex items-center justify-center gap-2"
									>
										<Calendar className="w-4 h-4" />
										Watch on different date
									</button>
									<button
										type="button"
										onClick={() => setShowListModal(true)}
										className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 border ${
											isInAnyList
												? "bg-purple-600/20 border-purple-600 text-purple-300 hover:bg-purple-600/30"
												: "text-gray-300 hover:bg-gray-800 border-gray-700"
										}`}
									>
										{isInAnyList ? (
											<Check className="w-4 h-4" />
										) : (
											<ListPlus className="w-4 h-4" />
										)}
										{isInAnyList
											? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
											: "Add to List"}
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
										{(watchHistory?.length ?? 0) > 1 && (
											<>
												<div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
													<History className="w-3 h-3" />
													<span>{watchHistory?.length} total watches</span>
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
										{(watchHistory?.length ?? 0) === 1 && (
											<button
												type="button"
												onClick={handleUnmarkWatched}
												disabled={unmarkMutation.isPending}
												className="mt-2 flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors py-2 px-3 -ml-3 rounded-lg hover:bg-red-900/20 disabled:opacity-50"
											>
												{unmarkMutation.isPending ? (
													<>
														<span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
														Loading
													</>
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
										className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
										style={{
											background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
											boxShadow: `0 10px 30px -10px ${colors.primary}60`,
										}}
									>
										{isPending ? (
											<>
												<Loader2 className="w-4 h-4 animate-spin" />
												Loading
											</>
										) : (
											<>
												<RotateCcw className="w-4 h-4" />
												Watch Again
											</>
										)}
									</button>
									<button
										type="button"
										onClick={() => setShowDateModal(true)}
										className="w-full py-2 px-4 rounded-xl font-medium text-gray-300 hover:bg-gray-800 border border-gray-700 transition-all duration-200 flex items-center justify-center gap-2"
									>
										<Calendar className="w-4 h-4" />
										Watch on different date
									</button>
									<button
										type="button"
										onClick={() => setShowListModal(true)}
										className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 border ${
											isInAnyList
												? "bg-purple-600/20 border-purple-600 text-purple-300 hover:bg-purple-600/30"
												: "text-gray-300 hover:bg-gray-800 border-gray-700"
										}`}
									>
										{isInAnyList ? (
											<Check className="w-4 h-4" />
										) : (
											<ListPlus className="w-4 h-4" />
										)}
										{isInAnyList
											? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
											: "Add to List"}
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
							<button
								type="button"
								className="w-full py-4 px-6 rounded-xl font-semibold text-white text-lg text-center transition-all duration-200 hover:scale-[1.02]"
								style={{
									background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
									boxShadow: `0 15px 35px -10px ${colors.primary}60`,
								}}
								onClick={() => router.navigate({ to: "/login" })}
							>
								Sign in to Track
							</button>
						)}
					</div>

					<div className="space-y-6 min-w-0 w-full">
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

						<MovieDetails movie={movie} colors={colors} />
						<GenresSection genres={movie?.genres} colors={colors} />
						<CastSection cast={movie?.credits?.cast} colors={colors} />
						<CrewSection crew={movie?.credits?.crew} colors={colors} />
					</div>
				</div>
			</div>

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
						{(watchHistory?.length ?? 0) > 0 ? (
							watchHistory?.map((watch) => (
								<div
									key={watch.id}
									className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50"
								>
									<div className="flex-1">
										<p className="text-sm font-medium text-white">
											{formatDateWithTimezone(watch.watchedDate, {
												timezone: userTimezone,
												is24Hour,
											})}
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
									>
										{deleteWatchEntryMutation.isPending ? (
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

			<DatePickerModal
				open={showDateModal}
				onClose={() => setShowDateModal(false)}
				movieId={movieId}
				userDid={user?.did}
			/>

			{user && (
				<AddToListModal
					open={showListModal}
					onOpenChange={setShowListModal}
					movieId={movieId}
					movieTitle={movie?.title || ""}
					user={user}
				/>
			)}

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
