import {
	peopleControllerGetPersonDetailsOptions,
	peopleControllerGetPersonFilmographyInfiniteOptions,
} from "@opnshelf/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

/**
 * Person detail + filmography hooks, mirroring the web `usePersonDetails` /
 * `usePersonFilmography` so both clients pull from the same generated
 * `@opnshelf/api` procedures.
 */
export function usePersonDetails(personId: string) {
	return useQuery({
		...peopleControllerGetPersonDetailsOptions({ path: { personId } }),
		enabled: !!personId,
	});
}

export function usePersonFilmography(personId: string, pageSize = 20) {
	return useInfiniteQuery({
		...peopleControllerGetPersonFilmographyInfiniteOptions({
			path: { personId },
			query: { pageSize },
		}),
		enabled: !!personId,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
	});
}
