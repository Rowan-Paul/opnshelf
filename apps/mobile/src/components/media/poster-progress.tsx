import { View } from "react-native";

export type PosterProgressValue = {
	episodesWatched: number;
	episodesTotal: number;
	percentage?: number;
};

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
}: {
	progress?: PosterProgressValue;
	label: "Show progress" | "Season progress";
	isLoading?: boolean;
}) {
	if (isLoading) {
		return (
			<View
				className="absolute right-0 bottom-0 left-0 h-1 animate-pulse bg-white/35"
				accessible={false}
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
		<View
			className="absolute right-0 bottom-0 left-0 h-1 bg-black/55"
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={`${label}: ${watched} of ${progress.episodesTotal} aired episodes watched`}
			accessibilityValue={{ min: 0, max: 100, now: percentage }}
		>
			<View className="h-full bg-primary" style={{ width: `${percentage}%` }} />
		</View>
	);
}
