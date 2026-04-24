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
}: ProgressCardProps) {
	const rawProgressPercentage =
		totalEpisodes > 0 ? (episodesWatched / totalEpisodes) * 100 : 0;
	const progressPercentage = Math.max(0, Math.min(100, rawProgressPercentage));
	const episodesRemaining = Math.max(0, totalEpisodes - episodesWatched);
	const isFullyWatched = progressPercentage >= 100;

	return (
		<section className="card p-5">
			<h3 className="font-display font-semibold mb-4">Your Progress</h3>
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<span className="text-sm text-[var(--foreground-muted)]">
						Episodes Watched
					</span>
					<span className="font-semibold">
						{episodesWatched}/{totalEpisodes}
					</span>
				</div>
				<div className="h-2 w-full rounded-full bg-[var(--background-subtle)]">
					<div
						className="h-full rounded-full bg-[var(--accent)]"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>
				<div className="flex items-center justify-between text-sm">
					<span className="text-[var(--foreground-muted)]">
						{Math.round(progressPercentage)}% complete
					</span>
					<span className="text-[var(--foreground-muted)]">
						{episodesRemaining} remaining
					</span>
				</div>

				{isFullyWatched ? (
					<button
						type="button"
						onClick={onUnmarkWatched}
						disabled={isUnmarkPending || processing}
						className="mt-4 w-full btn btn-secondary gap-2"
					>
						{isUnmarkPending || processing ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading
							</>
						) : (
							<>
								<X className="h-4 w-4" />
								{unmarkLabel}
							</>
						)}
					</button>
				) : (
					<button
						type="button"
						onClick={onMarkWatched}
						disabled={isMarkPending || processing}
						className="mt-4 w-full btn btn-secondary gap-2"
					>
						{isMarkPending || processing ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading
							</>
						) : (
							<>
								<Check className="h-4 w-4" />
								{markLabel}
							</>
						)}
					</button>
				)}
			</div>
		</section>
	);
}
