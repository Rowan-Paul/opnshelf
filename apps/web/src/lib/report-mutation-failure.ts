import { describeMutationFailure } from "@opnshelf/api";
import { MutationCache } from "@tanstack/react-query";
import { isPostHogEnabled, posthog } from "#/integrations/posthog/provider";

/**
 * MutationCache for the app's QueryClient. Every failed mutation becomes one
 * PostHog exception event, so "handled" failures that only surface as a toast
 * still show up in error tracking. See `describeMutationFailure` for what is
 * and is not sent.
 */
export function createReportingMutationCache(): MutationCache {
	return new MutationCache({
		onError: (error, _variables, _onMutateResult, mutation) => {
			if (!isPostHogEnabled) return;
			const report = describeMutationFailure(
				error,
				mutation.options.mutationKey,
			);
			if (report) posthog.captureException(report.error, report.properties);
		},
	});
}
