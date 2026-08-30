import {
	usersControllerGetPublicFollowersOptions,
	usersControllerGetPublicFollowingOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";

export function usePublicFollowers(handle: string, page = 1, pageSize = 20) {
	return useQuery({
		...usersControllerGetPublicFollowersOptions({
			path: { handle },
			query: { page, pageSize },
		}),
		enabled: !!handle,
	});
}

export function usePublicFollowing(handle: string, page = 1, pageSize = 20) {
	return useQuery({
		...usersControllerGetPublicFollowingOptions({
			path: { handle },
			query: { page, pageSize },
		}),
		enabled: !!handle,
	});
}
