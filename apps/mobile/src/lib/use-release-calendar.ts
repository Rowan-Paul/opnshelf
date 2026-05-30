import { showsControllerGetUserReleaseCalendarOptions } from "@opnshelf/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

/**
 * Upcoming releases for the current user's tracked shows/watchlist within a
 * date range (YYYY-MM-DD). Mirrors the web calendar route over the shared
 * `showsControllerGetUserReleaseCalendar` procedure. Previous data is kept
 * while a new range loads so week navigation stays smooth.
 */
export function useReleaseCalendar(startDate: string, endDate: string) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did ?? "";

	return useQuery({
		...showsControllerGetUserReleaseCalendarOptions({
			path: { userDid },
			query: { startDate, endDate },
		}),
		enabled: isAuthenticated && !!userDid,
		placeholderData: keepPreviousData,
		staleTime: 5 * 60 * 1000,
	});
}
