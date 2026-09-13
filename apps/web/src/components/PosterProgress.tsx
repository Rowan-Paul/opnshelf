export interface PosterProgressValue {
	episodesWatched: number;
	episodesTotal: number;
	percentage?: number;
}

interface PosterProgressProps {
	progress?: PosterProgressValue;
	label: "Show progress" | "Season progress";
	isLoading?: boolean;
}

export function progressPercentage(progress: PosterProgressValue) {
	const percentage =
		progress.percentage ??
		(progress.episodesTotal > 0
			? (progress.episodesWatched / progress.episodesTotal) * 100
			: 0);
	return Math.round(Math.max(0, Math.min(100, percentage)));
}

export function PosterProgress({
	progress,
	label,
	isLoading = false,
}: PosterProgressProps) {
	if (isLoading) {
		return (
			<div
				className="absolute inset-x-0 bottom-0 h-1 animate-pulse bg-white/35"
				aria-hidden="true"
			/>
		);
	}

	if (!progress || progress.episodesTotal <= 0) return null;

	const percentage = progressPercentage(progress);
	const watched = Math.min(
		Math.max(0, progress.episodesWatched),
		progress.episodesTotal,
	);

	return (
		<div
			className="absolute inset-x-0 bottom-0 h-1 bg-black/55"
			role="progressbar"
			aria-label={`${label}: ${watched} of ${progress.episodesTotal} episodes watched`}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percentage}
		>
			<div
				className="h-full bg-(--accent) transition-[width]"
				style={{ width: `${percentage}%` }}
			/>
		</div>
	);
}
