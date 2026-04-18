import {
	listsControllerGetListsForItemOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Heart,
	Loader2,
	Play,
	Plus,
	Share2,
	Star,
} from "lucide-react";
import { useState } from "react";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import {
	useDiscoverShows,
	useMarkEpisodeWatched,
	useShowDetails,
	useUserUpNext,
} from "#/lib/hooks";
import { slugifyName } from "#/lib/url-utils";
import MediaCard from "../../../../components/MediaCard";

// Initialize API client
setupApiClient();

export const Route = createFileRoute("/shows/$showId/$showName/")({
	component: ShowDetailPage,
});

// Format runtime from minutes to hours and minutes
function formatRuntime(minutes: number): string {
	if (!minutes || minutes <= 0) return "N/A";
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours === 0) return `${mins}m`;
	return `${hours}h ${mins}m`;
}

// Format date to readable string
function formatDate(dateString: string): string {
	if (!dateString) return "Unknown";
	try {
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		});
	} catch {
		return dateString;
	}
}

// Hook to fetch season details
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
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did;

	const [expandedSeason, setExpandedSeason] = useState<number | null>(1);

	// Fetch show details from API
	const {
		data: show,
		isLoading: showLoading,
		error: showError,
	} = useShowDetails(showId);

	// Fetch user's watch history for this specific show
	const { data: watchHistory } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: userDid || "", showId },
		}),
		enabled: !!userDid && !!showId,
	});

	// Fetch lists containing this show
	const { data: listsForItem } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: showId },
		}),
		enabled: !!showId,
	});

	// Count how many lists this show is actually in
	const listsContainingShow =
		listsForItem?.filter((list) => list.isInList) || [];

	// Fetch user's up next episodes
	const { data: upNextData } = useUserUpNext(userDid || "");

	// Fetch discover shows for similar recommendations
	const { data: discoverShowsData } = useDiscoverShows(1);

	// Fetch season details when expanded
	const { data: seasonDetails, isLoading: seasonLoading } = useSeasonDetails(
		showId,
		expandedSeason,
	);

	// Mark episode watched mutation
	const markWatchedMutation = useMarkEpisodeWatched();

	// Check if user tracks this show (based on watch history)
	const isTracking = !!watchHistory && watchHistory.length > 0;

	// Find up next episode for this show
	const upNextForShow = upNextData?.items?.find(
		(item) => item.showId === showId,
	);
	const nextEpisode = upNextForShow?.nextEpisode;

	// Calculate watched episodes from watch history
	const episodesWatched = watchHistory?.length || 0;
	const totalEpisodes = show?.number_of_episodes || 0;
	const progressPercentage =
		totalEpisodes > 0 ? (episodesWatched / totalEpisodes) * 100 : 0;
	const episodesRemaining = totalEpisodes - episodesWatched;

	// Loading state
	if (showLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Loader2 className="h-12 w-12 animate-spin text-[var(--accent)]" />
			</div>
		);
	}

	// Error state
	if (showError || !show) {
		return (
			<div className="container-app py-8">
				<div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-800">
					<p className="text-lg font-medium">Failed to load show</p>
					<p className="mt-2">Please check your connection and try again.</p>
					<Link to="/" className="btn btn-primary mt-4 inline-flex">
						Back to Dashboard
					</Link>
				</div>
			</div>
		);
	}

	// Transform API data
	const backdropUrl = show.backdrop_path
		? `https://image.tmdb.org/t/p/original${show.backdrop_path}`
		: show.poster_path
			? `https://image.tmdb.org/t/p/original${show.poster_path}`
			: "";
	const posterUrl = show.poster_path
		? `https://image.tmdb.org/t/p/w500${show.poster_path}`
		: "";

	// Get creator from crew (look for executive producer or creator)
	const creator =
		show.credits?.crew?.find(
			(person) =>
				person.job === "Executive Producer" || person.job === "Creator",
		)?.name || "Unknown";

	// Get cast (limit to 6)
	const cast =
		show.credits?.cast?.slice(0, 6).map((actor) => ({
			name: actor.name,
			character: actor.character || "",
			photo: actor.profile_path
				? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
				: `https://i.pravatar.cc/150?u=${actor.id}`,
		})) || [];

	// Get similar shows from discover API, excluding current show
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
				rating: s.vote_average,
			})) || [];

	// Handle mark episode as watched
	const handleMarkWatched = (seasonNumber: number, episodeNumber: number) => {
		if (!userDid || !isAuthenticated) return;

		markWatchedMutation.mutate({
			body: {
				showId,
				seasonNumber,
				episodeNumber,
			},
		});
	};

	// Get current episode display text
	const getCurrentEpisodeText = () => {
		if (
			nextEpisode?.season_number !== undefined &&
			nextEpisode?.episode_number !== undefined
		) {
			return `Continue S${nextEpisode.season_number}E${nextEpisode.episode_number}`;
		}
		if (isTracking && episodesWatched > 0) {
			return "Continue Watching";
		}
		return "Start Watching";
	};

	// Check if an episode is the next/current one
	const isCurrentEpisode = (seasonNum: number, episodeNum: number) => {
		return (
			nextEpisode?.season_number === seasonNum &&
			nextEpisode?.episode_number === episodeNum
		);
	};

	// Check if an episode has been watched using watch history
	const isEpisodeWatched = (seasonNum: number, episodeNum: number) => {
		if (!watchHistory || watchHistory.length === 0) return false;

		return watchHistory.some(
			(ep) => ep.seasonNumber === seasonNum && ep.episodeNumber === episodeNum,
		);
	};

	return (
		<div className="min-h-screen pb-8">
			{/* Hero Section with Backdrop */}
			<div className="relative z-10 min-h-[50vh] overflow-hidden">
				{/* Backdrop Image */}
				<div className="absolute inset-0 h-[60vh] overflow-hidden">
					{backdropUrl ? (
						<img
							src={backdropUrl}
							alt={show.name}
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="h-full w-full bg-gradient-to-br from-gray-800 to-gray-900" />
					)}
					{/* Gradient Overlays */}
					<div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/60 to-transparent" />
					<div className="absolute inset-0 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/40 to-transparent" />
				</div>

				{/* Content */}
				<div className="container-app relative pt-8">
					{/* Back Button */}
					<Link to="/" className="btn btn-secondary mb-6 inline-flex gap-2">
						<ChevronLeft className="h-4 w-4" />
						Back to Dashboard
					</Link>

					{/* Show Info Header */}
					<div className="grid gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
						{/* Poster */}
						<div className="hidden lg:block">
							<div className="aspect-[2/3] overflow-hidden rounded-xl shadow-2xl">
								{posterUrl ? (
									<img
										src={posterUrl}
										alt={show.name}
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="h-full w-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
										<span className="text-gray-400">No Poster</span>
									</div>
								)}
							</div>
						</div>

						{/* Info */}
						<div className="flex flex-col justify-end pb-8 lg:pb-16">
							{/* Mobile Poster */}
							<div className="mb-6 flex gap-4 lg:hidden">
								<div className="h-40 w-28 flex-shrink-0 overflow-hidden rounded-lg">
									{posterUrl ? (
										<img
											src={posterUrl}
											alt={show.name}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="h-full w-full bg-gradient-to-br from-gray-700 to-gray-800" />
									)}
								</div>
								<div className="flex flex-col justify-center">
									<h1 className="text-display-2">{show.name}</h1>
								</div>
							</div>

							{/* Desktop Title */}
							<div className="hidden lg:block">
								<h1 className="text-display-2">{show.name}</h1>
							</div>

							{/* Meta Info */}
							<div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
								<div className="flex items-center gap-1">
									<Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
									<span className="font-semibold">
										{show.vote_average?.toFixed(1) || "N/A"}
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
									{show.status || "Unknown"}
								</span>
								<span className="text-[var(--border-strong)]">•</span>
								<div className="flex gap-2">
									{show.genres?.slice(0, 3).map((genre) => (
										<span key={genre.id} className="badge badge-subtle">
											{genre.name}
										</span>
									))}
								</div>
							</div>

							{/* Current Progress */}
							{isTracking &&
								nextEpisode?.season_number !== undefined &&
								nextEpisode?.episode_number !== undefined && (
									<div className="mt-4 flex items-center gap-2 text-sm">
										<div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[#3f2e00] text-xs font-medium">
											{nextEpisode.episode_number}
										</div>
										<span className="text-[var(--foreground-muted)]">
											Currently at{" "}
											<span className="font-medium text-[var(--foreground)]">
												S{nextEpisode.season_number}E
												{nextEpisode.episode_number}
											</span>
										</span>
									</div>
								)}

							{/* Action Buttons */}
							<div className="mt-6 flex flex-wrap gap-3">
								<button type="button" className="btn btn-primary gap-2">
									<Play className="h-4 w-4" />
									{getCurrentEpisodeText()}
								</button>

								{isTracking ? (
									<button
										type="button"
										className="btn btn-secondary gap-2 bg-[var(--accent-subtle)] text-[var(--accent)]"
									>
										<Check className="h-4 w-4" />
										Tracking
									</button>
								) : (
									<button type="button" className="btn btn-secondary gap-2">
										<Plus className="h-4 w-4" />
										Track Show
									</button>
								)}

								<button
									type="button"
									className="btn btn-secondary h-10 w-10 p-0"
									aria-label="Share"
								>
									<Share2 className="h-4 w-4" />
								</button>

								<button
									type="button"
									className="btn btn-secondary h-10 w-10 p-0"
									aria-label="Like"
								>
									<Heart className="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

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
										.filter((season) => season.season_number > 0) // Filter out specials (season 0)
										.map((season) => (
											<div key={season.id} className="card overflow-hidden">
												<div className="flex items-center">
													{/* Season Header */}
													<Link
														to="/shows/$showId/$showName/seasons/$seasonNumber"
														params={{
															showId,
															showName: slugifyName(show.name),
															seasonNumber: season.season_number,
														}}
														className="flex flex-1 items-center justify-between p-4 text-left transition-colors hover:bg-[var(--background-subtle)]"
													>
														<div>
															<h3 className="font-semibold hover:text-[var(--accent)]">
																{season.name ||
																	`Season ${season.season_number}`}
															</h3>
															<p className="text-sm text-[var(--foreground-muted)]">
																{season.episode_count || 0} episodes
															</p>
														</div>
													</Link>
													<button
														type="button"
														onClick={() =>
															setExpandedSeason(
																expandedSeason === season.season_number
																	? null
																	: season.season_number,
															)
														}
														className="flex items-center justify-center p-4 text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-subtle)]"
													>
														<ChevronDown
															className={`h-5 w-5 transition-transform ${
																expandedSeason === season.season_number
																	? "rotate-180"
																	: ""
															}`}
														/>
													</button>
												</div>

												{/* Episode List */}
												{expandedSeason === season.season_number && (
													<div className="border-t border-[var(--border)]">
														{seasonLoading ? (
															<div className="p-4 text-center">
																<Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--accent)]" />
															</div>
														) : seasonDetails?.episodes ? (
															seasonDetails.episodes.map((episode, index) => {
																const isWatched = isEpisodeWatched(
																	season.season_number,
																	episode.episode_number,
																);
																const isCurrent = isCurrentEpisode(
																	season.season_number,
																	episode.episode_number,
																);

																return (
																	<Link
																		key={episode.id}
																		to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
																		params={{
																			showId,
																			showName: slugifyName(show.name),
																			seasonNumber: season.season_number,
																			episodeNumber: episode.episode_number,
																		}}
																		className={`flex items-center gap-4 p-4 transition-colors ${
																			isCurrent
																				? "bg-[var(--accent-subtle)]"
																				: "hover:bg-[var(--background-subtle)]"
																		} ${
																			index !==
																			seasonDetails.episodes.length - 1
																				? "border-b border-[var(--border)]"
																				: ""
																		}`}
																	>
																		<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--background-subtle)] font-semibold text-sm">
																			{isWatched ? (
																				<Check className="h-5 w-5 text-green-500" />
																			) : (
																				episode.episode_number
																			)}
																		</div>
																		<div className="flex-1 min-w-0">
																			<div className="flex items-center gap-2">
																				<h4 className="font-medium truncate">
																					{episode.episode_number}.{" "}
																					{episode.name}
																				</h4>
																				{isCurrent && (
																					<span className="badge badge-accent">
																						Current
																					</span>
																				)}
																			</div>
																			<p className="text-sm text-[var(--foreground-muted)]">
																				{formatRuntime(episode.runtime || 0)}
																				{episode.air_date &&
																					` • ${formatDate(episode.air_date)}`}
																			</p>
																		</div>
																		{!isWatched && isAuthenticated && (
																			<button
																				type="button"
																				onClick={(e) => {
																					e.preventDefault();
																					handleMarkWatched(
																						season.season_number,
																						episode.episode_number,
																					);
																				}}
																				disabled={markWatchedMutation.isPending}
																				className="btn btn-secondary h-8 px-3 text-xs"
																			>
																				{markWatchedMutation.isPending ? (
																					<Loader2 className="h-3 w-3 animate-spin" />
																				) : (
																					"Watch"
																				)}
																			</button>
																		)}
																	</Link>
																);
															})
														) : (
															<div className="p-4 text-center text-[var(--foreground-muted)]">
																No episodes available
															</div>
														)}
													</div>
												)}
											</div>
										))}
								</div>
							</section>
						)}

						{/* Cast */}
						{cast.length > 0 && (
							<section>
								<h2 className="text-display-3 mb-4">Cast</h2>
								<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
									{cast.map((actor) => (
										<div
											key={actor.name}
											className="card card-interactive flex items-center gap-3 p-3"
										>
											<img
												src={actor.photo}
												alt={actor.name}
												className="h-12 w-12 rounded-full object-cover"
											/>
											<div className="min-w-0">
												<p className="font-medium text-sm truncate">
													{actor.name}
												</p>
												<p className="text-xs text-[var(--foreground-muted)] truncate">
													{actor.character}
												</p>
											</div>
										</div>
									))}
								</div>
							</section>
						)}

						{/* Similar Shows */}
						{similarShows.length > 0 && (
							<section>
								<h2 className="text-display-3 mb-4">Similar Shows</h2>
								<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
									{similarShows.map((similarShow) => (
										<MediaCard
											key={similarShow.id}
											id={similarShow.id}
											title={similarShow.title}
											posterUrl={similarShow.posterUrl}
											type={similarShow.type}
											year={similarShow.year}
											rating={similarShow.rating}
											size="sm"
											layout="poster"
										/>
									))}
								</div>
							</section>
						)}
					</div>

					{/* Right Column - Sidebar */}
					<div className="space-y-6">
						{/* Details Card */}
						<section className="card p-5">
							<h3 className="font-display font-semibold mb-4">Details</h3>
							<div className="space-y-3 text-sm">
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">
										Creator
									</span>
									<span className="font-medium">{creator}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">
										Seasons
									</span>
									<span className="font-medium">
										{show.number_of_seasons || 0}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">
										Episodes
									</span>
									<span className="font-medium">
										{show.number_of_episodes || 0}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">Status</span>
									<span className="font-medium">
										{show.status || "Unknown"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">
										First Aired
									</span>
									<span className="font-medium">
										{formatDate(show.first_air_date || "")}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-[var(--foreground-muted)]">Genres</span>
									<span className="font-medium text-right">
										{show.genres?.map((g) => g.name).join(", ") || "N/A"}
									</span>
								</div>
							</div>
						</section>

						{/* Your Progress */}
						{isTracking && (
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
								</div>
							</section>
						)}

						{/* Lists Containing This */}
						<section className="card p-5">
							<h3 className="font-display font-semibold mb-4">In Your Lists</h3>
							<div className="space-y-2">
								{listsContainingShow.length > 0 ? (
									listsContainingShow.map((list) => (
										<Link
											key={list.listId}
											to={`/lists/${list.listSlug}`}
											className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-[var(--background-subtle)]"
										>
											<span className="text-sm font-medium">
												{list.listName}
											</span>
											<ChevronRight className="h-4 w-4 text-[var(--foreground-muted)]" />
										</Link>
									))
								) : (
									<p className="text-sm text-[var(--foreground-muted)]">
										Not in any lists yet
									</p>
								)}
							</div>
							<button
								type="button"
								className="mt-3 w-full btn btn-secondary text-sm"
							>
								<Plus className="h-4 w-4" />
								{listsContainingShow.length > 0
									? "Add to another list"
									: "Add to list"}
							</button>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
