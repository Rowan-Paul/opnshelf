import {
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronRight, Loader2, Play, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { withUserLocale } from "#/lib/date-utils";
import {
	useMarkEpisodeWatched,
	useShowDetails,
	useUnmarkEpisodeWatched,
	useUserUpNext,
	useWatchActions,
} from "#/lib/hooks";
import { buildSeasonPageMeta } from "#/lib/media-meta";
import { buildSeasonUrl, buildShowUrl, slugifyName } from "#/lib/url-utils";
import DetailsCard from "../../../../../components/DetailsCard";
import ErrorState from "../../../../../components/ErrorState";
import LoadingState from "../../../../../components/LoadingState";
import MediaHero from "../../../../../components/MediaHero";
import EpisodeList from "../../../../../components/shows/EpisodeList";

setupApiClient();

export const Route = createFileRoute(
	"/shows/$showId/$showName/seasons/$seasonNumber/",
)({
	loader: async ({ context, params }) => {
		const [show, season] = await Promise.all([
			context.queryClient.ensureQueryData(
				showsControllerGetShowDetailsOptions({
					path: { showId: params.showId },
				}),
			),
			context.queryClient.ensureQueryData(
				showsControllerGetSeasonDetailsOptions({
					path: {
						showId: params.showId,
						seasonNumber: params.seasonNumber,
					},
				}),
			),
		]);

		return { show, season };
	},
	head: ({ loaderData, params }) => {
		const meta = buildSeasonPageMeta(
			loaderData?.show,
			loaderData?.season,
			params.seasonNumber,
		);

		return {
			meta: [
				{ title: meta.title },
				{
					name: "description",
					content: meta.description,
				},
			],
		};
	},
	component: SeasonDetailPage,
});

function formatDate(dateString: string, timezone?: string): string {
	if (!dateString) return "Unknown";
	try {
		return new Date(dateString).toLocaleDateString(
			"en-US",
			withUserLocale(
				{ month: "long", day: "numeric", year: "numeric" },
				timezone,
			),
		);
	} catch {
		return dateString;
	}
}

function useSeasonDetails(showId: string, seasonNumber: string) {
	return useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId, seasonNumber },
		}),
		enabled: !!showId && !!seasonNumber,
	});
}

function SeasonDetailPage() {
	const { showId, showName, seasonNumber } = Route.useParams();
	const { user, userSettings, isAuthenticated } = useAuth();
	const userDid = user?.did || "";
	const userTimezone = userSettings?.timezone;

	const seasonNum = Number.parseInt(seasonNumber, 10);

	const [processingEpisode, setProcessingEpisode] = useState<{
		seasonNumber: number;
		episodeNumber: number;
	} | null>(null);
	const [unmarkingEpisode, setUnmarkingEpisode] = useState<{
		seasonNumber: number;
		episodeNumber: number;
	} | null>(null);
	const [processingSeason, setProcessingSeason] = useState(false);

	const {
		data: show,
		isLoading: showLoading,
		error: showError,
	} = useShowDetails(showId);

	const {
		data: season,
		isLoading: seasonLoading,
		error: seasonError,
	} = useSeasonDetails(showId, seasonNumber);

	const { data: upNextData } = useUserUpNext(userDid);

	// Watch history query
	const { data: watchHistory } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: userDid || "", showId },
		}),
		enabled: !!userDid && !!showId,
	});

	// Watch actions
	const {
		markSeasonWatched,
		unmarkSeasonWatched,
		isMarkSeasonPending,
		isUnmarkShowPending,
	} = useWatchActions({ mediaType: "show", showId });

	const markEpisodeMutation = useMarkEpisodeWatched();
	const unmarkEpisodeMutation = useUnmarkEpisodeWatched();

	// Season-specific watch history
	const seasonWatchHistory = useMemo(() => {
		if (!watchHistory || !Array.isArray(watchHistory)) return [];
		return watchHistory.filter(
			(ep: { seasonNumber: number }) => ep.seasonNumber === seasonNum,
		);
	}, [watchHistory, seasonNum]);

	const episodesWatched = seasonWatchHistory.length;
	const totalEpisodes = season?.episodes?.length || 0;
	const rawProgressPercentage =
		totalEpisodes > 0 ? (episodesWatched / totalEpisodes) * 100 : 0;
	const progressPercentage = Math.max(0, Math.min(100, rawProgressPercentage));
	const episodesRemaining = Math.max(0, totalEpisodes - episodesWatched);

	// Next unwatched episode in this season
	const nextUnwatchedEpisode = useMemo(() => {
		if (!season?.episodes) return null;
		const watchedEpisodeNumbers = new Set(
			seasonWatchHistory.map(
				(ep: { episodeNumber: number }) => ep.episodeNumber,
			),
		);
		return (
			season.episodes.find(
				(ep) => !watchedEpisodeNumbers.has(ep.episode_number),
			) || null
		);
	}, [season?.episodes, seasonWatchHistory]);

	// Up next for this show
	const upNextForShow = upNextData?.items?.find(
		(item) => item.showId === showId,
	);
	const nextEpisode = upNextForShow?.nextEpisode;

	// Determine the "current" episode for this season
	const currentSeasonEpisode = useMemo(() => {
		if (nextEpisode?.seasonNumber === seasonNum) {
			return nextEpisode;
		}
		if (nextUnwatchedEpisode) {
			return {
				seasonNumber: seasonNum,
				episodeNumber: nextUnwatchedEpisode.episode_number,
			};
		}
		return null;
	}, [nextEpisode, nextUnwatchedEpisode, seasonNum]);

	// Season navigation
	const sortedSeasons = useMemo(() => {
		if (!show?.seasons) return [];
		return show.seasons
			.filter((s) => s.season_number > 0)
			.sort((a, b) => a.season_number - b.season_number);
	}, [show?.seasons]);

	const currentSeasonIndex = sortedSeasons.findIndex(
		(s) => s.season_number === seasonNum,
	);
	const previousSeason =
		currentSeasonIndex > 0 ? sortedSeasons[currentSeasonIndex - 1] : null;
	const nextSeason =
		currentSeasonIndex >= 0 && currentSeasonIndex < sortedSeasons.length - 1
			? sortedSeasons[currentSeasonIndex + 1]
			: null;

	const handleMarkEpisode = (seasonNumber: number, episodeNumber: number) => {
		if (!isAuthenticated) return;
		setProcessingEpisode({ seasonNumber, episodeNumber });
		markEpisodeMutation.mutate(
			{
				body: { showId, seasonNumber, episodeNumber },
			},
			{
				onSettled: () => setProcessingEpisode(null),
			},
		);
	};

	const handleUnmarkEpisode = (seasonNumber: number, episodeNumber: number) => {
		if (!isAuthenticated) return;
		setUnmarkingEpisode({ seasonNumber, episodeNumber });
		unmarkEpisodeMutation.mutate(
			{
				path: { showId, seasonNumber, episodeNumber },
			},
			{
				onSettled: () => setUnmarkingEpisode(null),
			},
		);
	};

	const handleMarkSeasonWatched = () => {
		if (!isAuthenticated) return;
		setProcessingSeason(true);
		markSeasonWatched(seasonNum);
		setTimeout(() => setProcessingSeason(false), 2000);
	};

	const handleUnmarkSeasonWatched = () => {
		if (!isAuthenticated) return;
		setProcessingSeason(true);
		unmarkSeasonWatched(seasonNum);
		setTimeout(() => setProcessingSeason(false), 2000);
	};

	const getContinueButtonText = () => {
		if (currentSeasonEpisode) {
			return `Continue S${currentSeasonEpisode.seasonNumber}E${currentSeasonEpisode.episodeNumber}`;
		}
		if (episodesWatched > 0) {
			return "Continue Watching";
		}
		return "Start Season";
	};

	const getContinueButtonLink = () => {
		if (currentSeasonEpisode) {
			return {
				to: "/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber" as const,
				params: {
					showId,
					showName: slugifyName(show?.name || showName),
					seasonNumber: String(currentSeasonEpisode.seasonNumber),
					episodeNumber: String(currentSeasonEpisode.episodeNumber),
				},
			};
		}
		// Default to S1E1 of this season
		return {
			to: "/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber" as const,
			params: {
				showId,
				showName: slugifyName(show?.name || showName),
				seasonNumber,
				episodeNumber: "1",
			},
		};
	};

	if (showLoading || seasonLoading) return <LoadingState />;
	if (showError || seasonError || !show || !season) {
		return (
			<ErrorState
				message="Failed to load season"
				backTo={buildShowUrl(showId, show?.name || showName)}
				backLabel="Back to Show"
			/>
		);
	}

	const backdropUrl = show.backdrop_path
		? `https://image.tmdb.org/t/p/original${show.backdrop_path}`
		: show.poster_path
			? `https://image.tmdb.org/t/p/original${show.poster_path}`
			: "";
	const posterUrl = season.poster_path
		? `https://image.tmdb.org/t/p/w500${season.poster_path}`
		: show.poster_path
			? `https://image.tmdb.org/t/p/w500${show.poster_path}`
			: "";

	// Air date range
	const firstEpisode = season.episodes?.[0];
	const lastEpisode = season.episodes?.[season.episodes.length - 1];
	const airDateRange =
		firstEpisode?.air_date && lastEpisode?.air_date
			? firstEpisode.air_date !== lastEpisode.air_date
				? `${formatDate(firstEpisode.air_date, userTimezone)} – ${formatDate(lastEpisode.air_date, userTimezone)}`
				: formatDate(firstEpisode.air_date, userTimezone)
			: season.air_date
				? formatDate(season.air_date, userTimezone)
				: "Unknown";

	const continueLink = getContinueButtonLink();

	return (
		<div className="min-h-screen pb-8">
			<MediaHero
				title={`${show.name} — ${season.name}`}
				backdropUrl={backdropUrl}
				posterUrl={posterUrl}
				metaItems={
					<>
						<div className="flex items-center gap-1">
							<Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
							<span className="font-semibold">
								{season.vote_average?.toFixed(1) || "N/A"}
							</span>
							<span className="text-[var(--foreground-muted)]">/10</span>
						</div>
						<span className="text-[var(--border-strong)]">•</span>
						<span>
							{season.episodes?.length || 0} Episode
							{season.episodes?.length !== 1 ? "s" : ""}
						</span>
						<span className="text-[var(--border-strong)]">•</span>
						<span>{airDateRange}</span>
						<span className="text-[var(--border-strong)]">•</span>
						<span className="badge badge-accent">
							{
								// @ts-expect-error - status may exist on TMDB result
								show.status || "Unknown"
							}
						</span>
					</>
				}
				actions={
					<>
						<Link
							to={continueLink.to}
							params={continueLink.params}
							className="btn btn-primary gap-2"
						>
							<Play className="h-4 w-4" />
							{getContinueButtonText()}
						</Link>
						{progressPercentage < 100 ? (
							<button
								type="button"
								onClick={handleMarkSeasonWatched}
								disabled={
									!isAuthenticated || isMarkSeasonPending || processingSeason
								}
								className="btn btn-secondary gap-2"
							>
								{processingSeason || isMarkSeasonPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Loading
									</>
								) : (
									<>
										<Check className="h-4 w-4" />
										Mark Season Watched
									</>
								)}
							</button>
						) : (
							<button
								type="button"
								onClick={handleUnmarkSeasonWatched}
								disabled={
									!isAuthenticated || isUnmarkShowPending || processingSeason
								}
								className="btn btn-secondary gap-2"
							>
								{processingSeason || isUnmarkShowPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Loading
									</>
								) : (
									<>
										<X className="h-4 w-4" />
										Unmark Season Watched
									</>
								)}
							</button>
						)}
					</>
				}
				breadcrumbs={[
					{
						label: show.name,
						to: buildShowUrl(showId, show.name),
					},
					{
						label: season.name,
						to: buildSeasonUrl(showId, show.name, seasonNum),
					},
				]}
			/>

			{/* Main Content */}
			<div className="container-app relative z-20 mt-8">
				<div className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:gap-12">
					{/* Left Column */}
					<div className="space-y-8">
						{/* Overview */}
						{season.overview && (
							<section>
								<h2 className="text-display-3 mb-4">Overview</h2>
								<p className="text-[var(--foreground-muted)] leading-relaxed">
									{season.overview}
								</p>
							</section>
						)}

						{/* Episodes */}
						{season.episodes && season.episodes.length > 0 && (
							<section>
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-display-3">Episodes</h2>
									{isAuthenticated && (
										<div className="flex gap-2">
											{progressPercentage < 100 ? (
												<button
													type="button"
													onClick={handleMarkSeasonWatched}
													disabled={
														!isAuthenticated ||
														isMarkSeasonPending ||
														processingSeason
													}
													className="btn btn-secondary h-8 px-3 text-xs gap-1.5"
												>
													{processingSeason || isMarkSeasonPending ? (
														<Loader2 className="h-3 w-3 animate-spin" />
													) : (
														<Check className="h-3.5 w-3.5" />
													)}
													Mark All
												</button>
											) : (
												<button
													type="button"
													onClick={handleUnmarkSeasonWatched}
													disabled={
														!isAuthenticated ||
														isUnmarkShowPending ||
														processingSeason
													}
													className="btn btn-secondary h-8 px-3 text-xs gap-1.5"
												>
													{processingSeason || isUnmarkShowPending ? (
														<Loader2 className="h-3 w-3 animate-spin" />
													) : (
														<X className="h-3.5 w-3.5" />
													)}
													Unmark All
												</button>
											)}
										</div>
									)}
								</div>
								<div className="card overflow-hidden">
									<EpisodeList
										episodes={season.episodes}
										showId={showId}
										showName={slugifyName(show.name)}
										seasonNumber={seasonNum}
										watchHistory={watchHistory}
										nextEpisode={currentSeasonEpisode || null}
										onMarkEpisode={handleMarkEpisode}
										onUnmarkEpisode={handleUnmarkEpisode}
										processingEpisode={processingEpisode}
										unmarkingEpisode={unmarkingEpisode}
										isLoading={false}
									/>
								</div>
							</section>
						)}
					</div>

					{/* Right Column - Sidebar */}
					<div className="space-y-6">
						{/* Your Progress */}
						{isAuthenticated && (
							<section className="card p-5">
								<h3 className="font-display font-semibold mb-4">
									Your Progress
								</h3>
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<span className="text-sm text-[var(--foreground-muted)]">
											Episodes Watched
										</span>
										<span className="font-semibold">
											{episodesWatched}/{totalEpisodes}
										</span>
									</div>
									<div className="h-2 w-full rounded-full bg-[var(--background-subtle)]">
										<div
											className="h-full rounded-full bg-[var(--accent)]"
											style={{ width: `${progressPercentage}%` }}
										/>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-[var(--foreground-muted)]">
											{Math.round(progressPercentage)}% complete
										</span>
										<span className="text-[var(--foreground-muted)]">
											{episodesRemaining} remaining
										</span>
									</div>
									{progressPercentage < 100 ? (
										<button
											type="button"
											onClick={handleMarkSeasonWatched}
											disabled={
												!isAuthenticated ||
												isMarkSeasonPending ||
												processingSeason
											}
											className="mt-4 w-full btn btn-secondary gap-2"
										>
											{processingSeason || isMarkSeasonPending ? (
												<>
													<Loader2 className="h-4 w-4 animate-spin" />
													Loading
												</>
											) : (
												<>
													<Check className="h-4 w-4" />
													Mark Season Watched
												</>
											)}
										</button>
									) : (
										<button
											type="button"
											onClick={handleUnmarkSeasonWatched}
											disabled={
												!isAuthenticated ||
												isUnmarkShowPending ||
												processingSeason
											}
											className="mt-4 w-full btn btn-secondary gap-2"
										>
											{processingSeason || isUnmarkShowPending ? (
												<>
													<Loader2 className="h-4 w-4 animate-spin" />
													Loading
												</>
											) : (
												<>
													<X className="h-4 w-4" />
													Unmark Season Watched
												</>
											)}
										</button>
									)}
								</div>
							</section>
						)}

						{/* Season Details */}
						<DetailsCard
							title="Season Details"
							items={[
								{
									label: "Season Number",
									value: season.season_number,
								},
								{
									label: "Episodes",
									value: season.episodes?.length || 0,
								},
								{
									label: "Air Date",
									value: season.air_date
										? formatDate(season.air_date, userTimezone)
										: "Unknown",
								},
								{
									label: "Rating",
									value: season.vote_average
										? `${season.vote_average.toFixed(1)}/10`
										: "N/A",
								},
							]}
						/>

						{/* Season Navigation */}
						<section className="card p-5">
							<h3 className="font-display font-semibold mb-4">
								Season Navigation
							</h3>
							<div className="space-y-3">
								{previousSeason ? (
									<Link
										to="/shows/$showId/$showName/seasons/$seasonNumber"
										params={{
											showId,
											showName: slugifyName(show.name),
											seasonNumber: String(previousSeason.season_number),
										}}
										className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
									>
										<ChevronRight className="h-4 w-4 rotate-180" />← Previous
										Season ({previousSeason.name})
									</Link>
								) : (
									<span className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] opacity-50">
										<ChevronRight className="h-4 w-4 rotate-180" />← Previous
										Season
									</span>
								)}
								{nextSeason ? (
									<Link
										to="/shows/$showId/$showName/seasons/$seasonNumber"
										params={{
											showId,
											showName: slugifyName(show.name),
											seasonNumber: String(nextSeason.season_number),
										}}
										className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--accent)] transition-colors"
									>
										Next Season ({nextSeason.name}) →
										<ChevronRight className="h-4 w-4" />
									</Link>
								) : (
									<span className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] opacity-50">
										Next Season →
										<ChevronRight className="h-4 w-4" />
									</span>
								)}
							</div>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
