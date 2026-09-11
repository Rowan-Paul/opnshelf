import {
	listsControllerGetPublicUserListOptions,
	listsControllerGetPublicUserListsOptions,
	notesControllerGetUserNotes,
	notesControllerGetUserNotesInfiniteQueryKey,
	notesControllerGetUserNotesOptions,
	reviewsControllerGetUserReviews,
	reviewsControllerGetUserReviewsInfiniteQueryKey,
	reviewsControllerGetUserReviewsOptions,
	shelfControllerGetUserShelfInfiniteOptions,
	shelfControllerGetUserShelfOptions,
	showsControllerGetUserUpNextInfiniteOptions,
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

export type ProfileShelfFilters = {
	type?: "movie" | "episode";
	search?: string;
	sortOrder?: "asc" | "desc";
};

const SHELF_PAGE_SIZE = 24;

function shelfQuery(
	{ type, search, sortOrder = "desc" }: ProfileShelfFilters,
	page?: number,
) {
	return {
		...(page ? { page } : {}),
		pageSize: SHELF_PAGE_SIZE,
		sortOrder,
		...(type ? { type } : {}),
		...(search?.trim() ? { search: search.trim() } : {}),
	};
}

/** First page of the user's public shelf (Home and self-profile previews). */
export function useProfileShelf(
	userDid: string,
	options: ProfileShelfFilters & { page?: number } = {},
) {
	const { page = 1, ...filters } = options;
	return useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: shelfQuery(filters, page),
		}),
		enabled: !!userDid,
	});
}

/**
 * The user's public shelf accumulated page by page (Shelf tab). Every filter is
 * part of the query key, so changing one restarts from page 1 instead of
 * appending onto pages fetched under the old filter.
 */
export function useInfiniteProfileShelf(
	userDid: string,
	filters: ProfileShelfFilters = {},
) {
	return useInfiniteQuery({
		...shelfControllerGetUserShelfInfiniteOptions({
			path: { userDid },
			query: shelfQuery(filters),
		}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
		enabled: !!userDid,
	});
}

const UP_NEXT_PAGE_SIZE = 20;

/** First page of Up Next (in-progress shows + their next episode). */
export function useProfileUpNext(userDid: string, page = 1) {
	return useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid },
			query: { page, pageSize: UP_NEXT_PAGE_SIZE },
		}),
		enabled: !!userDid,
	});
}

/** Up Next accumulated page by page (Up Next tab). */
export function useInfiniteProfileUpNext(userDid: string) {
	return useInfiniteQuery({
		...showsControllerGetUserUpNextInfiniteOptions({
			path: { userDid },
			query: { pageSize: UP_NEXT_PAGE_SIZE },
		}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
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

/** One page of the user's notes. */
export function useProfileNotes(userDid: string, page = 1, pageSize = 20) {
	return useQuery({
		...notesControllerGetUserNotesOptions({
			path: { userDid },
			query: { page, pageSize },
		}),
		enabled: !!userDid,
	});
}

/** The user's notes accumulated page by page (Notes tab). */
export function useInfiniteProfileNotes(userDid: string, pageSize = 20) {
	const options = { path: { userDid }, query: { pageSize } };

	return useInfiniteQuery({
		queryKey: notesControllerGetUserNotesInfiniteQueryKey(options),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await notesControllerGetUserNotes({
				...options,
				query: { ...options.query, page: pageParam },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
		enabled: !!userDid,
	});
}

/** One page of the user's reviews (Overview preview). */
export function useProfileReviews(userDid: string, page = 1, pageSize = 20) {
	return useQuery({
		...reviewsControllerGetUserReviewsOptions({
			path: { userDid },
			query: { page, pageSize },
		}),
		enabled: !!userDid,
	});
}

/** The user's reviews accumulated page by page (Reviews tab). */
export function useInfiniteProfileReviews(userDid: string, pageSize = 20) {
	const options = { path: { userDid }, query: { pageSize } };

	return useInfiniteQuery({
		queryKey: reviewsControllerGetUserReviewsInfiniteQueryKey(options),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await reviewsControllerGetUserReviews({
				...options,
				query: { ...options.query, page: pageParam },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
		enabled: !!userDid,
	});
}
