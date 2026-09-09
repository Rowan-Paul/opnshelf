import { QueryClient } from "@tanstack/react-query";
import { createReportingMutationCache } from "@/lib/report-mutation-failure";

/**
 * Shared QueryClient. Mutations in this repo must use stable array-based
 * mutation keys (enforced by the `always-use-mutation-keys` skill); the
 * default mutation options below keep that contract centralized, and the
 * mutation cache reports every failure to PostHog under that key.
 */
export const queryClient = new QueryClient({
	mutationCache: createReportingMutationCache(),
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000,
			refetchOnWindowFocus: false,
			retry: 2,
		},
		mutations: {
			retry: 0,
		},
	},
});
