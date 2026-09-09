import { QueryClient } from "@tanstack/react-query";
import { createReportingMutationCache } from "#/lib/report-mutation-failure";

export function getContext() {
	const queryClient = new QueryClient({
		mutationCache: createReportingMutationCache(),
	});

	return {
		queryClient,
	};
}
export default function TanstackQueryProvider() {}
