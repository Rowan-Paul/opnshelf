import {
	authControllerMeOptions,
	listsControllerGetListsForItemOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	socialControllerGetWatchersOptions,
	type TmdbSeasonDetailDto,
	type TmdbShowDetailDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Outlet,
	useMatches,
	useRouter,
} from "@tanstack/react-router";
import { Calendar, Film } from "lucide-react";
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
	EpisodeCard,
	FriendWatchersRow,
	MetadataPills,
	SeasonNav,
	TrailerSection,
} from "@/components/detail";
import { GenresSection } from "@/components/GenresSection";
import { useTheme } from "@/components/theme-provider";
import { invalidateUserShelfQueries } from "@/lib/invalidate-shelf";
import {
	buildScopedShowMediaId,
	formatDateOnly,
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
} from "@/lib/utils";

export const Route = createFileRoute(
	"/shows/$showId/$title/seasons/$seasonNumber",
)({
	loader: async ({ params, context }) => {
		const { showId, seasonNumber } = params;
		const { queryClient } = context;

		const showData = await queryClient.fetchQuery({
			...showsControllerGetShowDetailsOptions({
				path: { showId },
			}),
		});

		const seasonData = await queryClient.fetchQuery({
			...showsControllerGetSeasonDetailsOptions({
				path: { showId, seasonNumber },
			}),
		});

		return { show: showData, season: seasonData };
	},
	head: ({ loaderData, params }) => {
		const show = loaderData?.show as TmdbShowDetailDto | undefined;
		const season = loaderData?.season as TmdbSeasonDetailDto | undefined;
		const showName = show?.name;
		const seasonNumber = params.seasonNumber;
		const title = showName
			? `${showName}: Season ${seasonNumber} | OpnShelf`
			: `Season ${seasonNumber} | OpnShelf`;
		const posterUrl = show?.poster_path
			? `https://image.tmdb.org/t/p/w780${show.poster_path}`
			: null;
		const url = typeof window !== "undefined" ? window.location.href : "";

		return {
			meta: [
				{ title },
				{
					name: "description",
					content:
						season?.overview?.slice(0, 160) ||
						show?.overview?.slice(0, 160) ||
						"",
				},
				{ property: "og:title", content: title },
				{
					property: "og:description",
					content:
						season?.overview?.slice(0, 160) ||
						show?.overview?.slice(0, 160) ||
						"",
				},
				{ property: "og:type", content: "video.tv" },
				{ property: "og:url", content: url },
				...(posterUrl ? [{ property: "og:image", content: posterUrl }] : []),
				{ property: "og:image:width", content: "780" },
				{ property: "og:image:height", content: "1170" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: title },
				{
					name: "twitter:description",
					content:
						season?.overview?.slice(0, 160) ||
						show?.overview?.slice(0, 160) ||
						"",
				},
				...(posterUrl ? [{ name: "twitter:image", content: posterUrl }] : []),
				{ name: "twitter:url", content: url },
			],
		};
	},
	component: ShowSeasonPage,
});

function ShowSeasonPage() {
	const { showId, title, seasonNumber } = Route.useParams();
	const matches = useMatches();
	const isLeafRoute = matches[matches.length - 1]?.routeId === Route.id;
	const router = useRouter();
	const queryClient = useQueryClient();
	const { seedColor } = useTheme();

	const [showListModal, setShowListModal] = useState(false);
	const [showDateModal, setShowDateModal] = useState(false);

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: seasonData } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId, seasonNumber },
		}),
	});

	const { data: showData } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId },
		}),
	});

	const show = showData as TmdbShowDetailDto | undefined;
	const season = seasonData as TmdbSeasonDetailDto | undefined;
	const scopedSeasonMediaId = buildScopedShowMediaId(
		showId,
		Number(seasonNumber),
	);

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: user?.did || "", showId },
		}),
		enabled: !!user?.did,
	});

	const { data: listsForShow } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: scopedSeasonMediaId },
		}),
		enabled: !!user?.did,
	});
	const { data: friendWatchers, isLoading: isFriendWatchersLoading } = useQuery(
		{
			...socialControllerGetWatchersOptions({
				query: {
					mediaType: "show",
					mediaId: scopedSeasonMediaId,
					pageSize: 8,
				},
			}),
			enabled: !!user?.did,
		},
	);

	const listsCount = listsForShow?.filter((l) => l.isInList).length ?? 0;

	const colors: ColorTheme = {
		primary: show?.colors?.primary || seedColor,
		secondary: show?.colors?.secondary || seedColor,
		accent: show?.colors?.accent || seedColor,
		muted: show?.colors?.muted || "#6b7280",
	};

	const backdropUrl = getTmdbBackdropUrl(show?.backdrop_path);
	const seasonPoster = getTmdbPosterUrl(season?.poster_path, "w500");
	const seasonEpisodes = season?.episodes || [];

	const markSeasonWatchedMutation = useMutation({
		mutationKey: [
			"shows",
			showId,
			"seasons",
			seasonNumber,
			"markSeasonWatched",
		],
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			invalidateUserShelfQueries(queryClient, user?.did);
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: user?.did || "", showId },
				}),
			});
			toast.success(`Marked ${data.count} episodes as watched`);
		},
		onError: () => {
			toast.error("Failed to mark season as watched. Please try again.");
		},
	});

	const unmarkSeasonWatchedMutation = useMutation({
		mutationKey: [
			"shows",
			showId,
			"seasons",
			seasonNumber,
			"unmarkSeasonWatched",
		],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			invalidateUserShelfQueries(queryClient, user?.did);
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: user?.did || "", showId },
				}),
			});
			toast.success("Removed season from your shelf");
		},
		onError: () => {
			toast.error("Failed to remove from shelf. Please try again.");
		},
	});

	const handleMarkWatched = () => {
		markSeasonWatchedMutation.mutate({
			body: {
				showId,
				seasonNumber: Number(seasonNumber),
			},
		});
	};

	const handleUnmarkWatched = () => {
		unmarkSeasonWatchedMutation.mutate({
			path: { showId },
			query: {
				mode: "all",
				seasonNumber: seasonNumber,
			},
		});
	};

	const watchedEpisodeCount = useMemo(() => {
		if (!history) return 0;
		return history.filter((h) => h.seasonNumber === Number(seasonNumber))
			.length;
	}, [history, seasonNumber]);

	const episodeWatchedCounts = useMemo(() => {
		if (!history) return new Map<number, number>();
		const counts = new Map<number, number>();
		for (const h of history) {
			if (h.seasonNumber === Number(seasonNumber)) {
				const current = counts.get(h.episodeNumber) ?? 0;
				counts.set(h.episodeNumber, current + 1);
			}
		}
		return counts;
	}, [history, seasonNumber]);

	const metadataItems = useMemo(() => {
		const items = [];
		if (season?.air_date) {
			items.push({
				icon: <Calendar className="w-4 h-4" />,
				label: formatDateOnly(season.air_date),
			});
		}
		if (seasonEpisodes.length > 0) {
			items.push({
				icon: <Film className="w-4 h-4" />,
				label: `${seasonEpisodes.length} episodes`,
			});
		}
		return items;
	}, [season?.air_date, seasonEpisodes.length]);

	return (
		<div>
			{isLeafRoute && (
				<>
					<DetailHero
						title={show?.name || title.replace(/-/g, " ")}
						subtitle={`Season ${seasonNumber}`}
						backdropUrl={backdropUrl}
						posterUrl={seasonPoster}
						posterLinkTo={{
							to: "/shows/$showId/$title",
							params: { showId, title },
						}}
						colors={colors}
						onBack={() => router.history.back()}
					/>

					<div className="container mx-auto px-4 py-6 max-w-7xl">
						<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
							<div className="space-y-4 min-w-0">
								<DetailActions
									mediaType="season"
									mediaId={scopedSeasonMediaId}
									seasonNumber={seasonNumber}
									colors={colors}
									isWatched={watchedEpisodeCount > 0}
									watchedDate={null}
									totalWatches={watchedEpisodeCount}
									onMarkWatched={handleMarkWatched}
									onUnmarkWatched={handleUnmarkWatched}
									onShowDatePicker={() => setShowDateModal(true)}
									isMarkingPending={markSeasonWatchedMutation.isPending}
									isUnmarkingPending={unmarkSeasonWatchedMutation.isPending}
									listsCount={listsCount}
									onShowListModal={() => setShowListModal(true)}
									isLoggedIn={!!user}
									onLogin={() => router.navigate({ to: "/login" })}
								/>

								{(show?.number_of_seasons ?? 0) > 1 && (
									<SeasonNav
										showId={showId}
										title={title}
										currentSeason={Number(seasonNumber)}
										totalSeasons={show?.number_of_seasons ?? 1}
									/>
								)}
							</div>

							<div className="space-y-6 min-w-0">
								<MetadataPills items={metadataItems} />
								<FriendWatchersRow
									watchers={friendWatchers}
									isLoading={isFriendWatchersLoading}
									colors={colors}
								/>

								<section>
									<h2
										className="text-xl font-semibold mb-3"
										style={{ color: colors.primary }}
									>
										Overview
									</h2>
									<p className="text-(--md-sys-color-on-surface-variant) leading-relaxed">
										{season?.overview || "No season overview available."}
									</p>
								</section>

								<TrailerSection
									mediaType="season"
									detailTrailer={season?.trailer}
									showTrailer={show?.trailer}
									titleColor={colors.primary}
								/>
								<GenresSection genres={show?.genres} colors={colors} />

								{seasonEpisodes.length > 0 && (
									<section>
										<h2
											className="text-xl font-semibold mb-4"
											style={{ color: colors.primary }}
										>
											Episodes
										</h2>
										<div className="space-y-3">
											{seasonEpisodes.map((episode) => (
												<EpisodeCard
													key={episode.id}
													showId={showId}
													title={title}
													seasonNumber={seasonNumber}
													episode={episode}
													watchedCount={
														episodeWatchedCounts.get(episode.episode_number) ??
														0
													}
													colors={colors}
													userDid={user?.did}
												/>
											))}
										</div>
									</section>
								)}

								<CastSection cast={show?.credits?.cast} colors={colors} />
								<CrewSection crew={show?.credits?.crew} colors={colors} />
							</div>
						</div>
					</div>
				</>
			)}
			<Outlet />

			{user && (
				<AddToListModal
					open={showListModal}
					onOpenChange={setShowListModal}
					mediaType="show"
					mediaId={scopedSeasonMediaId}
					mediaTitle={show?.name || ""}
					user={user}
				/>
			)}

			<DatePickerModal
				open={showDateModal}
				onClose={() => setShowDateModal(false)}
				mode="season"
				showId={showId}
				seasonNumber={seasonNumber}
				userDid={user?.did}
				modalTitle="Select Watch Date"
			/>
		</div>
	);
}
