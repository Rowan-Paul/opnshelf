import {
	authControllerMeOptions,
	listsControllerGetListsForItemOptions,
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
import { AddToShelfButton } from "@/components/AddToShelfButton";
import { CastSection } from "@/components/CastSection";
import { CrewSection } from "@/components/CrewSection";
import { DatePickerModal } from "@/components/DatePickerModal";
import { GenresSection } from "@/components/GenresSection";
import { MovieDetails } from "@/components/MovieDetails";
import { MovieHero } from "@/components/MovieHero";
import { useTheme } from "@/components/theme-provider";
import { ActionButton } from "@/components/ui/action-button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { M3Button } from "@/components/ui/m3-button";
import { formatDateWithTimezone } from "@/lib/utils";

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
	const { seedColor } = useTheme();

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
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "movie", mediaId: movieId },
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
		primary: seedColor,
		secondary: seedColor,
		accent: seedColor,
		muted: seedColor,
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

	const isPending =
		markMutation.isPending && markMutation.variables?.body?.movieId === movieId;

	return (
		<div
			className="min-h-screen m3-background m3-on-background"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<MovieHero movie={movie} isLoading={isMovieLoading} />

			<div className="container mx-auto px-4 py-4 max-w-6xl">
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
					<div className="md:hidden min-w-0">
						<div className="flex gap-4">
							<div className="flex-1 flex flex-col gap-2 justify-center">
								{user ? (
									!isWatched ? (
										<>
											<AddToShelfButton
												onClick={handleMarkWatched}
												isPending={isPending}
												label="Add to Shelf"
												icon={<Calendar className="w-5 h-5" />}
												colors={colors}
												size="compact"
											/>
											<ActionButton
												icon={<Calendar className="w-4 h-4" />}
												label="Watch on different date"
												onClick={() => setShowDateModal(true)}
											/>
											<ActionButton
												icon={
													isInAnyList ? (
														<Check className="w-4 h-4" />
													) : (
														<ListPlus className="w-4 h-4" />
													)
												}
												label={
													isInAnyList
														? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
														: "Add to List"
												}
												onClick={() => setShowListModal(true)}
												isActive={isInAnyList}
												activeColor={seedColor}
											/>
										</>
									) : (
										<>
											<AddToShelfButton
												onClick={handleMarkWatched}
												isPending={isPending}
												label="Watch Now"
												icon={<RotateCcw className="w-4 h-4" />}
												colors={colors}
												size="compact"
											/>
											<ActionButton
												icon={<Calendar className="w-4 h-4" />}
												label="Watch on different date"
												onClick={() => setShowDateModal(true)}
											/>
											<ActionButton
												icon={
													isInAnyList ? (
														<Check className="w-4 h-4" />
													) : (
														<ListPlus className="w-4 h-4" />
													)
												}
												label={
													isInAnyList
														? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
														: "Add to List"
												}
												onClick={() => setShowListModal(true)}
												isActive={isInAnyList}
												activeColor={seedColor}
											/>
										</>
									)
								) : (
									<button
										type="button"
										className="w-full py-3 px-6 rounded-xl m3-label-large transition-all duration-200 flex items-center justify-center gap-2"
										style={{
											background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
											boxShadow: `0 10px 30px -10px ${colors.primary}60`,
											color: "var(--md-sys-color-on-primary)",
										}}
										onClick={() => router.navigate({ to: "/login" })}
									>
										Sign in to Track
									</button>
								)}
								<ActionButton
									icon={<Share2 className="w-4 h-4" />}
									label="Share"
									onClick={handleShare}
								/>
							</div>
						</div>
					</div>

					<div className="hidden md:block space-y-4 min-w-0">
						{user ? (
							!isWatched ? (
								<div className="space-y-3">
									<AddToShelfButton
										onClick={handleMarkWatched}
										isPending={isPending}
										label="Add to Shelf"
										icon={<Calendar className="w-5 h-5" />}
										colors={colors}
									/>
									<ActionButton
										icon={<Calendar className="w-4 h-4" />}
										label="Watch on different date"
										onClick={() => setShowDateModal(true)}
									/>
									<ActionButton
										icon={
											isInAnyList ? (
												<Check className="w-4 h-4" />
											) : (
												<ListPlus className="w-4 h-4" />
											)
										}
										label={
											isInAnyList
												? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
												: "Add to List"
										}
										onClick={() => setShowListModal(true)}
										isActive={isInAnyList}
										activeColor={seedColor}
									/>
								</div>
							) : (
								<div className="space-y-3">
									<div
										className="p-4 rounded-xl"
										style={{
											backgroundColor:
												"var(--md-sys-color-surface-container-highest)",
										}}
									>
										<div
											className="flex items-center gap-2 mb-2"
											style={{ color: "var(--md-sys-color-primary)" }}
										>
											<Check className="w-5 h-5" />
											<span className="m3-title-medium">On Your Shelf</span>
										</div>
										{formattedWatchedDate && (
											<p
												className="m3-body-medium"
												style={{
													color: "var(--md-sys-color-on-surface-variant)",
												}}
											>
												Watched on {formattedWatchedDate}
											</p>
										)}
										{(watchHistory?.length ?? 0) > 1 && (
											<>
												<div
													className="mt-2 flex items-center gap-2 m3-body-small"
													style={{
														color: "var(--md-sys-color-on-surface-variant)",
													}}
												>
													<History className="w-3 h-3" />
													<span>{watchHistory?.length} total watches</span>
												</div>
												<button
													type="button"
													onClick={() => setShowHistoryDialog(true)}
													className="mt-2 flex items-center gap-2 m3-body-medium transition-colors py-2 px-3 -ml-3 rounded-lg"
													style={{
														color: "var(--md-sys-color-on-surface-variant)",
													}}
													onMouseEnter={(e) => {
														e.currentTarget.style.color =
															"var(--md-sys-color-on-surface)";
														e.currentTarget.style.backgroundColor =
															"var(--md-sys-color-surface-container)";
													}}
													onMouseLeave={(e) => {
														e.currentTarget.style.color =
															"var(--md-sys-color-on-surface-variant)";
														e.currentTarget.style.backgroundColor =
															"transparent";
													}}
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
												className="mt-2 flex items-center gap-2 m3-body-medium transition-colors py-2 px-3 -ml-3 rounded-lg disabled:opacity-50"
												style={{
													color: "var(--md-sys-color-error)",
												}}
												onMouseEnter={(e) => {
													e.currentTarget.style.backgroundColor =
														"var(--md-sys-color-error-container)";
												}}
												onMouseLeave={(e) => {
													e.currentTarget.style.backgroundColor = "transparent";
												}}
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
									<AddToShelfButton
										onClick={handleMarkWatched}
										isPending={isPending}
										label="Watch Again"
										icon={<RotateCcw className="w-4 h-4" />}
										colors={colors}
										size="compact"
									/>
									<ActionButton
										icon={<Calendar className="w-4 h-4" />}
										label="Watch on different date"
										onClick={() => setShowDateModal(true)}
									/>
									<ActionButton
										icon={
											isInAnyList ? (
												<Check className="w-4 h-4" />
											) : (
												<ListPlus className="w-4 h-4" />
											)
										}
										label={
											isInAnyList
												? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
												: "Add to List"
										}
										onClick={() => setShowListModal(true)}
										isActive={isInAnyList}
										activeColor={seedColor}
									/>
								</div>
							)
						) : (
							<button
								type="button"
								className="w-full py-4 px-6 rounded-xl m3-label-large text-center transition-all duration-200 hover:scale-[1.02]"
								style={{
									background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
									boxShadow: `0 15px 35px -10px ${colors.primary}60`,
									color: "var(--md-sys-color-on-primary)",
								}}
								onClick={() => router.navigate({ to: "/login" })}
							>
								Sign in to Track
							</button>
						)}
						<ActionButton
							icon={<Share2 className="w-4 h-4" />}
							label="Share"
							onClick={handleShare}
						/>
					</div>

					<div className="space-y-6 min-w-0 w-full">
						<section>
							<h2
								className="m3-title-large mb-3"
								style={{ color: colors.primary }}
							>
								Overview
							</h2>
							<p
								className="m3-body-large leading-relaxed wrap-break-word"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
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
				<DialogContent
					className="max-w-md"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container-highest)",
						borderColor: "var(--md-sys-color-outline)",
						color: "var(--md-sys-color-on-surface)",
					}}
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<History className="w-5 h-5" />
							Watch History
						</DialogTitle>
						<DialogDescription
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							All the times you&apos;ve watched {movie?.title}
						</DialogDescription>
					</DialogHeader>
					<div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
						{(watchHistory?.length ?? 0) > 0 ? (
							watchHistory?.map((watch) => (
								<div
									key={watch.id}
									className="flex items-center gap-3 p-3 rounded-lg"
									style={{
										backgroundColor: "var(--md-sys-color-surface-container)",
									}}
								>
									<div className="flex-1">
										<p
											className="m3-body-medium"
											style={{ color: "var(--md-sys-color-on-surface)" }}
										>
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
										className="shrink-0 p-2 rounded-lg transition-colors disabled:opacity-50"
										style={{
											color: "var(--md-sys-color-on-surface-variant)",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.color = "var(--md-sys-color-error)";
											e.currentTarget.style.backgroundColor =
												"var(--md-sys-color-error-container)";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.color =
												"var(--md-sys-color-on-surface-variant)";
											e.currentTarget.style.backgroundColor = "transparent";
										}}
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
							<div
								className="text-center py-8 m3-body-large"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								No watch history found
							</div>
						)}
					</div>
					<div className="mt-4 flex justify-end">
						<M3Button
							variant="outlined"
							onClick={() => setShowHistoryDialog(false)}
						>
							Close
						</M3Button>
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
					mediaType="movie"
					mediaId={movieId}
					mediaTitle={movie?.title || ""}
					user={user}
				/>
			)}

			{isMovieLoading && (
				<div
					className="fixed inset-0 flex items-center justify-center z-50"
					style={{
						backgroundColor: "var(--md-sys-color-background)",
					}}
				>
					<div
						className="animate-spin rounded-full h-16 w-16 border-b-2"
						style={{ borderColor: colors.primary }}
					/>
				</div>
			)}
		</div>
	);
}
