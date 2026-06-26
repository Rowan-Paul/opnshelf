import {
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Play, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "#/env";
import { useAuth } from "#/lib/auth-context";
import { formatDate } from "#/lib/date-utils";
import {
	useEpisodeWatchActions,
	useShowDetails,
	useShowRecommendations,
	useShowWatchHistory,
	useShowWatchProviders,
	useUserUpNext,
	useWatchActions,
} from "#/lib/hooks";
import { useMediaRating } from "#/lib/hooks/useRatings";
import {
	buildShowPageMeta,
	getOpenGraphMetaDescriptors,
} from "#/lib/media-meta";
import { slugifyName } from "#/lib/url-utils";
import CommunityReviews from "../../../../components/CommunityReviews";
import DetailsCard from "../../../../components/DetailsCard";
import ErrorState from "../../../../components/ErrorState";
import { FriendWatchers } from "../../../../components/FriendWatchers";
import LoadingState from "../../../../components/LoadingState";
import MediaActionsBar from "../../../../components/MediaActionsBar";
import MediaHero from "../../../../components/MediaHero";
import PersonGrid from "../../../../components/PersonGrid";
import ProgressCard from "../../../../components/ProgressCard";
import { ReviewDialog } from "../../../../components/ReviewDialog";
import SimilarMediaGrid from "../../../../components/SimilarMediaGrid";
import EpisodeList from "../../../../components/shows/EpisodeList";
import SeasonAccordion from "../../../../components/shows/SeasonAccordion";
import WatchProviders from "../../../../components/WatchProviders";
export const Route = createFileRoute("/shows/$showId/$showName/")({
	loader: async ({ context, params }) => {
		return context.queryClient.ensureQueryData(
			showsControllerGetShowDetailsOptions({
				path: { showId: params.showId },
			}),
		);
	},
	head: ({ loaderData, params, match }) => {
		const meta = buildShowPageMeta(loaderData, params.showName);
		const pageUrl = env.VITE_SITE_URL
			? `${env.VITE_SITE_URL}${match.pathname}`
			: undefined;

		return {
			meta: [
				{ title: meta.title },
				{
					name: "description",
					content: meta.description,
				},
				...getOpenGraphMetaDescriptors(meta, pageUrl),
			],
		};
	},
	component: ShowDetailPage,
});

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
	const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
	const [watchProvidersCountry, setWatchProvidersCountry] = useState("US");
	const hasSyncedCountry = useRef(false);
	useEffect(() => {
		if (!hasSyncedCountry.current && userSettings?.watchCountry) {
			hasSyncedCountry.current = true;
			setWatchProvidersCountry(userSettings.watchCountry);
		}
	}, [userSettings]);

	const { data: watchProvidersData } = useShowWatchProviders(
		showId,
		watchProvidersCountry,
	);

	const {
		data: show,
		isLoading: showLoading,
		error: showError,
	} = useShowDetails(showId);

	const { data: upNextData } = useUserUpNext(userDid);
	const { data: discoverShowsData } = useShowRecommendations(showId);
	const { data: seasonDetails, isLoading: seasonLoading } = useSeasonDetails(
		showId,
		expandedSeason,
	);

	const { data: watchHistory } = useShowWatchHistory(showId);
	const {
		processingEpisode,
		unmarkingEpisode,
		handleMarkEpisode,
		handleUnmarkEpisode,
	} = useEpisodeWatchActions(showId);

	const upNextForShow = upNextData?.items?.find(
		(item) => item.showId === showId,
	);
	const nextEpisode = upNextForShow?.nextEpisode;

	useEffect(() => {
		if (!hasUserToggledSeason && nextEpisode?.seasonNumber) {
			setExpandedSeason(nextEpisode.seasonNumber);
		}
	}, [nextEpisode?.seasonNumber, hasUserToggledSeason]);

	// Watch actions
	const {
		markShowWatched,
		unmarkShowWatched,
		markSeasonWatched,
		unmarkSeasonWatched,
		isMarkShowPending,
		isUnmarkShowPending,
	} = useWatchActions({ mediaType: "show", showId });

	const { data: mediaRating } = useMediaRating({
		mediaType: "show",
		mediaId: showId,
	});

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

	const isStartWatching =
		!nextEpisode && !(isTracking && uniqueEpisodesWatched > 0);

	const firstSeasonNumber =
		show?.seasons
			?.filter((s) => s.season_number > 0)
			.sort((a, b) => a.season_number - b.season_number)[0]?.season_number || 1;

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
			id: actor.id,
			name: actor.name,
			role: actor.character || "",
			photo: actor.profile_path
				? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
				: `https://i.pravatar.cc/150?u=${actor.id}`,
		})) || [];

	const crew =
		show.credits?.crew?.slice(0, 6).map((person) => ({
			id: person.id,
			name: person.name,
			role: person.job || "",
			photo: person.profile_path
				? `https://image.tmdb.org/t/p/w185${person.profile_path}`
				: `https://i.pravatar.cc/150?u=${person.id}`,
		})) || [];

	const similarShows =
		discoverShowsData?.results
			?.filter((s) => s.id !== Number(showId))
			?.slice(0, 6)
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
				tmdbRating: s.vote_average || undefined,
			})) || [];

	return (
		<div className="min-h-screen pb-8">
			<MediaHero
				title={show.name}
				backdropUrl={backdropUrl}
				posterUrl={posterUrl}
				backLabel={isAuthenticated ? "Back to Dashboard" : "Back to Home"}
				metaItems={
					<>
						<div className="flex items-center gap-1">
							<Star className="size-4 fill-yellow-500 text-yellow-500" />
							<span className="font-semibold">
								{(mediaRating?.averageRating ?? show.vote_average)?.toFixed(
									1,
								) || "N/A"}
							</span>
							<span className="text-(--foreground-muted)">/10</span>
						</div>
						<span className="text-(--border-strong)">•</span>
						<span>
							{show.number_of_seasons || 0} Season
							{show.number_of_seasons !== 1 ? "s" : ""}
						</span>
						<span className="text-(--border-strong)">•</span>
						<span>{show.number_of_episodes || 0} Episodes</span>
						<span className="text-(--border-strong)">•</span>
						<span className="badge badge-accent">
							{
								// @ts-expect-error - status may exist on TMDB result
								show.status || "Unknown"
							}
						</span>
						<span className="text-(--border-strong)">•</span>
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
					isAuthenticated ? (
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
									<Play className="size-4" />
									{getCurrentEpisodeText()}
								</Link>
							) : isStartWatching ? (
								<Link
									to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
									params={{
										showId,
										showName: slugifyName(show.name),
										seasonNumber: String(firstSeasonNumber),
										episodeNumber: "1",
									}}
									className="btn btn-primary gap-2"
								>
									<Play className="size-4" />
									{getCurrentEpisodeText()}
								</Link>
							) : (
								<button type="button" className="btn btn-primary gap-2">
									<Play className="size-4" />
									{getCurrentEpisodeText()}
								</button>
							)}
							<MediaActionsBar mediaType="show" mediaId={showId} />
						</>
					) : (
						<Link to="/login" className="btn btn-primary gap-2">
							Sign in to track
						</Link>
					)
				}
			/>

			{/* Main Content */}
			<div className="container-app relative z-20 mt-8">
				<div className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:gap-12">
					{/* Left Column */}
					<div className="space-y-8">
						{/* Overview */}
						<section>
							<h2 className="mb-4 text-display-3">Overview</h2>
							<p className="text-(--foreground-muted) leading-relaxed">
								{show.overview || "No overview available."}
							</p>
						</section>

						{/* Episodes */}
						{show.seasons && show.seasons.length > 0 && (
							<section>
								<h2 className="mb-4 text-display-3">Episodes</h2>
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
													onUnmarkEpisodeAll={(sn, en) =>
														handleUnmarkEpisode(sn, en, "all")
													}
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
													className="flex items-center justify-center border-(--border) border-t py-3 text-(--foreground-muted) text-sm transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
													title="Go to season details"
												>
													<span className="flex items-center gap-2">
														View Season Details
														<ChevronRight className="size-4" />
													</span>
												</Link>
											</SeasonAccordion>
										))}
								</div>
							</section>
						)}

						<div className="hidden space-y-8 lg:block">
							<PersonGrid people={cast} />
							<PersonGrid
								people={crew}
								title="Crew"
								emptyMessage="No crew information available."
							/>
							<CommunityReviews mediaType="show" mediaId={showId} />
							<SimilarMediaGrid items={similarShows} title="Similar Shows" />
						</div>
					</div>

					{/* Right Column - Sidebar */}
					<div className="space-y-6">
						<FriendWatchers mediaType="show" mediaId={showId} />

						{/* Your Progress */}
						{isAuthenticated && (
							<ProgressCard
								episodesWatched={uniqueEpisodesWatched}
								totalEpisodes={totalEpisodes}
								markLabel="Add show to shelf"
								unmarkLabel="Remove all plays"
								isMarkPending={isMarkShowPending}
								isUnmarkPending={isUnmarkShowPending}
								onMarkWatched={handleMarkShowWatched}
								onUnmarkWatched={handleUnmarkShowWatched}
							/>
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

						<WatchProviders
							providers={watchProvidersData?.providers}
							availableCountries={watchProvidersData?.availableCountries}
							country={watchProvidersCountry}
							onCountryChange={setWatchProvidersCountry}
						/>
					</div>
				</div>

				<div className="mt-8 space-y-8 lg:hidden">
					<PersonGrid people={cast} />
					<PersonGrid
						people={crew}
						title="Crew"
						emptyMessage="No crew information available."
					/>
					<CommunityReviews
						mediaType="show"
						mediaId={showId}
						onAddReview={() => setReviewDialogOpen(true)}
					/>
					<SimilarMediaGrid items={similarShows} title="Similar Shows" />
				</div>
			</div>

			<ReviewDialog
				open={reviewDialogOpen}
				onOpenChange={setReviewDialogOpen}
				mediaType="show"
				mediaId={showId}
			/>
		</div>
	);
}
