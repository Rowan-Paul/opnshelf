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
	const pending = new WeakMap<
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
			const state = {
				startedIn: appState(),
				backgrounded: AppState.currentState === "background",
				remove: () => {},
			};
			const subscription = AppState.addEventListener("change", (next) => {
				if (next === "background") state.backgrounded = true;
			});
			state.remove = () => subscription.remove();
			pending.set(mutation, state);
		},
		onSettled: (_data, _error, _variables, _context, mutation) => {
			pending.get(mutation)?.remove();
			pending.delete(mutation);
		},
		onError: (error, _variables, _onMutateResult, mutation) => {
			if (!posthog) return;
			const report = describeMutationFailure(
				error,
				mutation.options.mutationKey,
				{ pathname: getCurrentPathname(), release },
			);
			if (report) {
				const state = pending.get(mutation);
				posthog.captureException(report.error, {
					...report.properties,
					app_state_at_start: state?.startedIn ?? "unknown",
					app_state_at_failure: appState(),
					app_backgrounded_while_pending: state?.backgrounded ?? null,
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
