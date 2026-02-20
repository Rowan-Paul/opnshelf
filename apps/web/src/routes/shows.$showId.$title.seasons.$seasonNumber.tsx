import {
	authControllerMeOptions,
	listsControllerGetListsForItemOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkSeasonWatchedMutation,
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
import {
	type ColorTheme,
	DetailActions,
	DetailHero,
	EpisodeCard,
	MetadataPills,
	SeasonNav,
} from "@/components/detail";
import { GenresSection } from "@/components/GenresSection";
import { useTheme } from "@/components/theme-provider";
import {
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
		const showName = loaderData?.show?.name;
		const seasonNumber = params.seasonNumber;
		const title = showName
			? `${showName}: Season ${seasonNumber} | OpnShelf`
			: `Season ${seasonNumber} | OpnShelf`;

		return {
			meta: [{ title }],
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

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: user?.did || "", showId },
		}),
		enabled: !!user?.did,
	});

	const { data: listsForShow } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: showId },
		}),
		enabled: !!user?.did,
	});

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
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: user?.did || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["showsControllerGetShowWatchHistory"],
			});
			toast.success(`Marked ${data.count} episodes as watched`);
		},
		onError: () => {
			toast.error("Failed to mark season as watched. Please try again.");
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

					<div className="container mx-auto px-4 py-6 max-w-6xl">
						<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
							<div className="space-y-4 min-w-0">
								<DetailActions
									mediaType="season"
									mediaId={showId}
									seasonNumber={seasonNumber}
									colors={colors}
									isWatched={watchedEpisodeCount > 0}
									watchedDate={null}
									totalWatches={watchedEpisodeCount}
									onMarkWatched={handleMarkWatched}
									onShowDatePicker={() => {}}
									isMarkingPending={markSeasonWatchedMutation.isPending}
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

								<section>
									<h2
										className="text-xl font-semibold mb-3"
										style={{ color: colors.primary }}
									>
										Overview
									</h2>
									<p className="text-gray-300 leading-relaxed">
										{season?.overview || "No season overview available."}
									</p>
								</section>

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
					mediaId={showId}
					mediaTitle={show?.name || ""}
					user={user}
				/>
			)}
		</div>
	);
}
