import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";

export function usePublicProfile(handle: string) {
	return useQuery({
		...usersControllerGetPublicProfileOptions({
			path: { handle },
		}),
		retry: false,
	});
}
