import {
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerGetMyCurrentTraktImportQueryKey,
	usersControllerSnoozeMyTraktReminderMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Film, TimerReset } from "lucide-react";

export function TraktHomePrompt() {
	const queryClient = useQueryClient();
	const { data: job } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
	});
	const snooze = useMutation({
		mutationKey: ["trakt", "import", "reminder", "snooze"],
		...usersControllerSnoozeMyTraktReminderMutation(),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMyCurrentTraktImportQueryKey(),
			}),
	});
	if (!job || !job.acknowledgedAt) return null;
	if (
		job.reminderSnoozedUntil &&
		new Date(job.reminderSnoozedUntil).getTime() > Date.now()
	) {
		return null;
	}
	const needsResume = job.status === "paused" || job.status === "failed";
	const groups = job.unmatchedGroups.length;
	if (!needsResume && groups === 0) return null;
	const watchCount = job.unmatchedGroups.reduce(
		(total, group) => total + group.watchCount,
		0,
	);

	return (
		<section className="relative overflow-hidden rounded-2xl border border-(--border) bg-(--background-elevated) p-5 sm:p-6">
			<div className="absolute inset-y-0 left-0 w-1 bg-(--accent)" />
			<div className="flex flex-col gap-5 sm:flex-row sm:items-center">
				<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--accent-subtle) text-(--accent)">
					{needsResume ? (
						<TimerReset className="size-5" />
					) : (
						<Film className="size-5" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="font-display font-semibold text-xl">
						{needsResume
							? "Your Trakt import is waiting"
							: `${groups} ${groups === 1 ? "title needs" : "titles need"} your help`}
					</h2>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						{needsResume
							? "Resume from the saved position to finish examining your history."
							: `Match ${groups === 1 ? "it" : "them"} to TMDB to add ${watchCount} ${watchCount === 1 ? "Watch" : "Watches"} to your Shelf.`}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						onClick={() => snooze.mutate({})}
						disabled={snooze.isPending}
						className="btn btn-ghost"
					>
						Remind me later
					</button>
					<Link to="/trakt-import" className="btn btn-primary">
						{needsResume ? "Resume import" : "Match titles"}
						<ArrowRight className="size-4" />
					</Link>
				</div>
			</div>
		</section>
	);
}
