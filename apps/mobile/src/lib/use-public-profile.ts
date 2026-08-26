import {
	listsControllerGetPublicUserListOptions,
	listsControllerGetPublicUserListsOptions,
	moviesControllerGetUserMoviesPaginatedOptions,
	notesControllerGetUserNotes,
	notesControllerGetUserNotesInfiniteQueryKey,
	notesControllerGetUserNotesOptions,
	reviewsControllerGetUserReviews,
	reviewsControllerGetUserReviewsInfiniteQueryKey,
	reviewsControllerGetUserReviewsOptions,
	shelfControllerGetUserShelfOptions,
	showsControllerGetUserUpNextOptions,
	socialControllerGetRelationshipOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

/**
 * Data hooks for the public profile screen. These wrap the same generated
 * query options the web profile pages use, so the numbers (stats, shelf,
 * lists, notes, reviews) stay identical across web and mobile.
 *
 * The profile is keyed by `handle`; everything else is keyed by the resolved
 * `userDid` and stays disabled until the profile resolves.
 */

/** Public profile (header info + stats strip + follower counts). */
export function usePublicProfile(handle: string) {
	return useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
		enabled: !!handle,
	});
}

/** Follow relationship to a target user (drives the header follow button). */
export function useRelationship(targetDid: string, enabled: boolean) {
	return useQuery({
		...socialControllerGetRelationshipOptions({ path: { targetDid } }),
		enabled: enabled && !!targetDid,
	});
}

/** Recent watched movies (Overview row). */
export function useProfileRecentMovies(userDid: string, limit = 10) {
	return useQuery({
		...moviesControllerGetUserMoviesPaginatedOptions({
			path: { userDid },
			query: { limit },
		}),
		enabled: !!userDid,
	});
}

/** The user's public shelf (Shelf tab), filterable + paginated server-side. */
export function useProfileShelf(
	userDid: string,
	options: {
		page?: number;
		type?: "movie" | "episode";
		search?: string;
		sortOrder?: "asc" | "desc";
	} = {},
) {
	const { page = 1, type, search, sortOrder = "desc" } = options;
	return useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: {
				page,
				pageSize: 24,
				sortOrder,
				...(type ? { type } : {}),
				...(search?.trim() ? { search: search.trim() } : {}),
			},
		}),
		enabled: !!userDid,
	});
}

/** Up Next (in-progress shows + their next episode). */
export function useProfileUpNext(userDid: string, page = 1) {
	return useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid },
			query: { page, pageSize: 20 },
		}),
		enabled: !!userDid,
	});
}

/** Public list summaries for the user (Lists tab). */
export function useProfileLists(userDid: string) {
	return useQuery({
		...listsControllerGetPublicUserListsOptions({ path: { userDid } }),
		enabled: !!userDid,
	});
}

/** A single public list with its items (used for Overview previews). */
export function useProfileList(userDid: string, slug: string, enabled = true) {
	return useQuery({
		...listsControllerGetPublicUserListOptions({ path: { userDid, slug } }),
		enabled: !!userDid && !!slug && enabled,
	});
}

/** The user's notes (Notes tab), cursor-paginated. */
export function useProfileNotes(userDid: string, cursor?: string, limit = 20) {
	return useQuery({
		...notesControllerGetUserNotesOptions({
			path: { userDid },
			query: { limit, ...(cursor ? { cursor } : {}) },
		}),
		enabled: !!userDid,
	});
}

/** The user's notes as accumulated cursor pages (Notes tab). */
export function useInfiniteProfileNotes(userDid: string, limit = 20) {
	const options = { path: { userDid }, query: { limit } };

	return useInfiniteQuery({
		queryKey: notesControllerGetUserNotesInfiniteQueryKey(options),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await notesControllerGetUserNotes({
				...options,
				query: {
					...options.query,
					...(pageParam !== undefined ? { cursor: pageParam } : {}),
				},
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		enabled: !!userDid,
	});
}

/** The user's reviews (Reviews tab + Overview preview), cursor-paginated. */
export function useProfileReviews(
	userDid: string,
	cursor?: string,
	limit = 20,
) {
	return useQuery({
		...reviewsControllerGetUserReviewsOptions({
			path: { userDid },
			query: { limit, ...(cursor ? { cursor } : {}) },
		}),
		enabled: !!userDid,
	});
}

/** The user's reviews as accumulated cursor pages (Reviews tab). */
export function useInfiniteProfileReviews(userDid: string, limit = 20) {
	const options = { path: { userDid }, query: { limit } };

	return useInfiniteQuery({
		queryKey: reviewsControllerGetUserReviewsInfiniteQueryKey(options),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await reviewsControllerGetUserReviews({
				...options,
				query: {
					...options.query,
					...(pageParam !== undefined ? { cursor: pageParam } : {}),
				},
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		enabled: !!userDid,
	});
}
