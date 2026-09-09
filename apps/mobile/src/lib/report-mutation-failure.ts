import { describeMutationFailure } from "@opnshelf/api";
import { MutationCache } from "@tanstack/react-query";
import { posthog } from "@/lib/posthog";

/**
 * MutationCache for the shared QueryClient. Every failed mutation becomes one
 * PostHog exception event, so "handled" failures that only surface as a toast
 * still show up in error tracking. See `describeMutationFailure` for what is
 * and is not sent. `posthog` is null outside the production API, which keeps
 * Staging and local runs out of the numbers.
 */
export function createReportingMutationCache(): MutationCache {
	return new MutationCache({
		onError: (error, _variables, _onMutateResult, mutation) => {
			if (!posthog) return;
			const report = describeMutationFailure(
				error,
				mutation.options.mutationKey,
			);
			if (report) posthog.captureException(report.error, report.properties);
		},
	});
}
