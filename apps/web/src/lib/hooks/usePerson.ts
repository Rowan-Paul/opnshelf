import {
	peopleControllerGetPersonDetailsOptions,
	peopleControllerGetPersonFilmographyInfiniteOptions,
} from "@opnshelf/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

// Person detail hook
export function usePersonDetails(personId: string) {
	return useQuery({
		...peopleControllerGetPersonDetailsOptions({
			path: { personId },
		}),
		enabled: !!personId,
	});
}

// Person filmography infinite query hook
export function usePersonFilmography(personId: string, pageSize = 20) {
	return useInfiniteQuery({
		...peopleControllerGetPersonFilmographyInfiniteOptions({
			path: { personId },
			query: { pageSize },
		}),
		enabled: !!personId,
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
	});
}
