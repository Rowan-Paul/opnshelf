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
 * Whether a prompt was eligible when it mounted, judged from the answer that
 * was already cached then. A prompt renders only while this and its current
 * answer both say so: it may disappear during a visit (dismissed, snoozed)
 * but never appear, so a late or refetched answer cannot push Home down. An
 * ask that became eligible meanwhile waits for the next visit, which costs
 * nothing, where holding Home back for it would.
 */
export function useEligibleAtMount<T>(
	queryKey: QueryKey,
	isEligible: (data: T) => boolean,
): boolean {
	const queryClient = useQueryClient();
	const [eligible] = useState(() => {
		const state = queryClient.getQueryState<T>(queryKey);
		return state?.status === "success" && isEligible(state.data as T);
	});
	return eligible;
}
