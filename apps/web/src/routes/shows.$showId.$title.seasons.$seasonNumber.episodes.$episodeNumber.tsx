import {
	authControllerMeOptions,
	listsControllerGetListsForItemOptions,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	socialControllerGetWatchersOptions,
	type TmdbEpisodeDto,
	type TmdbShowDetailDto,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddToListModal } from "@/components/AddToListModal";
import { DatePickerModal } from "@/components/DatePickerModal";
import {
	type ColorTheme,
	DetailActions,
	DetailHero,
	EpisodeNav,
	WatchHistoryDialog,
} from "@/components/detail";
import { ShowEpisodeContent } from "@/components/show-episode-detail/ShowEpisodeContent";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";
import {
	buildScopedShowMediaId,
	formatDateWithTimezone,
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
} from "@/lib/utils";

export const Route = createFileRoute(
	"/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber",
)({
	loader: async ({ params, context }) => {
		const { showId, seasonNumber, episodeNumber } = params;
		const { queryClient } = context;

		const showData = await queryClient.fetchQuery({
			...showsControllerGetShowDetailsOptions({
				path: { showId },
			}),
		});

		const episodeData = await queryClient.fetchQuery({
			...showsControllerGetEpisodeDetailsOptions({
				path: { showId, seasonNumber, episodeNumber },
			}),
		});

		return { show: showData, episode: episodeData };
	},
	head: ({ loaderData }) => {
		const show = loaderData?.show as TmdbShowDetailDto | undefined;
		const episode = loaderData?.episode as TmdbEpisodeDto | undefined;
		const showName = show?.name;
		const episodeName = episode?.name;
		const title =
			showName && episodeName
				? `${showName}: ${episodeName} | OpnShelf`
				: "Episode | OpnShelf";
		const posterUrl = episode?.still_path
			? `https://image.tmdb.org/t/p/w780${episode.still_path}`
			: show?.poster_path
				? `https://image.tmdb.org/t/p/w780${show.poster_path}`
				: null;
		const url = typeof window !== "undefined" ? window.location.href : "";

		return {
			meta: [
				{ title },
				{
					name: "description",
					content:
						episode?.overview?.slice(0, 160) ||
						show?.overview?.slice(0, 160) ||
						"",
				},
				{ property: "og:title", content: title },
				{
					property: "og:description",
					content:
						episode?.overview?.slice(0, 160) ||
						show?.overview?.slice(0, 160) ||
						"",
				},
				{ property: "og:type", content: "video.episode" },
				{ property: "og:url", content: url },
				...(posterUrl ? [{ property: "og:image", content: posterUrl }] : []),
				{ property: "og:image:width", content: "780" },
				{ property: "og:image:height", content: "1170" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: title },
				{
					name: "twitter:description",
					content:
						episode?.overview?.slice(0, 160) ||
						show?.overview?.slice(0, 160) ||
						"",
				},
				...(posterUrl ? [{ name: "twitter:image", content: posterUrl }] : []),
				{ name: "twitter:url", content: url },
			],
		};
	},
	component: ShowEpisodePage,
});

function ShowEpisodePage() {
	const { showId, title, seasonNumber, episodeNumber } = Route.useParams();
	const queryClient = useQueryClient();
	const router = useRouter();

	const [showDateModal, setShowDateModal] = useState(false);
	const [showListModal, setShowListModal] = useState(false);
	const [showHistoryDialog, setShowHistoryDialog] = useState(false);

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const resolvedUserDid = user?.did || "";

	const { data: showData } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId },
		}),
	});

	const { data: episode } = useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId, seasonNumber, episodeNumber },
		}),
	});

	const { data: season } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId, seasonNumber },
		}),
	});

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: resolvedUserDid, showId },
		}),
		enabled: !!resolvedUserDid,
	});
	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});
	const scopedEpisodeMediaId = buildScopedShowMediaId(
		showId,
		Number(seasonNumber),
		Number(episodeNumber),
	);

	const { data: listsForShow } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: scopedEpisodeMediaId },
		}),
		enabled: !!user?.did,
	});
	const { data: friendWatchers, isLoading: isFriendWatchersLoading } = useQuery(
		{
			...socialControllerGetWatchersOptions({
				query: {
					mediaType: "show",
					mediaId: scopedEpisodeMediaId,
					pageSize: 8,
				},
			}),
			enabled: !!user?.did,
		},
	);

	const show = showData as TmdbShowDetailDto | undefined;

	const watchedCountForEpisode =
		history?.filter(
			(h) =>
				h.seasonNumber === Number(seasonNumber) &&
				h.episodeNumber === Number(episodeNumber),
		).length || 0;
	const isWatchedEpisode = watchedCountForEpisode > 0;
	const latestEpisodeWatch = useMemo(() => {
		if (!history?.length) return null;
		return (
			history
				.filter(
					(h) =>
						h.seasonNumber === Number(seasonNumber) &&
						h.episodeNumber === Number(episodeNumber),
				)
				.sort(
					(a, b) =>
						new Date(b.watchedDate).getTime() -
						new Date(a.watchedDate).getTime(),
				)[0] ?? null
		);
	}, [history, seasonNumber, episodeNumber]);
	const episodeWatchHistory = useMemo(() => {
		if (!history?.length) return [];
		return history
			.filter(
				(h) =>
					h.seasonNumber === Number(seasonNumber) &&
					h.episodeNumber === Number(episodeNumber),
			)
			.sort(
				(a, b) =>
					new Date(b.watchedDate).getTime() - new Date(a.watchedDate).getTime(),
			);
	}, [history, seasonNumber, episodeNumber]);
	const listsCount = listsForShow?.filter((l) => l.isInList).length ?? 0;
	const userTimezone = userSettings?.timezone || "UTC";
	const is24Hour = userSettings?.timeFormat === "24h";

	const markMutation = useMutation({
		mutationKey: ["shows", showId, "episodes", episodeNumber, "markWatched"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			invalidateUserShelfQueries(queryClient, resolvedUserDid);
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId },
				}),
			});
			toast.success("Episode marked watched");
		},
		onError: () => {
			toast.error("Failed to mark episode watched");
		},
	});
	const unmarkMutation = useMutation({
		mutationKey: ["shows", showId, "episodes", episodeNumber, "unmarkWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			invalidateUserShelfQueries(queryClient, resolvedUserDid);
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId },
				}),
			});
			toast.success("Removed from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf. Please try again.");
		},
	});
	const deleteWatchEntryMutation = useMutation({
		mutationKey: [
			"shows",
			showId,
			"episodes",
			episodeNumber,
			"deleteWatchEntry",
		],
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			invalidateUserShelfQueries(queryClient, resolvedUserDid);
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId },
				}),
			});
			toast.success("Watch entry removed");
		},
		onError: () => {
			toast.error("Failed to remove watch entry. Please try again.");
		},
	});

	const colors: ColorTheme = {
		primary: show?.colors?.primary || "#F59E0B",
		secondary: show?.colors?.secondary || "#D97706",
		accent: show?.colors?.accent || "#FBBF24",
		muted: show?.colors?.muted || "#6b7280",
	};

	const backdropUrl = getTmdbBackdropUrl(show?.backdrop_path);
	const showPoster = getTmdbPosterUrl(show?.poster_path, "w500");
	const stillUrl = episode?.still_path
		? `https://image.tmdb.org/t/p/w780${episode.still_path}`
		: null;

	const handleMarkWatched = () => {
		markMutation.mutate({
			body: {
				showId,
				seasonNumber: Number(seasonNumber),
				episodeNumber: Number(episodeNumber),
			},
		});
	};
	const handleUnmarkWatched = () => {
		unmarkMutation.mutate({
			path: { showId },
			query: {
				mode: "all",
				seasonNumber,
				episodeNumber,
			},
		});
	};

	const seasonEpisodeContext = useMemo(() => {
		if (!season?.episodes?.length)
			return {
				previous: null,
				current: null,
				next: null,
				previousContext: null,
				nextContext: null,
			};
		const sortedEpisodes = [...season.episodes].sort(
			(a, b) => a.episode_number - b.episode_number,
		);
		const currentIndex = sortedEpisodes.findIndex(
			(e) => e.episode_number === Number(episodeNumber),
		);
		if (currentIndex < 0)
			return {
				previous: null,
				current: null,
				next: null,
				previousContext: null,
				nextContext: null,
			};

		const previousEp = sortedEpisodes[currentIndex - 1] ?? null;
		const nextEp = sortedEpisodes[currentIndex + 1] ?? null;

		const apiContext = (
			episode as {
				_context?: {
					previous: { seasonNumber: number; episodeNumber: number } | null;
					next: { seasonNumber: number; episodeNumber: number } | null;
				};
			}
		)?._context;

		return {
			previous: previousEp,
			current: sortedEpisodes[currentIndex] ?? null,
			next: nextEp,
			previousContext: apiContext?.previous ?? null,
			nextContext: apiContext?.next ?? null,
		};
	}, [season?.episodes, episodeNumber, episode]);

	const formattedWatchedDate = useMemo(() => {
		if (!latestEpisodeWatch) return null;
		return formatDateWithTimezone(latestEpisodeWatch.watchedDate, {
			timezone: userTimezone,
			is24Hour,
		});
	}, [latestEpisodeWatch, userTimezone, is24Hour]);

	return (
		<div>
			<DetailHero
				title={show?.name || ""}
				subtitle={`S${seasonNumber} · E${episodeNumber}: ${episode?.name || ""}`}
				backdropUrl={stillUrl || backdropUrl}
				posterUrl={showPoster}
				posterLinkTo={{
					to: "/shows/$showId/$title",
					params: { showId, title },
				}}
				colors={colors}
				onBack={() => router.history.back()}
			/>

			<div className="container mx-auto px-4 py-6 max-w-7xl">
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
					<div className="space-y-4 min-w-0 max-w-[300px]">
						<DetailActions
							mediaType="episode"
							mediaId={scopedEpisodeMediaId}
							seasonNumber={seasonNumber}
							episodeNumber={episodeNumber}
							colors={colors}
							isWatched={isWatchedEpisode}
							watchedDate={formattedWatchedDate}
							totalWatches={episodeWatchHistory.length}
							onMarkWatched={handleMarkWatched}
							onUnmarkWatched={handleUnmarkWatched}
							onShowDatePicker={() => setShowDateModal(true)}
							isMarkingPending={markMutation.isPending}
							isUnmarkingPending={unmarkMutation.isPending}
							listsCount={listsCount}
							onShowListModal={() => setShowListModal(true)}
							onViewHistory={() => setShowHistoryDialog(true)}
							isLoggedIn={!!user}
							onLogin={() => router.navigate({ to: "/login" })}
						/>

						{seasonEpisodeContext.current ? (
							<EpisodeNav
								showId={showId}
								title={title}
								seasonNumber={seasonNumber}
								previousEpisode={seasonEpisodeContext.previous}
								currentEpisode={seasonEpisodeContext.current}
								nextEpisode={seasonEpisodeContext.next}
								previousContext={seasonEpisodeContext.previousContext}
								nextContext={seasonEpisodeContext.nextContext}
								colors={colors}
								variant="sidebar"
							/>
						) : null}
					</div>

					<ShowEpisodeContent
						show={show}
						episode={episode}
						showId={showId}
						title={title}
						seasonNumber={seasonNumber}
						episodeNumber={episodeNumber}
						colors={colors}
						friendWatchers={friendWatchers}
						isFriendWatchersLoading={isFriendWatchersLoading}
					/>
				</div>
			</div>

			<DatePickerModal
				open={showDateModal}
				onClose={() => setShowDateModal(false)}
				mode="episode"
				showId={showId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				userDid={user?.did}
				modalTitle="Select Watch Date"
			/>

			{user && (
				<AddToListModal
					open={showListModal}
					onOpenChange={setShowListModal}
					mediaType="show"
					mediaId={scopedEpisodeMediaId}
					mediaTitle={show?.name || "Show"}
					user={user}
				/>
			)}

			<WatchHistoryDialog
				open={showHistoryDialog}
				onOpenChange={setShowHistoryDialog}
				description="All watches for this episode"
				watchHistory={episodeWatchHistory}
				userTimezone={userTimezone}
				is24Hour={is24Hour}
				onDelete={(trackedEpisodeId) =>
					deleteWatchEntryMutation.mutate({ path: { trackedEpisodeId } })
				}
				isDeleting={deleteWatchEntryMutation.isPending}
				onClose={() => setShowHistoryDialog(false)}
			/>
		</div>
	);
}
