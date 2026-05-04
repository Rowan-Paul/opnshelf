import {
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	ChevronLeft,
	ChevronRight,
	Loader2,
	Plus,
	Star,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { formatDate } from "#/lib/date-utils";
import {
	useEpisodeDetails,
	useShowDetails,
	useShowWatchHistory,
	useWatchActions,
} from "#/lib/hooks";
import { buildEpisodePageMeta } from "#/lib/media-meta";
import { buildSeasonUrl, buildShowUrl, slugifyName } from "#/lib/url-utils";
import DetailsCard from "../../../../components/DetailsCard";
import ErrorState from "../../../../components/ErrorState";
import InYourLists from "../../../../components/InYourLists";
import LoadingState from "../../../../components/LoadingState";
import MediaActionsBar from "../../../../components/MediaActionsBar";
import MediaHero from "../../../../components/MediaHero";
import PersonGrid from "../../../../components/PersonGrid";
import { YourActivity } from "../../../../components/YourActivity";

setupApiClient();

export const Route = createFileRoute(
	"/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber",
)({
	loader: async ({ context, params }) => {
		const [show, episode] = await Promise.all([
			context.queryClient.ensureQueryData(
				showsControllerGetShowDetailsOptions({
					path: { showId: params.showId },
				}),
			),
			context.queryClient.ensureQueryData(
				showsControllerGetEpisodeDetailsOptions({
					path: {
						showId: params.showId,
						seasonNumber: params.seasonNumber,
						episodeNumber: params.episodeNumber,
					},
				}),
			),
		]);

		return { show, episode };
	},
	head: ({ loaderData, params }) => {
		const meta = buildEpisodePageMeta(loaderData?.show, loaderData?.episode, {
			seasonNumber: params.seasonNumber,
			episodeNumber: params.episodeNumber,
		});

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
	component: EpisodeDetailPage,
});

function EpisodeDetailPage() {
	const { showId, showName, seasonNumber, episodeNumber } = Route.useParams();
	const { userSettings } = useAuth();
	const userTimezone = userSettings?.timezone;

	const seasonNum = Number.parseInt(seasonNumber, 10);
	const episodeNum = Number.parseInt(episodeNumber, 10);

	const {
		data: show,
		isLoading: showLoading,
		error: showError,
	} = useShowDetails(showId);

	const {
		data: episode,
		isLoading: episodeLoading,
		error: episodeError,
	} = useEpisodeDetails(showId, seasonNumber, episodeNumber);

	const { data: watchHistory } = useShowWatchHistory(showId);

	const {
		markEpisodeWatched,
		unmarkEpisodeWatched,
		deleteEpisodeWatchHistoryEntry,
		isMarkEpisodePending,
		isUnmarkEpisodePending,
		isDeleteEpisodeHistoryPending,
	} = useWatchActions({ mediaType: "show", showId });

	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

	// Episode-specific watch history
	const episodeWatchHistory = useMemo(() => {
		if (!watchHistory || !Array.isArray(watchHistory)) return [];
		return watchHistory.filter(
			(ep: { seasonNumber: number; episodeNumber: number }) =>
				ep.seasonNumber === seasonNum && ep.episodeNumber === episodeNum,
		);
	}, [watchHistory, seasonNum, episodeNum]);

	const isWatched = episodeWatchHistory.length > 0;

	if (showLoading || episodeLoading) return <LoadingState />;
	if (showError || episodeError || !show || !episode) {
		return (
			<ErrorState
				message="Failed to load episode"
				backTo={buildSeasonUrl(showId, show?.name || showName, seasonNum)}
				backLabel="Back to Season"
			/>
		);
	}

	const backdropUrl = episode.still_path
		? `https://image.tmdb.org/t/p/original${episode.still_path}`
		: show.backdrop_path
			? `https://image.tmdb.org/t/p/original${show.backdrop_path}`
			: show.poster_path
				? `https://image.tmdb.org/t/p/original${show.poster_path}`
				: "";
	const posterUrl = show.poster_path
		? `https://image.tmdb.org/t/p/w500${show.poster_path}`
		: "";

	const director =
		episode.crew?.find((person) => person.job === "Director")?.name ||
		"Unknown";

	const guestStars =
		episode.guest_stars?.slice(0, 6).map((actor) => ({
			id: actor.id,
			name: actor.name,
			role: actor.character || "",
			photo: actor.profile_path
				? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
				: `https://i.pravatar.cc/150?u=${actor.id}`,
		})) || [];

	const episodeCrew =
		episode.crew?.slice(0, 6).map((person) => ({
			id: person.id,
			name: person.name,
			role: person.job || "",
			photo: person.profile_path
				? `https://image.tmdb.org/t/p/w185${person.profile_path}`
				: `https://i.pravatar.cc/150?u=${person.id}`,
		})) || [];

	// Previous / Next episode navigation (computed client-side from show data)
	const seasons =
		show.seasons
			?.filter((s) => s.season_number > 0)
			.sort((a, b) => a.season_number - b.season_number) || [];
	const currentSeason = seasons.find((s) => s.season_number === seasonNum);
	const currentSeasonEpisodeCount = currentSeason?.episode_count || 0;

	let prevEpisode: { seasonNumber: number; episodeNumber: number } | null =
		null;
	if (episodeNum > 1) {
		prevEpisode = { seasonNumber: seasonNum, episodeNumber: episodeNum - 1 };
	} else {
		const prevSeason = seasons.find((s) => s.season_number === seasonNum - 1);
		if (prevSeason) {
			prevEpisode = {
				seasonNumber: prevSeason.season_number,
				episodeNumber: prevSeason.episode_count || 1,
			};
		}
	}

	let nextEpisodeCtx: { seasonNumber: number; episodeNumber: number } | null =
		null;
	if (episodeNum < currentSeasonEpisodeCount) {
		nextEpisodeCtx = {
			seasonNumber: seasonNum,
			episodeNumber: episodeNum + 1,
		};
	} else {
		const nextSeason = seasons.find((s) => s.season_number === seasonNum + 1);
		if (nextSeason) {
			nextEpisodeCtx = {
				seasonNumber: nextSeason.season_number,
				episodeNumber: 1,
			};
		}
	}

	const breadcrumbs = [
		{
			label: show.name,
			to: buildShowUrl(showId, show.name),
		},
		{
			label: `Season ${seasonNum}`,
			to: buildSeasonUrl(showId, show.name, seasonNum),
		},
		{
			label: `Episode ${episodeNum}`,
			to: "",
		},
	];

	return (
		<div className="min-h-screen pb-8">
			<MediaHero
				title={`${show.name} — ${episode.name}`}
				backdropUrl={backdropUrl}
				posterUrl={posterUrl}
				metaItems={
					<>
						<div className="flex items-center gap-1">
							<Star className="size-4 fill-yellow-500 text-yellow-500" />
							<span className="font-semibold">
								{episode.vote_average?.toFixed(1) || "N/A"}
							</span>
							<span className="text-(--foreground-muted)">/10</span>
						</div>
						<span className="text-(--border-strong)">•</span>
						<span className="badge badge-accent">
							S{seasonNum}E{episodeNum}
						</span>
						<span className="text-(--border-strong)">•</span>
						<span>
							{episode.runtime ? `${episode.runtime} min` : ""}
							{episode.runtime && episode.air_date ? " • " : ""}
							{episode.air_date
								? formatDate(episode.air_date, userTimezone)
								: "Unknown air date"}
						</span>
					</>
				}
				actions={
					<>
						{isWatched ? (
							<button
								type="button"
								onClick={() => {
									if (episodeWatchHistory && episodeWatchHistory.length > 1) {
										setConfirmRemoveOpen(true);
									} else {
										unmarkEpisodeWatched(seasonNum, episodeNum);
									}
								}}
								disabled={isUnmarkEpisodePending}
								className="btn gap-2 border-green-500/20 bg-green-500/10 text-green-600 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600"
							>
								{isUnmarkEpisodePending ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										Loading
									</>
								) : (
									<>
										<X className="size-4" />
										Remove from shelf
									</>
								)}
							</button>
						) : (
							<button
								type="button"
								onClick={() => markEpisodeWatched(seasonNum, episodeNum)}
								disabled={isMarkEpisodePending}
								className="btn btn-primary gap-2"
							>
								{isMarkEpisodePending ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										Loading
									</>
								) : (
									<>
										<Plus className="size-4" />
										Add to shelf
									</>
								)}
							</button>
						)}
						<MediaActionsBar
							mediaType="show"
							mediaId={showId}
							seasonNumber={seasonNum}
							episodeNumber={episodeNum}
						/>
					</>
				}
				breadcrumbs={breadcrumbs}
				currentProgress={
					<div className="flex items-center gap-4 text-sm">
						{prevEpisode && (
							<Link
								to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
								params={{
									showId,
									showName: slugifyName(show.name),
									seasonNumber: String(prevEpisode.seasonNumber),
									episodeNumber: String(prevEpisode.episodeNumber),
								}}
								className="inline-flex items-center gap-1 text-(--foreground-muted) transition-colors hover:text-(--accent)"
							>
								<ChevronLeft className="size-4" />
								Prev (S{prevEpisode.seasonNumber}E{prevEpisode.episodeNumber})
							</Link>
						)}
						<span className="text-(--foreground-muted)">
							Episode {episodeNum} of {show.number_of_episodes || "?"}
						</span>
						{nextEpisodeCtx && (
							<Link
								to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
								params={{
									showId,
									showName: slugifyName(show.name),
									seasonNumber: String(nextEpisodeCtx.seasonNumber),
									episodeNumber: String(nextEpisodeCtx.episodeNumber),
								}}
								className="inline-flex items-center gap-1 text-(--foreground-muted) transition-colors hover:text-(--accent)"
							>
								Next (S{nextEpisodeCtx.seasonNumber}E
								{nextEpisodeCtx.episodeNumber})
								<ChevronRight className="size-4" />
							</Link>
						)}
					</div>
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
								{episode.overview || "No overview available."}
							</p>
						</section>

						<div className="hidden space-y-8 lg:block">
							{/* Guest Stars */}
							<PersonGrid
								people={guestStars}
								title="Guest Stars"
								emptyMessage="No guest stars information available."
							/>

							{/* Crew */}
							<PersonGrid
								people={episodeCrew}
								title="Crew"
								emptyMessage="No crew information available."
							/>
						</div>
					</div>

					{/* Right Column - Sidebar */}
					<div className="space-y-6">
						{/* Your Activity */}
						<YourActivity
							watchHistory={episodeWatchHistory}
							onAddToShelf={(watchedAt) =>
								markEpisodeWatched(seasonNum, episodeNum, watchedAt)
							}
							onDeleteEntry={deleteEpisodeWatchHistoryEntry}
							isAddPending={isMarkEpisodePending}
							isDeletePending={isDeleteEpisodeHistoryPending}
						/>

						{/* Details */}
						<DetailsCard
							title="Episode Details"
							items={[
								{
									label: "Director",
									value: director,
								},
								{
									label: "Air Date",
									value: episode.air_date
										? formatDate(episode.air_date, userTimezone)
										: "Unknown",
								},
								{
									label: "Runtime",
									value: episode.runtime ? `${episode.runtime} min` : "N/A",
								},
								{
									label: "Rating",
									value: episode.vote_average
										? `${episode.vote_average.toFixed(1)}/10`
										: "N/A",
								},
							]}
						/>

						<InYourLists
							mediaType="show"
							mediaId={showId}
							seasonNumber={seasonNum}
							episodeNumber={episodeNum}
						/>
					</div>
				</div>

				<div className="mt-8 space-y-8 lg:hidden">
					<PersonGrid
						people={guestStars}
						title="Guest Stars"
						emptyMessage="No guest stars information available."
					/>
					<PersonGrid
						people={episodeCrew}
						title="Crew"
						emptyMessage="No crew information available."
					/>
				</div>
			</div>

			{/* Confirm remove all plays dialog */}
			<Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="size-5 text-amber-500" />
							Remove all plays?
						</DialogTitle>
						<DialogDescription>
							This will remove all{" "}
							<strong>{episodeWatchHistory.length || 0}</strong> watch entries
							for{" "}
							<strong>
								{show.name} S{seasonNum}E{episodeNum}
							</strong>
							. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<button
							type="button"
							onClick={() => setConfirmRemoveOpen(false)}
							className="btn btn-secondary"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => {
								unmarkEpisodeWatched(seasonNum, episodeNum, "all");
								setConfirmRemoveOpen(false);
							}}
							disabled={isUnmarkEpisodePending}
							className="btn bg-red-600 text-white hover:bg-red-700"
						>
							{isUnmarkEpisodePending ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Removing...
								</>
							) : (
								"Remove all"
							)}
						</button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
