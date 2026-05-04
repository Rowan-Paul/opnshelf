import {
	type MoviesControllerDiscoverMoviesResponse,
	moviesControllerDiscoverMoviesOptions,
	type ShelfActivitySummaryDto,
	type ShelfResponseDto,
	type ShowsControllerDiscoverShowsResponse,
	shelfControllerGetUserActivitySummaryOptions,
	shelfControllerGetUserShelfOptions,
	showsControllerDiscoverShowsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "#/lib/date-utils";

// Utility function to format relative time
function getRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSecs < 60) return "just now";
	if (diffMins < 60)
		return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
	if (diffHours < 24)
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
	return formatDate(dateString);
}

// Activity item type
export interface ActivityItem {
	id: string;
	title: string;
	action: string;
	date: string;
	type: "movie" | "show";
	user: string;
}

// Transform shelf data to activity items
function transformShelfToActivity(
	shelfData: ShelfResponseDto,
	userName: string = "You",
): ActivityItem[] {
	if (!shelfData?.items) return [];

	return shelfData.items.slice(0, 10).map((item) => {
		const isMovie = item.type === "movie";
		const date = item.watchedDate || item.createdAt;

		return {
			id: item.id,
			title: isMovie
				? item.title
				: `${item.showTitle} S${item.seasonNumber}E${item.episodeNumber}`,
			action: item.watchedDate ? "watched" : "added",
			date: getRelativeTime(date),
			type: isMovie ? "movie" : "show",
			user: userName,
		};
	});
}

// Dashboard stats hook
export function useDashboardStats(userDid: string) {
	return useQuery({
		...shelfControllerGetUserActivitySummaryOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});
}

// User's shelf (library) - combines movies and episodes
export function useUserShelf(userDid: string, pageSize = 10) {
	return useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { page: 1, pageSize },
		}),
		enabled: !!userDid,
	});
}

// User's recent activity from shelf
export function useUserShelfActivity(
	userDid: string,
	userName: string = "You",
) {
	return useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { page: 1, pageSize: 10 },
		}),
		enabled: !!userDid,
		select: (data) => transformShelfToActivity(data, userName),
	});
}

// Discover movies for "Continue Watching" or recommendations
export function useDiscoverMovies(_page = 1) {
	return useQuery({
		...moviesControllerDiscoverMoviesOptions(),
	});
}

// Discover shows
export function useDiscoverShows(_page = 1) {
	return useQuery({
		...showsControllerDiscoverShowsOptions(),
	});
}

// Combined discover hook for dashboard
export function useDashboardContent(userDid: string | null) {
	const moviesQuery = useDiscoverMovies(1);
	const showsQuery = useDiscoverShows(1);
	const statsQuery = useDashboardStats(userDid || "");

	return {
		movies: moviesQuery.data?.results || [],
		shows: showsQuery.data?.results || [],
		stats: statsQuery.data,
		isLoading:
			moviesQuery.isLoading || showsQuery.isLoading || statsQuery.isLoading,
		isError: moviesQuery.isError || showsQuery.isError || statsQuery.isError,
		error: moviesQuery.error || showsQuery.error || statsQuery.error,
	};
}

// Type exports for convenience
export type {
	MoviesControllerDiscoverMoviesResponse,
	ShowsControllerDiscoverShowsResponse,
	ShelfActivitySummaryDto,
};

// Re-export ActivityItem type with explicit naming to avoid conflicts
export type { ActivityItem as DashboardActivityItem };
