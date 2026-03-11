import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";

export function useCurrentUser() {
	return useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
}
