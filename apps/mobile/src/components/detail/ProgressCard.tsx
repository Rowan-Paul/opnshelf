import { View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * "Your Progress" card for the season detail screen: episodes-watched count, a
 * progress bar, and a percent/remaining line. Mirrors the web `ProgressCard`
 * but display-only — the mark/unmark action lives in `MediaTrackingActions`.
 * Renders nothing until there's at least one episode.
 */
export function ProgressCard({
	episodesWatched,
	totalEpisodes,
}: {
	episodesWatched: number;
	totalEpisodes: number;
}) {
	if (totalEpisodes <= 0) return null;

	const pct = Math.max(
		0,
		Math.min(100, (episodesWatched / totalEpisodes) * 100),
	);
	const remaining = Math.max(0, totalEpisodes - episodesWatched);

	return (
		<View className="px-4">
			<View className="gap-3 rounded-xl border border-border bg-card p-4">
				<View className="flex-row items-center justify-between">
					<Text className="font-display font-semibold text-base text-foreground">
						Your Progress
					</Text>
					<Text className="font-semibold text-foreground text-sm">
						{episodesWatched}/{totalEpisodes}
					</Text>
				</View>
				<View className="h-2 overflow-hidden rounded-full bg-background-subtle">
					<View
						className="h-full rounded-full bg-primary"
						style={{ width: `${pct}%` }}
					/>
				</View>
				<View className="flex-row items-center justify-between">
					<Text className="text-muted-foreground text-xs">
						{Math.round(pct)}% complete
					</Text>
					<Text className="text-muted-foreground text-xs">
						{remaining} remaining
					</Text>
				</View>
			</View>
		</View>
	);
}
