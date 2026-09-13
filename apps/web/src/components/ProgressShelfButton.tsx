import { Check, Loader2, X } from "lucide-react";

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
}) {
	if (episodesTotal <= 0) return null;

	const isComplete = episodesWatched >= episodesTotal;
	const isPending = isMarkPending || isUnmarkPending || processing;

	return (
		<button
			type="button"
			onClick={isComplete ? onUnmarkWatched : onMarkWatched}
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
}
