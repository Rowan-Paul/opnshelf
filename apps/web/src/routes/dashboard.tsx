import type { ReleaseCalendarItemDto, UpNextShowDto } from "@opnshelf/api";
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
	TrendingUp,
	Tv,
} from "lucide-react";
import { useEffect } from "react";
import { FriendsActivitySection } from "#/components/following/FriendsActivitySection";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { withUserLocale } from "#/lib/date-utils";
import { useDashboardStats, useUserShelf } from "#/lib/hooks";
import { useUserUpNext } from "#/lib/hooks/useMedia";
import { useSearchDialog } from "#/lib/search-dialog-context";
import { buildEpisodeUrl, buildMovieUrl, buildShowUrl } from "#/lib/url-utils";
import DashboardMediaCard from "../components/DashboardMediaCard";

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
function formatDate(
	dateStr: string,
	timezone?: string,
	timeFormat?: "12h" | "24h",
): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString(
		"en-US",
		withUserLocale({ month: "short", day: "numeric" }, timezone, timeFormat),
	);
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
function formatWatchedDate(
	dateStr: string,
	timezone?: string,
	timeFormat?: "12h" | "24h",
): string {
	const date = new Date(dateStr);
	const now = new Date();
	const isThisYear = date.getFullYear() === now.getFullYear();
	const timeString = date.toLocaleTimeString(
		"en-US",
		withUserLocale(
			{ hour: "numeric", minute: "2-digit" },
			timezone,
			timeFormat,
		),
	);

	if (isThisYear) {
		const formattedDate = date.toLocaleDateString(
			"en-US",
			withUserLocale({ month: "short", day: "numeric" }, timezone, timeFormat),
		);
		return `${formattedDate} at ${timeString}`;
	}
	const formattedDate = date.toLocaleDateString(
		"en-US",
		withUserLocale(
			{ month: "short", day: "numeric", year: "numeric" },
			timezone,
			timeFormat,
		),
	);
	return `${formattedDate} at ${timeString}`;
}

function Dashboard() {
	const {
		user,
		userSettings,
		isAuthenticated,
		isLoading: authLoading,
	} = useAuth();
	const navigate = useNavigate();
	const { setOpen: setSearchOpen } = useSearchDialog();
	const userDid = user?.did;
	const userTimezone = userSettings?.timezone;
	const userTimeFormat = userSettings?.timeFormat;

	// Redirect to login if not authenticated, or onboarding if needed
	useEffect(() => {
		if (!authLoading) {
			if (!isAuthenticated) {
				navigate({ to: "/login" });
			} else if (user?.needsOnboarding) {
				navigate({ to: "/onboarding" });
			}
		}
	}, [authLoading, isAuthenticated, user?.needsOnboarding, navigate]);

	// Fetch user data from API
	const { data: shelfData, isLoading: shelfLoading } = useUserShelf(
		userDid || "",
		6,
	);
	const { data: statsData, isLoading: statsLoading } = useDashboardStats(
		userDid || "",
	);
	const { data: upNextData, isLoading: upNextLoading } = useUserUpNext(
		userDid || "",
	);

	// Fetch social activity feed
	const { data: feedData, isLoading: feedLoading } = useQuery({
		...socialControllerGetFeedOptions({
			query: { pageSize: 6 },
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
				? `${statsData.watchedLast30Days || 0} watched this month`
				: "Track your first movie",
		},
		{
			label: "Shows",
			value: String(showCount),
			icon: Tv,
			change: statsData
				? `${statsData.watchedLast7Days || 0} watched this week`
				: "Track your first show",
		},
		{
			label: "Activity",
			value: String(statsData?.watchedLast7Days || 0),
			icon: Clock,
			change: statsData?.dailyActivity?.length
				? `${statsData.dailyActivity.length} active days`
				: "Start watching",
		},
		{
			label: "This Month",
			value: String(statsData?.watchedLast30Days || 0),
			icon: TrendingUp,
			change:
				statsData?.watchedLast30Days && statsData.watchedLast30Days > 0
					? "total watched"
					: "Start tracking",
		},
	];

	// Transform user's tracked content for display from shelf data
	const userContent =
		shelfData?.items?.slice(0, 6).map((item) => {
			const base = {
				key: item.id, // unique shelf entry id for React key
				isWatched: !!item.watchedDate,
				watchedDate: item.watchedDate,
			};
			if (item.type === "movie") {
				return {
					...base,
					id: item.movieId,
					showId: undefined,
					title: item.title,
					type: "movie" as const,
					posterUrl: item.posterPath
						? `https://image.tmdb.org/t/p/w500${item.posterPath}`
						: "",
					backdropUrl: item.backdropPath
						? `https://image.tmdb.org/t/p/original${item.backdropPath}`
						: undefined,
					year: item.releaseYear,
					displayTitle: undefined,
					seasonNumber: undefined,
					episodeNumber: undefined,
					episodeInfo: undefined,
				};
			}
			// Episode type
			return {
				...base,
				id: `${item.showId}-${item.seasonNumber}-${item.episodeNumber}`, // Unique ID for each episode
				showId: item.showId,
				title: item.showTitle, // Use show title for URL building
				displayTitle:
					item.episodeTitle ||
					`${item.showTitle} S${item.seasonNumber}E${item.episodeNumber}`,
				seasonNumber: item.seasonNumber,
				episodeNumber: item.episodeNumber,
				type: "show" as const,
				posterUrl: item.posterPath
					? `https://image.tmdb.org/t/p/w500${item.posterPath}`
					: "",
				backdropUrl: item.backdropPath
					? `https://image.tmdb.org/t/p/original${item.backdropPath}`
					: undefined,
				year: item.firstAirYear,
				episodeInfo: `${item.showTitle} • S${item.seasonNumber}E${item.episodeNumber}`,
			};
		}) || [];

	// Transform "Up Next" data for display
	const upNextContent =
		upNextData?.items?.slice(0, 6).map((item: UpNextShowDto) => {
			return {
				id: item.show.showId,
				title: item.show.title,
				displayTitle: item.nextEpisode.name,
				seasonNumber: item.nextEpisode.seasonNumber,
				episodeNumber: item.nextEpisode.episodeNumber,
				type: "show" as const,
				posterUrl: item.show.posterPath
					? `https://image.tmdb.org/t/p/w500${item.show.posterPath}`
					: "",
				backdropUrl: item.show.backdropPath
					? `https://image.tmdb.org/t/p/original${item.show.backdropPath}`
					: undefined,
				year: item.show.firstAirYear,
				episodeInfo: `${item.show.title} • S${item.nextEpisode.seasonNumber}E${item.nextEpisode.episodeNumber}`,
			};
		}) || [];

	return (
		<div className="container-app py-8">
			{/* Welcome Section */}
			<div className="mb-8">
				<h1 className="mb-2 text-display-2">
					{`Welcome back, ${user?.displayName || user?.handle || ""}`}
				</h1>
				<p className="text-(--foreground-muted)">@{user?.handle}</p>
			</div>

			{/* Stats Grid */}
			<div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
				{isLoading
					? // Skeleton stats
						[1, 2, 3, 4].map((i) => (
							<div key={i} className="card animate-pulse p-4 sm:p-5">
								<div className="flex items-center gap-3 sm:items-center sm:justify-between">
									<div className="order-1 h-10 w-10 rounded-lg bg-(--background-subtle) sm:order-2 sm:h-12 sm:w-12 sm:rounded-xl" />
									<div className="order-2 space-y-1 sm:order-1 sm:space-y-2">
										<div className="h-3 w-14 rounded bg-(--background-subtle) sm:h-4 sm:w-16" />
										<div className="h-6 w-10 rounded bg-(--background-subtle) sm:h-8 sm:w-12" />
										<div className="hidden h-3 w-20 rounded bg-(--background-subtle) sm:block" />
									</div>
								</div>
							</div>
						))
					: userStats.map((stat, index) => {
							const Icon = stat.icon;
							return (
								<div
									key={stat.label}
									className="card p-4 sm:p-5"
									style={{ animationDelay: `${index * 50}ms` }}
								>
									<div className="flex items-center gap-3 sm:items-center sm:justify-between">
										<div className="order-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent-subtle) text-(--accent) sm:order-2 sm:h-12 sm:w-12 sm:rounded-xl">
											<Icon className="h-5 w-5 sm:h-6 sm:w-6" />
										</div>
										<div className="order-2 sm:order-1">
											<p className="text-(--foreground-muted) text-sm">
												{stat.label}
											</p>
											<p className="font-semibold text-lg sm:mt-1 sm:text-display-3">
												{stat.value}
											</p>
											<p className="hidden text-(--accent) text-xs sm:mt-1 sm:block">
												{stat.change}
											</p>
										</div>
									</div>
								</div>
							);
						})}
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				{/* Main Content - Continue Watching */}
				<div className="space-y-8 lg:col-span-2">
					{/* Up Next - Shows the next episodes to watch */}
					<section>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-display-3">Up Next</h2>
							{user && (
								<Link
									to="/profile/$handle/up-next"
									params={{ handle: user.handle }}
									className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
								>
									View all
									<ChevronRight className="size-4" />
								</Link>
							)}
						</div>

						{upNextLoading ? (
							<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{[1, 2, 3, 4, 5, 6].map((i) => (
									<div
										key={i}
										className="aspect-video animate-pulse rounded-lg bg-(--background-subtle)"
									/>
								))}
							</div>
						) : upNextContent.length > 0 ? (
							<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{upNextContent.map((item) => (
									<DashboardMediaCard
										key={`${item.id}-${item.seasonNumber}-${item.episodeNumber}`}
										id={item.id}
										showId={item.id}
										title={item.title}
										displayTitle={item.displayTitle}
										seasonNumber={item.seasonNumber}
										episodeNumber={item.episodeNumber}
										posterUrl={item.posterUrl}
										backdropUrl={item.backdropUrl}
										type={item.type}
										episodeInfo={item.episodeInfo}
										layout="backdrop"
										size="md"
									/>
								))}
							</div>
						) : (
							<div className="card p-8 text-center">
								<Tv className="mx-auto mb-3 size-12 text-(--foreground-muted)" />
								<p className="mb-2 text-(--foreground-muted)">
									You're all caught up!
								</p>
								<p className="mb-4 text-(--foreground-muted) text-sm">
									Start tracking shows to see your next episodes here.
								</p>
								<button
									type="button"
									onClick={() => setSearchOpen(true)}
									className="btn btn-primary inline-flex gap-2"
								>
									<Tv className="size-4" />
									Discover Shows
								</button>
							</div>
						)}
					</section>

					{/* Continue Watching */}
					<section>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-display-3">Your Shelf</h2>
							{user && (
								<Link
									to="/profile/$handle/shelf"
									params={{ handle: user.handle }}
									className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
								>
									View all
									<ChevronRight className="size-4" />
								</Link>
							)}
						</div>

						{isLoading ? (
							<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{[1, 2, 3, 4, 5, 6].map((i) => (
									<div
										key={i}
										className="aspect-video animate-pulse rounded-lg bg-(--background-subtle)"
									/>
								))}
							</div>
						) : userContent.length > 0 ? (
							<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{userContent.map((item) => (
									<DashboardMediaCard
										key={item.key}
										id={item.id}
										showId={item.showId}
										title={item.title}
										displayTitle={item.displayTitle}
										seasonNumber={item.seasonNumber}
										episodeNumber={item.episodeNumber}
										posterUrl={item.posterUrl}
										backdropUrl={item.backdropUrl}
										type={item.type}
										episodeInfo={item.episodeInfo}
										isWatched={item.isWatched}
										watchedDate={
											item.watchedDate
												? formatWatchedDate(
														item.watchedDate,
														userTimezone,
														userTimeFormat,
													)
												: undefined
										}
										layout="backdrop"
										size="md"
									/>
								))}
							</div>
						) : (
							<div className="card p-8 text-center">
								<p className="mb-2 text-(--foreground-muted)">
									Your shelf is empty
								</p>
								<p className="mb-4 text-(--foreground-muted) text-sm">
									Start tracking movies and shows to see them here!
								</p>
								<button
									type="button"
									onClick={() => setSearchOpen(true)}
									className="btn btn-primary inline-flex gap-2"
								>
									<Film className="size-4" />
									Discover Content
								</button>
							</div>
						)}
					</section>

					{/* Social Feed - Activity from people you follow */}
					<FriendsActivitySection
						items={feedData?.items ?? []}
						isLoading={feedLoading}
						userTimezone={userTimezone}
						userTimeFormat={userTimeFormat}
					/>
				</div>

				{/* Sidebar */}
				<div className="space-y-8">
					{/* Upcoming */}
					<section>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-display-3">Upcoming</h2>
							<Link
								to="/calendar"
								className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
							>
								<Calendar className="size-4" />
								Calendar
							</Link>
						</div>
						{isLoading ? (
							<div className="card p-4">
								<div className="space-y-3">
									{[1, 2, 3].map((i) => (
										<div
											key={i}
											className="flex animate-pulse items-center gap-3"
										>
											<div className="h-12 w-9 rounded bg-(--background-subtle)" />
											<div className="flex-1 space-y-1">
												<div className="h-4 w-3/4 rounded bg-(--background-subtle)" />
												<div className="h-3 w-1/2 rounded bg-(--background-subtle)" />
											</div>
										</div>
									))}
								</div>
							</div>
						) : upcomingReleases.length === 0 ? (
							<div className="card p-6 text-center">
								<Clock className="mx-auto mb-3 size-8 text-(--foreground-muted)" />
								<p className="text-(--foreground-muted) text-sm">
									No upcoming releases
								</p>
								<p className="mt-1 text-(--foreground-muted) text-xs">
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
												? buildMovieUrl(release.movieId, release.title)
												: release.mediaType === "show" &&
														release.releaseKind === "episode" &&
														release.showId &&
														release.seasonNumber !== undefined &&
														release.episodeNumber !== undefined
													? buildEpisodeUrl(
															release.showId,
															release.title,
															release.seasonNumber,
															release.episodeNumber,
														)
													: release.showId
														? buildShowUrl(release.showId, release.title)
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
											<div className="flex h-12 w-9 items-center justify-center rounded bg-(--background-subtle)">
												{release.mediaType === "movie" ? (
													<Film className="size-5 text-(--foreground-muted)" />
												) : (
													<Tv className="size-5 text-(--foreground-muted)" />
												)}
											</div>
										)}
										<div className="min-w-0 flex-1">
											<p className="truncate font-medium text-sm">
												{release.title}
											</p>
											<div className="mt-0.5 flex items-center gap-2 text-(--foreground-muted) text-xs">
												<span>
													{formatDate(
														release.releaseDate,
														userTimezone,
														userTimeFormat,
													)}
												</span>
												<span className="text-(--accent)">
													• {formatRelativeDate(release.releaseDate)}
												</span>
											</div>
											{getEpisodeInfo(release) && (
												<p className="mt-0.5 truncate text-(--foreground-muted) text-xs">
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
