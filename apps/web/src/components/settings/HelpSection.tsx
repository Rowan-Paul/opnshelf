import {
	authControllerMeQueryKey,
	type UserDto,
	usersControllerResetOnboardingMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { TOUR_REPLAY_EVENT } from "#/components/tour/WelcomeTour";

/** Recovery actions and lightweight product help live away from preferences. */
export function HelpSection() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const resetOnboarding = useMutation({
		mutationKey: ["users", "me", "onboarding", "reset"],
		...usersControllerResetOnboardingMutation(),
		onSuccess: async () => {
			await queryClient.cancelQueries({ queryKey: authControllerMeQueryKey() });
			queryClient.setQueryData<UserDto>(authControllerMeQueryKey(), (old) =>
				old
					? { ...old, onboardingCompletedAt: null, needsOnboarding: true }
					: old,
			);
			await navigate({ to: "/onboarding" });
		},
		onError: () => toast.error("Could not reset onboarding. Please try again."),
	});
	return (
		<section className="p-5 sm:p-7">
			<h2 className="mb-1 font-semibold text-lg">Welcome tour</h2>
			<p className="mb-6 text-(--foreground-muted) text-sm">
				Revisit the guided introduction to Discover, Connections, Activity, Up
				Next and your Shelf.
			</p>
			<button
				type="button"
				className="btn btn-secondary"
				onClick={() => window.dispatchEvent(new Event(TOUR_REPLAY_EVENT))}
			>
				Take the tour again
			</button>
			<div className="mt-8 border-(--border) border-t pt-6">
				<h2 className="mb-1 font-semibold text-lg">Onboarding</h2>
				<p className="mb-6 text-(--foreground-muted) text-sm">
					Start account setup again. Your existing profile, preferences and
					Shelf will be kept. Changes you make during setup will be saved.
				</p>
				<button
					type="button"
					className="btn btn-secondary"
					disabled={resetOnboarding.isPending}
					onClick={() => resetOnboarding.mutate({})}
				>
					{resetOnboarding.isPending
						? "Resetting onboarding…"
						: "Reset onboarding"}
				</button>
			</div>
		</section>
	);
}
