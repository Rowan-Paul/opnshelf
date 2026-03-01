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
import { usePostHog } from "@posthog/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Calendar, Clock, History, Loader2, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddToListModal } from "@/components/AddToListModal";
import { CastSection } from "@/components/CastSection";
import { CrewSection } from "@/components/CrewSection";
import { DatePickerModal } from "@/components/DatePickerModal";
import {
	type ColorTheme,
	DetailActions,
	DetailHero,
	MetadataPills,
} from "@/components/detail";
import { GenresSection } from "@/components/GenresSection";
import { useTheme } from "@/components/theme-provider";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { M3Button } from "@/components/ui/m3-button";
import {
	formatDateOnly,
	formatDateWithTimezone,
	formatRuntime,
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
} from "@/lib/utils";

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
	const posthog = usePostHog();

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

	const colors: ColorTheme = {
		primary: movie?.colors?.primary || seedColor,
		secondary: movie?.colors?.secondary || seedColor,
		accent: movie?.colors?.accent || seedColor,
		muted: movie?.colors?.muted || seedColor,
	};

	const markMutation = useMutation({
		mutationKey: ["movies", movieId, "markWatched"],
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
			posthog.capture("movie_marked_watched", {
				movie_id: movieId,
				movie_title: movie?.title,
				release_year: movie?.release_date
					? new Date(movie.release_date).getFullYear()
					: undefined,
			});
			toast.success("Added to your shelf");
			setShowDateModal(false);
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const unmarkMutation = useMutation({
		mutationKey: ["movies", movieId, "unmarkWatched"],
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
			posthog.capture("movie_unmarked_watched", {
				movie_id: movieId,
				movie_title: movie?.title,
			});
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf. Please try again.");
		},
	});

	const deleteWatchEntryMutation = useMutation({
		mutationKey: ["movies", movieId, "deleteWatchEntry"],
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

	const isPending =
		markMutation.isPending && markMutation.variables?.body?.movieId === movieId;

	const backdropUrl = getTmdbBackdropUrl(movie?.backdrop_path);
	const posterUrl = getTmdbPosterUrl(movie?.poster_path, "w500");

	const releaseYear = movie?.release_date
		? new Date(movie.release_date).getFullYear()
		: null;

	const subtitle = useMemo(() => {
		if (releaseYear) return String(releaseYear);
		return null;
	}, [releaseYear]);

	const metadataItems = useMemo(() => {
		const items = [];
		if (movie?.release_date) {
			items.push({
				icon: <Calendar className="w-4 h-4" />,
				label: formatDateOnly(movie.release_date),
			});
		}
		if (movie?.runtime) {
			items.push({
				icon: <Clock className="w-4 h-4" />,
				label: formatRuntime(movie.runtime, false),
			});
		}
		if (movie?.vote_average) {
			items.push({
				icon: <Star className="w-4 h-4" />,
				label: `${movie.vote_average.toFixed(1)}/10`,
			});
		}
		return items;
	}, [movie]);

	return (
		<div
			className="min-h-screen m3-background m3-on-background"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<DetailHero
				title={movie?.title || ""}
				subtitle={subtitle ?? undefined}
				backdropUrl={backdropUrl}
				posterUrl={posterUrl}
				colors={colors}
				isLoading={isMovieLoading}
				onBack={() => router.history.back()}
			/>

			<div className="container mx-auto px-4 py-6 max-w-6xl">
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
					<div className="space-y-4 min-w-0">
						<DetailActions
							mediaType="movie"
							mediaId={movieId}
							colors={colors}
							isWatched={isWatched}
							watchedDate={formattedWatchedDate}
							totalWatches={watchHistory?.length ?? 0}
							onMarkWatched={handleMarkWatched}
							onUnmarkWatched={handleUnmarkWatched}
							onShowDatePicker={() => setShowDateModal(true)}
							isMarkingPending={isPending}
							isUnmarkingPending={unmarkMutation.isPending}
							listsCount={listsCount}
							onShowListModal={() => setShowListModal(true)}
							onViewHistory={() => setShowHistoryDialog(true)}
							isLoggedIn={!!user}
							onLogin={() => router.navigate({ to: "/login" })}
						/>
					</div>

					<div className="space-y-6 min-w-0 w-full">
						<MetadataPills items={metadataItems} />

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
