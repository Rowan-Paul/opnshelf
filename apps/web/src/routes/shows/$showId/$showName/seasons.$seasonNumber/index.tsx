import {
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { formatDate } from "#/lib/date-utils";
import {
	useEpisodeWatchActions,
	useSeasonDetails,
	useShowDetails,
	useShowWatchHistory,
	useUserUpNext,
	useWatchActions,
} from "#/lib/hooks";
import { buildSeasonPageMeta } from "#/lib/media-meta";
import { buildSeasonUrl, buildShowUrl, slugifyName } from "#/lib/url-utils";
import DetailsCard from "../../../../../components/DetailsCard";
import ErrorState from "../../../../../components/ErrorState";
import InYourLists from "../../../../../components/InYourLists";
import LoadingState from "../../../../../components/LoadingState";
import MediaActionsBar from "../../../../../components/MediaActionsBar";
import MediaHero from "../../../../../components/MediaHero";
import NotesSection from "../../../../../components/NotesSection";
import PersonGrid from "../../../../../components/PersonGrid";
import ProgressCard from "../../../../../components/ProgressCard";
import ReviewSection from "../../../../../components/ReviewSection";
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

function SeasonDetailPage() {
	const { showId, showName, seasonNumber } = Route.useParams();
	const { user, userSettings, isAuthenticated } = useAuth();
	const userTimezone = userSettings?.timezone;

	const seasonNum = Number.parseInt(seasonNumber, 10);
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

	const { data: upNextData } = useUserUpNext(user?.did || "");
	const { data: watchHistory } = useShowWatchHistory(showId);
	const {
		processingEpisode,
		unmarkingEpisode,
		handleMarkEpisode,
		handleUnmarkEpisode,
	} = useEpisodeWatchActions(showId);

	// Watch actions
	const {
		markSeasonWatched,
		unmarkSeasonWatched,
		isMarkSeasonPending,
		isUnmarkShowPending,
	} = useWatchActions({ mediaType: "show", showId });

	// Season-specific watch history
	const seasonWatchHistory = useMemo(() => {
		if (!watchHistory || !Array.isArray(watchHistory)) return [];
		return watchHistory.filter(
			(ep: { seasonNumber: number }) => ep.seasonNumber === seasonNum,
		);
	}, [watchHistory, seasonNum]);

	const episodesWatched = seasonWatchHistory.length;
	const totalEpisodes = season?.episodes?.length || 0;

	// Up next for this show
	const upNextForShow = upNextData?.items?.find(
		(item) => item.showId === showId,
	);
	const nextEpisode = upNextForShow?.nextEpisode;

	// Only highlight the up-next episode if it's in this season
	const upNextEpisode = useMemo(() => {
		if (nextEpisode?.seasonNumber === seasonNum) {
			return nextEpisode;
		}
		return null;
	}, [nextEpisode, seasonNum]);

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
		if (upNextEpisode) {
			return `Continue S${upNextEpisode.seasonNumber}E${upNextEpisode.episodeNumber}`;
		}
		if (episodesWatched > 0) {
			return "Continue Watching";
		}
		return "Start Season";
	};

	const getContinueButtonLink = () => {
		if (upNextEpisode) {
			return {
				to: "/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber" as const,
				params: {
					showId,
					showName: slugifyName(show?.name || showName),
					seasonNumber: String(upNextEpisode.seasonNumber),
					episodeNumber: String(upNextEpisode.episodeNumber),
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
				backLabel={isAuthenticated ? "Back to Dashboard" : "Back to Home"}
				metaItems={
					<>
						<div className="flex items-center gap-1">
							<Star className="size-4 fill-yellow-500 text-yellow-500" />
							<span className="font-semibold">
								{season.vote_average?.toFixed(1) || "N/A"}
							</span>
							<span className="text-(--foreground-muted)">/10</span>
						</div>
						<span className="text-(--border-strong)">•</span>
						<span>
							{season.episodes?.length || 0} Episode
							{season.episodes?.length !== 1 ? "s" : ""}
						</span>
						<span className="text-(--border-strong)">•</span>
						<span>{airDateRange}</span>
						<span className="text-(--border-strong)">•</span>
						<span className="badge badge-accent">
							{
								// @ts-expect-error - status may exist on TMDB result
								show.status || "Unknown"
							}
						</span>
					</>
				}
				actions={
					isAuthenticated ? (
						<>
							<Link
								to={continueLink.to}
								params={continueLink.params}
								className="btn btn-primary gap-2"
							>
								<Play className="size-4" />
								{getContinueButtonText()}
							</Link>
							<MediaActionsBar
								mediaType="show"
								mediaId={showId}
								seasonNumber={seasonNum}
							/>
						</>
					) : (
						<Link to="/login" className="btn btn-primary gap-2">
							Sign in to track
						</Link>
					)
				}
				currentProgress={
					<div className="flex items-center gap-4 text-sm">
						{previousSeason && (
							<Link
								to="/shows/$showId/$showName/seasons/$seasonNumber"
								params={{
									showId,
									showName: slugifyName(show.name),
									seasonNumber: String(previousSeason.season_number),
								}}
								className="inline-flex items-center gap-1 text-(--foreground-muted) transition-colors hover:text-(--accent)"
							>
								<ChevronLeft className="size-4" />
								Previous (S{previousSeason.season_number})
							</Link>
						)}
						<span className="text-(--foreground-muted)">
							Season {seasonNum} of {sortedSeasons.length}
						</span>
						{nextSeason && (
							<Link
								to="/shows/$showId/$showName/seasons/$seasonNumber"
								params={{
									showId,
									showName: slugifyName(show.name),
									seasonNumber: String(nextSeason.season_number),
								}}
								className="inline-flex items-center gap-1 text-(--foreground-muted) transition-colors hover:text-(--accent)"
							>
								Next (S{nextSeason.season_number})
								<ChevronRight className="size-4" />
							</Link>
						)}
					</div>
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
						<section>
							<h2 className="mb-4 text-display-3">Overview</h2>
							<p className="text-(--foreground-muted) leading-relaxed">
								{season.overview || "No overview available."}
							</p>
						</section>

						{/* Episodes */}
						{season.episodes && season.episodes.length > 0 && (
							<section>
								<h2 className="mb-4 text-display-3">Episodes</h2>
								<div className="card overflow-hidden">
									<EpisodeList
										episodes={season.episodes}
										showId={showId}
										showName={slugifyName(show.name)}
										seasonNumber={seasonNum}
										watchHistory={watchHistory}
										nextEpisode={upNextEpisode || null}
										onMarkEpisode={handleMarkEpisode}
										onUnmarkEpisode={handleUnmarkEpisode}
										onUnmarkEpisodeAll={(sn, en) =>
											handleUnmarkEpisode(sn, en, "all")
										}
										processingEpisode={processingEpisode}
										unmarkingEpisode={unmarkingEpisode}
										isLoading={false}
									/>
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
						</div>
					</div>

					{/* Right Column - Sidebar */}
					<div className="space-y-6">
						{/* Your Progress */}
						{isAuthenticated && (
							<ProgressCard
								episodesWatched={episodesWatched}
								totalEpisodes={totalEpisodes}
								markLabel="Add Season to Shelf"
								unmarkLabel="Remove Season from Shelf"
								isMarkPending={isMarkSeasonPending}
								isUnmarkPending={isUnmarkShowPending}
								processing={processingSeason}
								onMarkWatched={handleMarkSeasonWatched}
								onUnmarkWatched={handleUnmarkSeasonWatched}
							/>
						)}

						{/* Details */}
						<DetailsCard
							title="Details"
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

						<InYourLists
							mediaType="show"
							mediaId={showId}
							seasonNumber={seasonNum}
						/>

						{/* Review */}
						<ReviewSection
							mediaType="show"
							mediaId={showId}
							seasonNumber={seasonNum}
						/>

						{/* Notes */}
						<NotesSection
							mediaType="show"
							mediaId={showId}
							seasonNumber={seasonNum}
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
				</div>
			</div>
		</div>
	);
}
