import { Check, Loader2, X } from "lucide-react";

interface ProgressCardProps {
	episodesWatched: number;
	totalEpisodes: number;
	markLabel?: string;
	unmarkLabel?: string;
	isMarkPending?: boolean;
	isUnmarkPending?: boolean;
	processing?: boolean;
	onMarkWatched?: () => void;
	onUnmarkWatched?: () => void;
	/** Hide the mark/unmark button — for contexts (e.g. the episode detail
	 * page) that show season progress read-only, without a season-level
	 * watch action wired up. */
	hideActions?: boolean;
}

export default function ProgressCard({
	episodesWatched,
	totalEpisodes,
	markLabel = "Add to shelf",
	unmarkLabel = "Remove from shelf",
	isMarkPending = false,
	isUnmarkPending = false,
	processing = false,
	onMarkWatched,
	onUnmarkWatched,
	hideActions = false,
}: ProgressCardProps) {
	const rawProgressPercentage =
		totalEpisodes > 0 ? (episodesWatched / totalEpisodes) * 100 : 0;
	const progressPercentage = Math.max(0, Math.min(100, rawProgressPercentage));
	const episodesRemaining = Math.max(0, totalEpisodes - episodesWatched);
	const isFullyWatched = progressPercentage >= 100;

	return (
		<section className="card p-4">
			<div className="space-y-2.5">
				<div className="flex items-center justify-between">
					<h3 className="font-display font-semibold">Your Progress</h3>
					<span className="text-(--foreground-muted) text-sm tabular-nums">
						{episodesWatched}/{totalEpisodes} watched
					</span>
				</div>
				<div
					className="h-1 w-full overflow-hidden rounded-full bg-(--background-subtle)"
					role="progressbar"
					aria-label="Episodes watched"
					aria-valuemin={0}
					aria-valuemax={totalEpisodes}
					aria-valuenow={Math.min(episodesWatched, totalEpisodes)}
				>
					<div
						className="h-full rounded-full bg-(--accent)"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>
				<div className="flex items-center justify-between text-xs">
					<span className="text-(--foreground-muted)">
						{Math.round(progressPercentage)}% complete
					</span>
					<span className="text-(--foreground-muted)">
						{episodesRemaining} remaining
					</span>
				</div>

				{hideActions ? null : isFullyWatched ? (
					<button
						type="button"
						onClick={onUnmarkWatched}
						disabled={isUnmarkPending || processing}
						className="btn btn-secondary mt-2 w-full gap-2"
					>
						{isUnmarkPending || processing ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Loading
							</>
						) : (
							<>
								<X className="size-4" />
								{unmarkLabel}
							</>
						)}
					</button>
				) : (
					<button
						type="button"
						onClick={onMarkWatched}
						disabled={isMarkPending || processing}
						className="btn btn-secondary mt-2 w-full gap-2"
					>
						{isMarkPending || processing ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Loading
							</>
						) : (
							<>
								<Check className="size-4" />
								{markLabel}
							</>
						)}
					</button>
				)}
			</div>
		</section>
	);
}
