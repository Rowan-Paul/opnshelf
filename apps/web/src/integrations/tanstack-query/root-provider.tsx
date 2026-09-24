import { retryTransientFailures } from "@opnshelf/api";
import { QueryClient } from "@tanstack/react-query";
import { createReportingMutationCache } from "#/lib/report-mutation-failure";

export function getContext() {
	const queryClient = new QueryClient({
		mutationCache: createReportingMutationCache(),
		defaultOptions: {
			queries: {
				// With the default of 0, every query a loader fetched during SSR is
				// stale on arrival, so the browser fetched it again the moment the
				// page hydrated. Matches Mobile's query-client.ts.
				staleTime: 60 * 1000,
				retry: retryTransientFailures,
			},
		},
	});

	return {
		queryClient,
	};
}
export default function TanstackQueryProvider() {}
