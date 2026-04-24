import {
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronRight, Loader2, Play, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { withUserLocale } from "#/lib/date-utils";
import {
	useDiscoverShows,
	useMarkEpisodeWatched,
	useShowDetails,
	useUnmarkEpisodeWatched,
	useUserUpNext,
	useWatchActions,
} from "#/lib/hooks";
import { buildShowPageMeta } from "#/lib/media-meta";
import { slugifyName } from "#/lib/url-utils";
import CastGrid from "../../../../components/CastGrid";
import DetailsCard from "../../../../components/DetailsCard";
import ErrorState from "../../../../components/ErrorState";
import InYourLists from "../../../../components/InYourLists";
import LoadingState from "../../../../components/LoadingState";
import MediaActionsBar from "../../../../components/MediaActionsBar";
import MediaHero from "../../../../components/MediaHero";
import SimilarMediaGrid from "../../../../components/SimilarMediaGrid";
import EpisodeList from "../../../../components/shows/EpisodeList";
import SeasonAccordion from "../../../../components/shows/SeasonAccordion";

setupApiClient();

export const Route = createFileRoute("/shows/$showId/$showName/")({
	loader: async ({ context, params }) => {
		return context.queryClient.ensureQueryData(
			showsControllerGetShowDetailsOptions({
				path: { showId: params.showId },
			}),
		);
	},
	head: ({ loaderData, params }) => {
		const meta = buildShowPageMeta(loaderData, params.showName);

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
	component: ShowDetailPage,
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

function useSeasonDetails(showId: string, seasonNumber: number | null) {
	return useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId, seasonNumber: seasonNumber?.toString() || "1" },
		}),
		enabled: !!showId && !!seasonNumber,
	});
}

function ShowDetailPage() {
	const { showId } = Route.useParams();
	const { user, userSettings, isAuthenticated } = useAuth();
	const userDid = user?.did || "";
	const userTimezone = userSettings?.timezone;

	const [hasUserToggledSeason, setHasUserToggledSeason] = useState(false);
	const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
	const [processingSeason, setProcessingSeason] = useState<number | null>(null);
	const [processingEpisode, setProcessingEpisode] = useState<{
		seasonNumber: number;
		episodeNumber: number;
	} | null>(null);
	const [unmarkingEpisode, setUnmarkingEpisode] = useState<{
		seasonNumber: number;
		episodeNumber: number;
	} | null>(null);

	const {
		data: show,
		isLoading: showLoading,
		error: showError,
	} = useShowDetails(showId);

	const { data: upNextData } = useUserUpNext(userDid);
	const { data: discoverShowsData } = useDiscoverShows(1);
	const { data: seasonDetails, isLoading: seasonLoading } = useSeasonDetails(
		showId,
		expandedSeason,
	);

	const upNextForShow = upNextData?.items?.find(
		(item) => item.showId === showId,
	);
	const nextEpisode = upNextForShow?.nextEpisode;

	useEffect(() => {
		if (!hasUserToggledSeason && nextEpisode?.seasonNumber) {
			setExpandedSeason(nextEpisode.seasonNumber);
		}
	}, [nextEpisode?.seasonNumber, hasUserToggledSeason]);

	// Watch history query
	const { data: watchHistory } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: userDid || "", showId },
		}),
		enabled: !!userDid && !!showId,
	});

	// Watch actions
	const {
		markShowWatched,
		unmarkShowWatched,
		markSeasonWatched,
		unmarkSeasonWatched,
		isMarkShowPending,
		isUnmarkShowPending,
	} = useWatchActions({ mediaType: "show", showId });

	const markEpisodeMutation = useMarkEpisodeWatched();
	const unmarkEpisodeMutation = useUnmarkEpisodeWatched();

	const isTracking = !!watchHistory && watchHistory.length > 0;

	const uniqueEpisodesWatched = useMemo(() => {
		if (!watchHistory || !Array.isArray(watchHistory)) return 0;
		const unique = new Set(
			watchHistory.map(
				(ep: { seasonNumber: number; episodeNumber: number }) =>
					`${ep.seasonNumber}-${ep.episodeNumber}`,
			),
		);
		return unique.size;
	}, [watchHistory]);

	const totalEpisodes = show?.number_of_episodes || 0;
	const rawProgressPercentage =
		totalEpisodes > 0 ? (uniqueEpisodesWatched / totalEpisodes) * 100 : 0;
	const progressPercentage = Math.max(0, Math.min(100, rawProgressPercentage));
	const episodesRemaining = Math.max(0, totalEpisodes - uniqueEpisodesWatched);

	const isSeasonFullyWatched = (seasonNum: number, episodeCount: number) => {
		if (!watchHistory || watchHistory.length === 0) return false;
		if (episodeCount === 0) return false;
		const watchedInSeason = watchHistory.filter(
			(ep: { seasonNumber: number }) => ep.seasonNumber === seasonNum,
		).length;
		return watchedInSeason >= episodeCount;
	};

	const getCurrentEpisodeText = () => {
		if (nextEpisode) {
			return `Continue S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber}`;
		}
		if (isTracking && uniqueEpisodesWatched > 0) {
			return "Continue Watching";
		}
		return "Start Watching";
	};

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

	const handleMarkSeasonWatched = (seasonNumber: number) => {
		if (!isAuthenticated) return;
		setProcessingSeason(seasonNumber);
		markSeasonWatched(seasonNumber);
		// Reset after a delay since useWatchActions doesn't expose onSettled per-call
		setTimeout(() => setProcessingSeason(null), 2000);
	};

	const handleUnmarkSeasonWatched = (seasonNumber: number) => {
		if (!isAuthenticated) return;
		setProcessingSeason(seasonNumber);
		unmarkSeasonWatched(seasonNumber);
		setTimeout(() => setProcessingSeason(null), 2000);
	};

	const handleMarkShowWatched = () => {
		if (!isAuthenticated) return;
		markShowWatched();
	};

	const handleUnmarkShowWatched = () => {
		if (!isAuthenticated) return;
		unmarkShowWatched();
	};

	if (showLoading) return <LoadingState />;
	if (showError || !show) {
		return (
			<ErrorState
				message="Failed to load show"
				backTo="/"
				backLabel="Back to Dashboard"
			/>
		);
	}

	const backdropUrl = show.backdrop_path
		? `https://image.tmdb.org/t/p/original${show.backdrop_path}`
		: show.poster_path
			? `https://image.tmdb.org/t/p/original${show.poster_path}`
			: "";
	const posterUrl = show.poster_path
		? `https://image.tmdb.org/t/p/w500${show.poster_path}`
		: "";

	const creator =
		show.credits?.crew?.find(
			(person) =>
				person.job === "Executive Producer" || person.job === "Creator",
		)?.name || "Unknown";

	const cast =
		show.credits?.cast?.slice(0, 6).map((actor) => ({
			name: actor.name,
			character: actor.character || "",
			photo: actor.profile_path
				? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
				: `https://i.pravatar.cc/150?u=${actor.id}`,
		})) || [];

	const similarShows =
		discoverShowsData?.results
			?.filter((s) => s.id !== Number(showId))
			?.slice(0, 4)
			?.map((s) => ({
				id: s.id,
				title: s.name,
				type: "show" as const,
				year: s.first_air_date
					? new Date(s.first_air_date).getFullYear()
					: undefined,
				posterUrl: s.poster_path
					? `https://image.tmdb.org/t/p/w300${s.poster_path}`
					: "",
				// @ts-expect-error - vote_average may exist on TMDB result
				rating: s.vote_average,
			})) || [];

	return (
		<div className="min-h-screen pb-8">
			<MediaHero
				title={show.name}
				backdropUrl={backdropUrl}
				posterUrl={posterUrl}
				metaItems={
					<>
						<div className="flex items-center gap-1">
							<Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
							<span className="font-semibold">
								{
									// @ts-expect-error - vote_average may exist on TMDB result
									show.vote_average?.toFixed(1) || "N/A"
								}
							</span>
							<span className="text-[var(--foreground-muted)]">/10</span>
						</div>
						<span className="text-[var(--border-strong)]">•</span>
						<span>
							{show.number_of_seasons || 0} Season
							{show.number_of_seasons !== 1 ? "s" : ""}
						</span>
						<span className="text-[var(--border-strong)]">•</span>
						<span>{show.number_of_episodes || 0} Episodes</span>
						<span className="text-[var(--border-strong)]">•</span>
						<span className="badge badge-accent">
							{
								// @ts-expect-error - status may exist on TMDB result
								show.status || "Unknown"
							}
						</span>
						<span className="text-[var(--border-strong)]">•</span>
						<div className="flex gap-2">
							{show.genres?.slice(0, 3).map((genre) => (
								<span key={genre.id} className="badge badge-subtle">
									{genre.name}
								</span>
							))}
						</div>
					</>
				}
				actions={
					<>
						{nextEpisode ? (
							<Link
								to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
								params={{
									showId,
									showName: slugifyName(show.name),
									seasonNumber: String(nextEpisode.seasonNumber),
									episodeNumber: String(nextEpisode.episodeNumber),
								}}
								className="btn btn-primary gap-2"
							>
								<Play className="h-4 w-4" />
								{getCurrentEpisodeText()}
							</Link>
						) : (
							<button type="button" className="btn btn-primary gap-2">
								<Play className="h-4 w-4" />
								{getCurrentEpisodeText()}
							</button>
						)}
						<MediaActionsBar mediaType="show" mediaId={showId} />
					</>
				}
			/>

			{/* Main Content */}
			<div className="container-app relative z-20 mt-8">
				<div className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:gap-12">
					{/* Left Column */}
					<div className="space-y-8">
						{/* Overview */}
						<section>
							<h2 className="text-display-3 mb-4">Overview</h2>
							<p className="text-[var(--foreground-muted)] leading-relaxed">
								{show.overview || "No overview available."}
							</p>
						</section>

						{/* Episodes */}
						{show.seasons && show.seasons.length > 0 && (
							<section>
								<h2 className="text-display-3 mb-4">Episodes</h2>
								<div className="space-y-3">
									{show.seasons
										.filter((season) => season.season_number > 0)
										.map((season) => (
											<SeasonAccordion
												key={season.id}
												season={season}
												isExpanded={expandedSeason === season.season_number}
												onToggle={() => {
													setHasUserToggledSeason(true);
													setExpandedSeason(
														expandedSeason === season.season_number
															? null
															: season.season_number,
													);
												}}
												isFullyWatched={isSeasonFullyWatched(
													season.season_number,
													season.episode_count || 0,
												)}
												onMarkSeasonWatched={() =>
													handleMarkSeasonWatched(season.season_number)
												}
												onUnmarkSeasonWatched={() =>
													handleUnmarkSeasonWatched(season.season_number)
												}
												isProcessingSeason={
													processingSeason === season.season_number
												}
												isAuthenticated={isAuthenticated}
											>
												<EpisodeList
													episodes={seasonDetails?.episodes || []}
													showId={showId}
													showName={slugifyName(show.name)}
													seasonNumber={season.season_number}
													watchHistory={watchHistory}
													nextEpisode={nextEpisode || null}
													onMarkEpisode={handleMarkEpisode}
													onUnmarkEpisode={handleUnmarkEpisode}
													processingEpisode={processingEpisode}
													unmarkingEpisode={unmarkingEpisode}
													isLoading={
														seasonLoading &&
														expandedSeason === season.season_number
													}
												/>

												{/* Season Detail Link */}
												<Link
													to="/shows/$showId/$showName/seasons/$seasonNumber"
													params={{
														showId,
														showName: slugifyName(show.name),
														seasonNumber: String(season.season_number),
													}}
													className="flex items-center justify-center py-3 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-subtle)] hover:text-[var(--accent)] border-t border-[var(--border)]"
													title="Go to season details"
												>
													<span className="flex items-center gap-2">
														View Season Details
														<ChevronRight className="h-4 w-4" />
													</span>
												</Link>
											</SeasonAccordion>
										))}
								</div>
							</section>
						)}

						<CastGrid cast={cast} />
						<SimilarMediaGrid items={similarShows} title="Similar Shows" />
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
											{uniqueEpisodesWatched}/{totalEpisodes}
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
											onClick={handleMarkShowWatched}
											disabled={!isAuthenticated || isMarkShowPending}
											className="mt-4 w-full btn btn-secondary gap-2"
										>
											{isMarkShowPending ? (
												<>
													<Loader2 className="h-4 w-4 animate-spin" />
													Loading
												</>
											) : (
												<>
													<Check className="h-4 w-4" />
													Add show to shelf
												</>
											)}
										</button>
									) : (
										<button
											type="button"
											onClick={handleUnmarkShowWatched}
											disabled={!isAuthenticated || isUnmarkShowPending}
											className="mt-4 w-full btn btn-secondary gap-2"
										>
											{isUnmarkShowPending ? (
												<>
													<Loader2 className="h-4 w-4 animate-spin" />
													Loading
												</>
											) : (
												<>
													<X className="h-4 w-4" />
													Remove all plays
												</>
											)}
										</button>
									)}
								</div>
							</section>
						)}

						<DetailsCard
							items={[
								{ label: "Creator", value: creator },
								{
									label: "Seasons",
									value: show.number_of_seasons || 0,
								},
								{
									label: "Episodes",
									value: show.number_of_episodes || 0,
								},
								{
									label: "Status",
									value:
										// @ts-expect-error - status may exist on TMDB result
										show.status || "Unknown",
								},
								{
									label: "First Aired",
									value: formatDate(show.first_air_date || "", userTimezone),
								},
								{
									label: "Genres",
									value: show.genres?.map((g) => g.name).join(", ") || "N/A",
								},
							]}
						/>

						<InYourLists mediaType="show" mediaId={showId} />
					</div>
				</div>
			</div>
		</div>
	);
}
