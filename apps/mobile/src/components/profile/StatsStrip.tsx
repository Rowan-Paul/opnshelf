import type { MostWatchedShowDto, ProfileActivityDayDto } from "@opnshelf/api";
import { Link } from "expo-router";
import { Clock } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { posterUrl } from "@/lib/tmdb";

/**
 * Profile stats strip: a 30-day watch-activity bar graph plus a few headline
 * stats (most-watched show, items watched this year, review count). Mirrors the
 * web `StatsStrip`, fed from the same `PublicUserProfileDto`, so the numbers
 * stay identical across surfaces. Purely presentational.
 */
export function StatsStrip({
	activity,
	mostWatchedShow,
	watchedThisYear,
	reviewsCount,
	isLoading,
}: {
	activity?: ProfileActivityDayDto[];
	mostWatchedShow: MostWatchedShowDto | null;
	watchedThisYear: number;
	reviewsCount: number;
	isLoading: boolean;
}) {
	if (isLoading) {
		return <View className="h-32 rounded-xl border border-border bg-card" />;
	}

	const days = activity ?? [];
	const last30Total = days.reduce((sum, d) => sum + d.count, 0);

	return (
		<View className="gap-5 rounded-xl border border-border bg-card p-4">
			{/* Activity graph */}
			<View>
				<View className="mb-3 flex-row items-baseline justify-between">
					<View className="flex-row items-center gap-1.5">
						<Clock color="#f3bc00" size={15} />
						<Text className="font-medium text-muted-foreground text-sm">
							Last 30 days
						</Text>
					</View>
					<Text className="text-muted-foreground text-xs">
						{last30Total} watched
					</Text>
				</View>
				<ActivityGraph data={days} />
			</View>

			{/* Headline stats */}
			<View className="flex-row items-center gap-6 border-border border-t pt-4">
				{mostWatchedShow ? (
					<MostWatchedShowStat show={mostWatchedShow} />
				) : null}
				<NumberStat label="This year" value={watchedThisYear} />
				<NumberStat label="Reviews" value={reviewsCount} />
			</View>
		</View>
	);
}

function ActivityGraph({ data }: { data: ProfileActivityDayDto[] }) {
	const max = Math.max(1, ...data.map((d) => d.count));

	return (
		<View className="h-20 flex-row items-end gap-[3px]">
			{data.map((d) => {
				const pct = (d.count / max) * 100;
				const heightPct = d.count > 0 ? Math.max(12, pct) : 4;
				return (
					<View key={d.date} className="h-full flex-1 justify-end">
						<View
							className={
								d.count > 0
									? "rounded-sm bg-primary"
									: "rounded-sm bg-background-subtle"
							}
							style={{ height: `${heightPct}%` }}
						/>
					</View>
				);
			})}
		</View>
	);
}

function NumberStat({ label, value }: { label: string; value: number }) {
	return (
		<View>
			<Text className="font-bold font-display text-2xl text-foreground">
				{value}
			</Text>
			<Text className="text-muted-foreground text-xs">{label}</Text>
		</View>
	);
}

function MostWatchedShowStat({ show }: { show: MostWatchedShowDto }) {
	return (
		<Link href={`/show/${show.showId}` as const} asChild>
			<Pressable className="flex-row items-center gap-2">
				<View className="h-14 w-10 overflow-hidden rounded">
					<PosterImage
						url={posterUrl(show.posterPath, "w185")}
						className="h-14 w-10"
					/>
				</View>
				<View className="max-w-[120px]">
					<Text className="text-muted-foreground text-xs">Most watched</Text>
					<Text
						className="font-semibold text-foreground text-sm"
						numberOfLines={1}
					>
						{show.title}
					</Text>
					<Text className="text-muted-foreground text-xs">
						{show.episodeWatchCount} eps
					</Text>
				</View>
			</Pressable>
		</Link>
	);
}
