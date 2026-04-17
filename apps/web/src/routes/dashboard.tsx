import type {
	FollowedActivityItemDto,
	ReleaseCalendarItemDto,
} from "@opnshelf/api";
import {
	showsControllerGetUserReleaseCalendarOptions,
	socialControllerGetFeedOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	Calendar,
	ChevronRight,
	Clock,
	Film,
	Heart,
	MessageCircle,
	TrendingUp,
	Tv,
	Users,
} from "lucide-react";
import { useEffect } from "react";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { useDashboardStats, useUserShelf } from "#/lib/hooks";
import MediaCard from "../components/MediaCard";

// Initialize API client
setupApiClient();

export const Route = createFileRoute("/dashboard")({
	component: Dashboard,
});

// Helper function to format relative time
function formatRelativeDate(dateStr: string): string {
	const releaseDate = new Date(dateStr);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	releaseDate.setHours(0, 0, 0, 0);

	const diffTime = releaseDate.getTime() - today.getTime();
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Tomorrow";
	if (diffDays < 7) return `in ${diffDays} days`;
	if (diffDays < 30) return `in ${Math.ceil(diffDays / 7)} weeks`;
	return `in ${Math.ceil(diffDays / 30)} months`;
}

// Helper function to format date
function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Helper function to format relative time for social feed
function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) return "Just now";
	if (diffInSeconds < 3600)
		return `${Math.floor(diffInSeconds / 60)} minutes ago`;
	if (diffInSeconds < 86400)
		return `${Math.floor(diffInSeconds / 3600)} hours ago`;
	if (diffInSeconds < 604800)
		return `${Math.floor(diffInSeconds / 86400)} days ago`;
	return date.toLocaleDateString();
}

// Helper function to get episode info
function getEpisodeInfo(item: ReleaseCalendarItemDto): string | undefined {
	if (item.releaseKind === "episode" && item.seasonNumber !== undefined) {
		if (item.episodeNumber !== undefined) {
			return `S${item.seasonNumber}E${item.episodeNumber}`;
		}
		return `Season ${item.seasonNumber}`;
	}
	if (item.releaseKind === "show") {
		return "Season Premiere";
	}
	return undefined;
}

// Helper function to format watched time (e.g. "Apr 9 at 2:30 PM", "Jan 15, 2024 at 2:30 PM")
function formatWatchedDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const isThisYear = date.getFullYear() === now.getFullYear();
	const timeString = date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
	});

	if (isThisYear) {
		const formattedDate = date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
		return `${formattedDate} at ${timeString}`;
	}
	const formattedDate = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	return `${formattedDate} at ${timeString}`;
}

function Dashboard() {
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const userDid = user?.did;

	// Redirect to login if not authenticated
	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	// Fetch user data from API
	const { data: shelfData, isLoading: shelfLoading } = useUserShelf(
		userDid || "",
		12,
	);
	const { data: statsData, isLoading: statsLoading } = useDashboardStats(
		userDid || "",
	);

	// Fetch social activity feed
	const { data: feedData, isLoading: feedLoading } = useQuery({
		...socialControllerGetFeedOptions({
			query: { pageSize: 10 },
		}),
	});

	// Fetch release calendar data
	const { data: calendarData, isLoading: calendarLoading } = useQuery({
		...showsControllerGetUserReleaseCalendarOptions({
			path: { userDid: user?.did || "" },
		}),
	});

	// Get upcoming releases - filter to next two weeks, limit to 10
	const upcomingReleases = calendarData?.items
		? calendarData.items
				.filter((item) => {
					const releaseDate = new Date(item.releaseDate);
					const today = new Date();
					today.setHours(0, 0, 0, 0);
					const twoWeeksLater = new Date(today);
					twoWeeksLater.setDate(today.getDate() + 14);
					return releaseDate >= today && releaseDate <= twoWeeksLater;
				})
				.sort(
					(a, b) =>
						new Date(a.releaseDate).getTime() -
						new Date(b.releaseDate).getTime(),
				)
				.slice(0, 10)
		: [];

	const isLoading =
		shelfLoading ||
		statsLoading ||
		feedLoading ||
		authLoading ||
		calendarLoading;

	// Calculate real stats from shelf data
	const movieCount =
		shelfData?.items?.filter((item) => item.type === "movie").length || 0;
	const showCount =
		shelfData?.items?.filter((item) => item.type === "episode").length || 0;

	const userStats = [
		{
			label: "Movies",
			value: String(movieCount),
			icon: Film,
			change: statsData
				? `+${statsData.recentMovies || 0} this month`
				: "Track your first movie",
		},
		{
			label: "Shows",
			value: String(showCount),
			icon: Tv,
			change: statsData
				? `+${statsData.recentShows || 0} this month`
				: "Track your first show",
		},
		{
			label: "Hours",
			value: String(Math.round(statsData?.totalWatchTimeHours || 0)),
			icon: Clock,
			change: statsData?.weeklyWatchTimeHours
				? `${statsData.weeklyWatchTimeHours}h this week`
				: "Start watching",
		},
		{
			label: "Streak",
			value: String(statsData?.streakDays || 0),
			icon: TrendingUp,
			change:
				statsData?.streakDays && statsData.streakDays > 0
					? "days"
					: "Start a streak",
		},
	];

	// Transform user's tracked content for display from shelf data
	const userContent =
		shelfData?.items?.slice(0, 6).map((item) => {
			if (item.type === "movie") {
				return {
					id: item.movieId,
					title: item.title,
					type: "movie" as const,
					posterUrl: item.posterPath
						? `https://image.tmdb.org/t/p/w500${item.posterPath}`
						: "",
					backdropUrl: item.backdropPath
						? `https://image.tmdb.org/t/p/original${item.backdropPath}`
						: undefined,
					year: item.releaseYear,
					isWatched: !!item.watchedDate,
					watchedDate: item.watchedDate,
				};
			}
			// Episode type
			return {
				id: item.id, // Use the unique tracked episode ID
				showId: item.showId,
				title:
					item.episodeTitle ||
					`${item.showTitle} S${item.seasonNumber}E${item.episodeNumber}`,
				type: "show" as const,
				posterUrl: item.posterPath
					? `https://image.tmdb.org/t/p/w500${item.posterPath}`
					: "",
				backdropUrl: item.backdropPath
					? `https://image.tmdb.org/t/p/original${item.backdropPath}`
					: undefined,
				year: item.firstAirYear,
				episodeInfo: `${item.showTitle} • S${item.seasonNumber}E${item.episodeNumber}`,
				isWatched: !!item.watchedDate,
				watchedDate: item.watchedDate,
			};
		}) || [];

	return (
		<div className="container-app py-8">
			{/* Welcome Section */}
			<div className="mb-8">
				<h1 className="text-display-2 mb-2">
					{`Welcome back, ${user?.displayName || user?.handle || ""}`}
				</h1>
				<p className="text-[var(--foreground-muted)]">@{user?.handle}</p>
			</div>

			{/* Stats Grid */}
			<div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{isLoading
					? // Skeleton stats
						[1, 2, 3, 4].map((i) => (
							<div key={i} className="card p-5 animate-pulse">
								<div className="flex items-center justify-between">
									<div className="space-y-2">
										<div className="h-4 w-16 rounded bg-[var(--background-subtle)]" />
										<div className="h-8 w-12 rounded bg-[var(--background-subtle)]" />
										<div className="h-3 w-20 rounded bg-[var(--background-subtle)]" />
									</div>
									<div className="h-12 w-12 rounded-xl bg-[var(--background-subtle)]" />
								</div>
							</div>
						))
					: userStats.map((stat, index) => {
							const Icon = stat.icon;
							return (
								<div
									key={stat.label}
									className="card p-5"
									style={{ animationDelay: `${index * 50}ms` }}
								>
									<div className="flex items-center justify-between">
										<div>
											<p className="text-sm text-[var(--foreground-muted)]">
												{stat.label}
											</p>
											<p className="text-display-3 mt-1">{stat.value}</p>
											<p className="mt-1 text-xs text-[var(--accent)]">
												{stat.change}
											</p>
										</div>
										<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]">
											<Icon className="h-6 w-6" />
										</div>
									</div>
								</div>
							);
						})}
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				{/* Main Content - Continue Watching */}
				<div className="lg:col-span-2 space-y-8">
					{/* Continue Watching */}
					<section>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-display-3">Your Shelf</h2>
							<Link
								to="/shelf"
								className="flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
							>
								View all
								<ChevronRight className="h-4 w-4" />
							</Link>
						</div>

						{isLoading ? (
							<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{[1, 2, 3, 4, 5, 6].map((i) => (
									<div
										key={i}
										className="aspect-[16/9] animate-pulse rounded-lg bg-[var(--background-subtle)]"
									/>
								))}
							</div>
						) : userContent.length > 0 ? (
							<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{userContent.map((item) => (
									<MediaCard
										key={item.id}
										id={item.id}
										title={item.title}
										posterUrl={item.posterUrl}
										backdropUrl={item.backdropUrl}
										type={item.type}
										year={item.year}
										episodeInfo={item.episodeInfo}
										watchedDate={
											item.watchedDate
												? formatWatchedDate(item.watchedDate)
												: undefined
										}
										layout="backdrop"
										size="md"
									/>
								))}
							</div>
						) : (
							<div className="card p-8 text-center">
								<p className="text-[var(--foreground-muted)] mb-2">
									Your shelf is empty
								</p>
								<p className="text-sm text-[var(--foreground-muted)] mb-4">
									Start tracking movies and shows to see them here!
								</p>
								<Link
									to="/search"
									className="btn btn-primary inline-flex gap-2"
								>
									<Film className="h-4 w-4" />
									Discover Content
								</Link>
							</div>
						)}
					</section>

					{/* Social Feed - Activity from people you follow */}
					<section>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-display-3">Friend Activity</h2>
							<Link
								to="/following"
								className="flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
							>
								<Users className="h-4 w-4" />
								View all
							</Link>
						</div>
						{feedLoading ? (
							<div className="card p-8">
								<div className="space-y-3">
									{[1, 2, 3].map((i) => (
										<div
											key={i}
											className="flex items-center gap-3 animate-pulse"
										>
											<div className="h-10 w-10 rounded-full bg-[var(--background-subtle)]" />
											<div className="flex-1 space-y-1">
												<div className="h-4 w-1/2 rounded bg-[var(--background-subtle)]" />
												<div className="h-3 w-1/3 rounded bg-[var(--background-subtle)]" />
											</div>
										</div>
									))}
								</div>
							</div>
						) : feedData?.items && feedData.items.length > 0 ? (
							<div className="card divide-y divide-[var(--border)]">
								{feedData.items
									.filter(
										(item: FollowedActivityItemDto) => item.content != null,
									)
									.map((item: FollowedActivityItemDto) => (
										<div
											key={item.id}
											className="flex items-start gap-3 p-4 first:pt-5 last:pb-5"
										>
											{/* User Avatar */}
											<img
												src={
													item.actor.avatar ||
													`https://i.pravatar.cc/150?u=${item.actor.did}`
												}
												alt={item.actor.displayName || item.actor.handle}
												className="h-10 w-10 rounded-full object-cover"
											/>
											<div className="flex-1 min-w-0">
												{/* Activity Header */}
												<p className="text-sm">
													<Link
														to={`/profile/${item.actor.handle}`}
														className="font-medium hover:text-[var(--accent)]"
													>
														{item.actor.displayName || item.actor.handle}
													</Link>{" "}
													{item.verb === "watch" && (
														<span className="text-[var(--foreground-muted)]">
															watched
														</span>
													)}
													{item.verb === "follow" && (
														<span className="text-[var(--foreground-muted)]">
															followed
														</span>
													)}
													{item.verb === "list_add" && (
														<span className="text-[var(--foreground-muted)]">
															added to list
														</span>
													)}
												</p>
												{/* Content Title */}
												<p className="font-medium text-sm mt-0.5">
													<Link
														to={`/${item.content.type}/${item.content.id}`}
														className="hover:text-[var(--accent)]"
													>
														{item.content.title}
														{item.content.type === "episode" &&
															item.content.episodeTitle && (
																<span className="text-[var(--foreground-muted)]">
																	{" "}
																	(S{item.content.seasonNumber}E
																	{item.content.episodeNumber})
																</span>
															)}
													</Link>
												</p>
												{/* Timestamp & Actions */}
												<div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--foreground-muted)]">
													<span>{formatRelativeTime(item.createdAt)}</span>
													{item.verb === "watch" && (
														<button
															type="button"
															className="flex items-center gap-1 hover:text-[var(--accent)]"
														>
															<Heart className="h-3 w-3" />
															Like
														</button>
													)}
												</div>
											</div>
											{/* Content Type Badge */}
											<span
												className={`badge ${item.content.type === "movie" ? "badge-subtle" : "badge-accent"}`}
											>
												{item.content.type === "movie" ? "Movie" : "TV"}
											</span>
										</div>
									))}
							</div>
						) : (
							<div className="card p-8 text-center">
								<MessageCircle className="h-12 w-12 mx-auto mb-3 text-[var(--foreground-muted)]" />
								<p className="text-[var(--foreground-muted)]">
									Activity from people you follow will appear here.
								</p>
								<Link
									to="/following"
									className="btn btn-primary mt-4 inline-flex"
								>
									<Users className="h-4 w-4 mr-2" />
									Find people to follow
								</Link>
							</div>
						)}
					</section>
				</div>

				{/* Sidebar */}
				<div className="space-y-8">
					{/* Upcoming */}
					<section>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-display-3">Upcoming</h2>
							<Link
								to="/calendar"
								className="flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
							>
								<Calendar className="h-4 w-4" />
								Calendar
							</Link>
						</div>
						{isLoading ? (
							<div className="card p-4">
								<div className="space-y-3">
									{[1, 2, 3].map((i) => (
										<div
											key={i}
											className="flex items-center gap-3 animate-pulse"
										>
											<div className="h-12 w-9 rounded bg-[var(--background-subtle)]" />
											<div className="flex-1 space-y-1">
												<div className="h-4 w-3/4 rounded bg-[var(--background-subtle)]" />
												<div className="h-3 w-1/2 rounded bg-[var(--background-subtle)]" />
											</div>
										</div>
									))}
								</div>
							</div>
						) : upcomingReleases.length === 0 ? (
							<div className="card p-6 text-center">
								<Clock className="mx-auto mb-3 h-8 w-8 text-[var(--foreground-muted)]" />
								<p className="text-sm text-[var(--foreground-muted)]">
									No upcoming releases
								</p>
								<p className="mt-1 text-xs text-[var(--foreground-muted)]">
									Track shows and movies to see their release dates here.
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{upcomingReleases.map((release) => (
									<Link
										key={`${release.showId || release.movieId || release.title}-${release.releaseDate}`}
										to={
											release.mediaType === "movie" && release.movieId
												? `/movies/${release.movieId}`
												: release.showId
													? `/shows/${release.showId}`
													: "#"
										}
										className="card card-interactive flex items-center gap-3 p-3"
									>
										{release.posterPath ? (
											<img
												src={`https://image.tmdb.org/t/p/w200${release.posterPath}`}
												alt={release.title}
												className="h-12 w-9 rounded object-cover"
											/>
										) : (
											<div className="flex h-12 w-9 items-center justify-center rounded bg-[var(--background-subtle)]">
												{release.mediaType === "movie" ? (
													<Film className="h-5 w-5 text-[var(--foreground-muted)]" />
												) : (
													<Tv className="h-5 w-5 text-[var(--foreground-muted)]" />
												)}
											</div>
										)}
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm truncate">
												{release.title}
											</p>
											<div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
												<span>{formatDate(release.releaseDate)}</span>
												<span className="text-[var(--accent)]">
													• {formatRelativeDate(release.releaseDate)}
												</span>
											</div>
											{getEpisodeInfo(release) && (
												<p className="mt-0.5 text-xs text-[var(--foreground-muted)] truncate">
													{getEpisodeInfo(release)}
												</p>
											)}
										</div>
										<span
											className={`badge ${
												release.mediaType === "movie"
													? "badge-subtle"
													: "badge-accent"
											}`}
										>
											{release.mediaType === "movie" ? "Movie" : "TV"}
										</span>
									</Link>
								))}
							</div>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
