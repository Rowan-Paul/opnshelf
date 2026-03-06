import type { QueryClient } from "@tanstack/react-query";

type QueryKeyRoot = {
	_id?: string;
	path?: {
		userDid?: string;
	};
};

export function invalidateUserShelfQueries(
	queryClient: QueryClient,
	userDid?: string,
) {
	if (!userDid) return;

	queryClient.invalidateQueries({
		predicate: (query) => {
			const key = query.queryKey[0] as QueryKeyRoot | undefined;
			return (
				key?._id === "shelfControllerGetUserShelf" && key.path?.userDid === userDid
			);
		},
	});
}

export function invalidateUserUpNextQueries(
	queryClient: QueryClient,
	userDid?: string,
) {
	if (!userDid) return;

	queryClient.invalidateQueries({
		predicate: (query) => {
			const key = query.queryKey[0] as QueryKeyRoot | undefined;
			return (
				key?._id === "showsControllerGetUserUpNext" &&
				key.path?.userDid === userDid
			);
		},
	});
}
