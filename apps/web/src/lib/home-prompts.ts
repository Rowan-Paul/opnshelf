import {
	atStoreReviewsControllerGetPromptOptions,
	usersControllerGetMyCurrentTraktImportOptions,
} from "@opnshelf/api";
import {
	type QueryClient,
	type QueryKey,
	useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

/** The Home prompts that need the API to decide whether they show. */
export const traktHomePromptQuery = () =>
	usersControllerGetMyCurrentTraktImportOptions();

export const atStoreHomePromptQuery = () => ({
	...atStoreReviewsControllerGetPromptOptions(),
	staleTime: 5 * 60 * 1000,
	retry: false,
});

/**
 * Starts the prompts' requests while Home waits for the session check, so
 * their answers are usually cached by the time Home first renders.
 */
export function prefetchHomePrompts(queryClient: QueryClient): void {
	void queryClient.prefetchQuery(traktHomePromptQuery());
	void queryClient.prefetchQuery(atStoreHomePromptQuery());
}

/**
 * Whether a prompt's data was already cached when it mounted. A prompt whose
 * answer arrives after Home is on screen stays hidden until the next visit:
 * showing it late would push the whole page down, and waiting for it would
 * hold the page back for an ask that can just as well come next time.
 */
export function useReadyAtMount(queryKey: QueryKey): boolean {
	const queryClient = useQueryClient();
	const [ready] = useState(
		() => queryClient.getQueryState(queryKey)?.status === "success",
	);
	return ready;
}
