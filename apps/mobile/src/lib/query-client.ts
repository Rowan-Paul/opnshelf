import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient. Mutations in this repo must use stable array-based
 * mutation keys (enforced by the `always-use-mutation-keys` skill); the
 * default mutation options below keep that contract centralized.
 */
export const queryClient = new QueryClient({
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
