import { authControllerMeQueryKey } from "@opnshelf/api";
import type { QueryClient } from "@tanstack/react-query";

export async function publishSignedOutAuthState(queryClient: QueryClient) {
	const queryKey = authControllerMeQueryKey();

	await queryClient.cancelQueries({ queryKey });
	queryClient.setQueryData(queryKey, null);
	await queryClient.invalidateQueries({ queryKey });
}
