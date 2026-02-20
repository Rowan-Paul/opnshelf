import {
	authControllerMeOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	type TmdbSeasonDetailDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
	useRouter,
} from "@tanstack/react-router";
import { ArrowLeft, Calendar, Star } from "lucide-react";
import { CastSection } from "@/components/CastSection";
import { CrewSection } from "@/components/CrewSection";
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

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: user?.did || "", showId },
		}),
		enabled: !!user?.did,
	});

	const season = seasonData as TmdbSeasonDetailDto | undefined;
	const colors = showData?.colors || {
		primary: "#F59E0B",
		secondary: "#D97706",
		accent: "#FBBF24",
		muted: "#6b7280",
	};
	const backdropUrl = getTmdbBackdropUrl(showData?.backdrop_path);
	const seasonPoster = getTmdbPosterUrl(season?.poster_path, "w500");
	const seasonEpisodes = season?.episodes || [];

	return (
		<div>
			{isLeafRoute && (
				<>
					<div className="relative h-[45vh] md:h-[55vh] overflow-hidden">
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
										background:
											"linear-gradient(to bottom, transparent 0%, rgba(3, 7, 18, 0.65) 60%, rgb(3, 7, 18) 100%)",
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

						<button
							type="button"
							onClick={() => router.history.back()}
							className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors cursor-pointer"
						>
							<ArrowLeft className="w-5 h-5" />
						</button>

						<div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
							<div className="container mx-auto max-w-6xl">
								<div className="flex items-end gap-4 md:gap-8">
									<Link
										to="/shows/$showId/$title"
										params={{ showId, title }}
										className="w-24 md:w-40 rounded-lg overflow-hidden shadow-2xl cursor-pointer transition-transform hover:scale-105"
										style={{
											boxShadow: `0 25px 50px -12px ${colors.primary}40`,
										}}
									>
										{seasonPoster ? (
											<img
												src={seasonPoster}
												alt={season?.name || `Season ${seasonNumber}`}
												className="w-full aspect-2/3 object-cover"
											/>
										) : (
											<div className="w-full aspect-2/3 bg-gray-900 flex items-center justify-center text-gray-600 text-xs">
												No poster
											</div>
										)}
									</Link>
									<div className="pb-2">
										<h1
											className="text-2xl md:text-5xl font-bold mb-2"
											style={{ textShadow: `0 4px 30px ${colors.primary}60` }}
										>
											{showData?.name || title.replace(/-/g, " ")}
										</h1>
										<h2 className="text-lg md:text-2xl text-gray-200">
											Season {seasonNumber}
										</h2>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="container mx-auto px-4 py-6 max-w-6xl">
						<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
							<div className="space-y-4" />

							<div className="space-y-6 min-w-0">
								<div className="flex flex-wrap gap-3">
									{season?.air_date && (
										<div className="rounded-full border border-(--md-sys-color-outline) px-3 py-1.5 text-sm text-gray-300 flex items-center gap-2">
											<Calendar className="w-4 h-4" />
											{formatDateOnly(season.air_date)}
										</div>
									)}
									<div className="rounded-full border border-(--md-sys-color-outline) px-3 py-1.5 text-sm text-gray-300 flex items-center gap-2">
										<span>{seasonEpisodes.length} episodes</span>
									</div>
								</div>

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

								<section>
									<h2
										className="text-xl font-semibold mb-4"
										style={{ color: colors.primary }}
									>
										Episodes
									</h2>
									<div className="grid grid-cols-1 gap-3">
										{seasonEpisodes.map((episode) => {
											const episodeWatches =
												history?.filter(
													(h) =>
														h.seasonNumber === episode.season_number &&
														h.episodeNumber === episode.episode_number,
												).length || 0;

											return (
												<Link
													key={episode.id}
													to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
													params={{
														showId,
														title,
														seasonNumber,
														episodeNumber: String(episode.episode_number),
													}}
													className="group rounded-xl border bg-gray-900/30 hover:bg-gray-900/50 transition-colors overflow-hidden"
													style={{ borderColor: "var(--md-sys-color-outline)" }}
												>
													<div className="grid grid-cols-[120px_1fr] gap-4">
														<div className="h-full bg-gray-900">
															{episode.still_path ? (
																<img
																	src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
																	alt={episode.name}
																	className="w-full h-full object-cover"
																/>
															) : null}
														</div>
														<div className="p-3 min-w-0">
															<div className="flex items-center justify-between gap-2 mb-1">
																<p className="font-medium line-clamp-1">
																	E{episode.episode_number} · {episode.name}
																</p>
																{episode.vote_average ? (
																	<span className="text-xs flex items-center gap-1 text-gray-300">
																		<Star className="w-3 h-3" />
																		{episode.vote_average.toFixed(1)}
																	</span>
																) : null}
															</div>
															<p className="text-xs text-gray-400 line-clamp-2">
																{episode.overview || "No overview available."}
															</p>
															<div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
																<span className="flex items-center gap-1">
																	<Calendar className="w-3 h-3" />
																	{episode.air_date
																		? formatDateOnly(episode.air_date)
																		: "TBA"}
																</span>
																{user ? (
																	<span>{episodeWatches} watched</span>
																) : null}
															</div>
														</div>
													</div>
												</Link>
											);
										})}
									</div>
								</section>

								<CastSection cast={showData?.credits?.cast} colors={colors} />
								<CrewSection crew={showData?.credits?.crew} colors={colors} />
							</div>
						</div>
					</div>
				</>
			)}
			<Outlet />
		</div>
	);
}
