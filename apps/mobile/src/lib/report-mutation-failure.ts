import { describeMutationFailure } from "@opnshelf/api";
import { MutationCache } from "@tanstack/react-query";
import { AppState } from "react-native";
import { getCurrentPathname, posthog, release } from "@/lib/posthog";

/**
 * MutationCache for the shared QueryClient. Every failed mutation becomes one
 * PostHog exception event, so "handled" failures that only surface as a toast
 * still show up in error tracking. See `describeMutationFailure` for what is
 * and is not sent. `posthog` is null outside the production API, which keeps
 * Staging and local runs out of the numbers.
 */
export function createReportingMutationCache(): MutationCache {
	const lifecycleByMutation = new WeakMap<
		object,
		{
			startedIn: ReturnType<typeof appState>;
			backgrounded: boolean;
			remove: () => void;
		}
	>();
	return new MutationCache({
		onMutate: (_variables, mutation) => {
			if (!posthog) return;
			const lifecycle = {
				startedIn: appState(),
				backgrounded: AppState.currentState === "background",
				remove: () => {},
			};
			const subscription = AppState.addEventListener("change", (next) => {
				if (next === "background") lifecycle.backgrounded = true;
			});
			lifecycle.remove = () => subscription.remove();
			lifecycleByMutation.set(mutation, lifecycle);
		},
		onSettled: (_data, _error, _variables, _context, mutation) => {
			lifecycleByMutation.get(mutation)?.remove();
			lifecycleByMutation.delete(mutation);
		},
		onError: (error, _variables, _onMutateResult, mutation) => {
			if (!posthog) return;
			const report = describeMutationFailure(
				error,
				mutation.options.mutationKey,
				{ pathname: getCurrentPathname(), release },
			);
			if (report) {
				const lifecycle = lifecycleByMutation.get(mutation);
				posthog.captureException(report.error, {
					...report.properties,
					app_state_at_start: lifecycle?.startedIn ?? "unknown",
					app_state_at_failure: appState(),
					app_backgrounded_while_pending: lifecycle?.backgrounded ?? null,
				});
			}
		},
	});
}

function appState(): "active" | "inactive" | "background" | "unknown" {
	const state = AppState.currentState;
	return state === "active" || state === "inactive" || state === "background"
		? state
		: "unknown";
}
