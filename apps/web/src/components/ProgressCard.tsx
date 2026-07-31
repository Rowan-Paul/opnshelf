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
		<section className="card p-5">
			<h3 className="mb-4 font-display font-semibold">Your Progress</h3>
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<span className="text-(--foreground-muted) text-sm">
						Episodes Watched
					</span>
					<span className="font-semibold">
						{episodesWatched}/{totalEpisodes}
					</span>
				</div>
				<div className="h-2 w-full rounded-full bg-(--background-subtle)">
					<div
						className="h-full rounded-full bg-(--accent)"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>
				<div className="flex items-center justify-between text-sm">
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
						className="btn btn-secondary mt-4 w-full gap-2"
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
						className="btn btn-secondary mt-4 w-full gap-2"
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
