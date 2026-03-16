import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";

export function usePublicProfile(handle: string | undefined) {
	const normalizedHandle = (handle ?? "").trim().replace(/^@/, "").toLowerCase();

	return useQuery({
		...usersControllerGetPublicProfileOptions({
			path: { handle: normalizedHandle },
		}),
		enabled: normalizedHandle.length > 0,
		retry: false,
	});
}
