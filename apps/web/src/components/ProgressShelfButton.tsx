import { Check, Loader2, X } from "lucide-react";
import { WatchDatePicker } from "#/components/WatchDatePicker";

export function ProgressShelfButton({
	episodesWatched,
	episodesTotal,
	isMarkPending = false,
	isUnmarkPending = false,
	processing = false,
	markLabel = "Add to shelf",
	unmarkLabel = "Remove from shelf",
	onMarkWatched,
	onUnmarkWatched,
	onMarkWatchedAt,
}: {
	episodesWatched: number;
	episodesTotal: number;
	isMarkPending?: boolean;
	isUnmarkPending?: boolean;
	processing?: boolean;
	markLabel?: string;
	unmarkLabel?: string;
	onMarkWatched: () => void;
	onUnmarkWatched: () => void;
	/**
	 * Opt in to the watch date picker. When supplied, the mark button opens the
	 * same popover the movie and episode pages use instead of marking straight
	 * away, and takes precedence over `onMarkWatched`. `null` creates undated
	 * Watches — one per aired episode, since a show or season is tracked
	 * through its episodes. Omit to keep the plain mark-on-click button.
	 */
	onMarkWatchedAt?: (watchedAt: string | null) => void;
}) {
	if (episodesTotal <= 0) return null;

	const isComplete = episodesWatched >= episodesTotal;
	const isPending = isMarkPending || isUnmarkPending || processing;

	// The picker owns the click when it is in play, so the button must not also
	// mark on its own: Radix drives it through `asChild`.
	const opensPicker = !!onMarkWatchedAt && !isComplete;

	const action = (
		<button
			type="button"
			onClick={
				opensPicker ? undefined : isComplete ? onUnmarkWatched : onMarkWatched
			}
			disabled={isPending}
			className="btn btn-secondary gap-2"
		>
			{isPending ? (
				<>
					<Loader2 className="size-4 animate-spin" />
					Loading
				</>
			) : isComplete ? (
				<>
					<X className="size-4" />
					{unmarkLabel}
				</>
			) : (
				<>
					<Check className="size-4" />
					{markLabel}
				</>
			)}
		</button>
	);

	// A date is meaningless next to "Remove from shelf", so once every episode
	// is watched the button goes back to marking (well, unmarking) on click.
	if (!opensPicker || !onMarkWatchedAt) return action;

	return (
		<WatchDatePicker
			isPending={isPending}
			onConfirm={onMarkWatchedAt}
			align="start"
			trigger={action}
		/>
	);
}
