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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddToListModal } from "@/components/AddToListModal";
import { DatePickerModal } from "@/components/DatePickerModal";
import { MovieDetailContent } from "@/components/movie-detail/MovieDetailContent";
import {
	type ColorTheme,
	DetailActions,
	DetailHero,
	WatchHistoryDialog,
} from "@/components/detail";
import { useTheme } from "@/components/theme-provider";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";
import {
	formatDateWithTimezone,
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
			invalidateUserShelfQueries(queryClient, user?.did);
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
			invalidateUserShelfQueries(queryClient, user?.did);
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
			invalidateUserShelfQueries(queryClient, user?.did);
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

					<MovieDetailContent movie={movie} colors={colors} />
				</div>
			</div>

			<WatchHistoryDialog
				open={showHistoryDialog}
				onOpenChange={setShowHistoryDialog}
				description={`All the times you've watched ${movie?.title}`}
				watchHistory={watchHistory ?? []}
				userTimezone={userTimezone}
				is24Hour={is24Hour}
				onDelete={(trackedMovieId) =>
					deleteWatchEntryMutation.mutate({ path: { trackedMovieId } })
				}
				isDeleting={deleteWatchEntryMutation.isPending}
				onClose={() => setShowHistoryDialog(false)}
			/>

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
