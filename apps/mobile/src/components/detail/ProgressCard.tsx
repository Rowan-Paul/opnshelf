import { View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * "Your Progress" card for the season detail screen: episodes-watched count, a
 * progress bar, and a percent/remaining line. Mirrors the web `ProgressCard`
 * but display-only — the mark/unmark action lives in `MediaTrackingActions`.
 * Renders nothing until there's at least one episode.
 */
export function ProgressCard({
	progress,
}: {
	progress?: {
		episodesWatched: number;
		episodesTotal: number;
		percentage: number;
		remainingEpisodes: number;
		state: "unwatched" | "partial" | "complete" | "unavailable";
	};
}) {
	if (
		!progress ||
		progress.state === "unavailable" ||
		progress.episodesTotal <= 0
	)
		return null;

	return (
		<View className="px-4">
			<View className="gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
				<View className="flex-row items-center justify-between">
					<Text className="font-display font-semibold text-foreground">
						Your Progress
					</Text>
					<Text className="text-muted-foreground text-sm tabular-nums">
						{progress.episodesWatched}/{progress.episodesTotal} watched
					</Text>
				</View>
				<View
					accessible
					accessibilityLabel="Episodes watched"
					accessibilityRole="progressbar"
					accessibilityValue={{
						min: 0,
						max: progress.episodesTotal,
						now: progress.episodesWatched,
					}}
					className="h-1 overflow-hidden rounded-full bg-background-subtle"
				>
					<View
						className="h-full rounded-full bg-primary"
						style={{ width: `${progress.percentage}%` }}
					/>
				</View>
				<View className="flex-row items-center justify-between">
					<Text className="text-muted-foreground text-xs">
						{progress.percentage}% complete
					</Text>
					<Text className="text-muted-foreground text-xs">
						{progress.remainingEpisodes} remaining
					</Text>
				</View>
			</View>
		</View>
	);
}
