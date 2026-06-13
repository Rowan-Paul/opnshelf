import type { UpNextShowDto } from "@opnshelf/api";
import { Link } from "expo-router";
import { Calendar, Check } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { posterUrl } from "@/lib/tmdb";

function formatAirDate(iso?: string): string | undefined {
	if (!iso) return undefined;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return undefined;
	return d.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/**
 * A single Up Next entry: a tracked show's next unwatched episode, with watch
 * progress and a one-tap "mark watched" action that advances the queue.
 */
export function UpNextCard({
	item,
	onMarkWatched,
	isMarking,
}: {
	item: UpNextShowDto;
	onMarkWatched: (
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	) => void;
	isMarking?: boolean;
}) {
	const { show, nextEpisode: ep } = item;
	const progress =
		item.totalEpisodes > 0
			? Math.round((item.episodesWatched / item.totalEpisodes) * 100)
			: 0;
	const airDate = formatAirDate(ep.airDate);

	return (
		<View className="flex-row gap-3 rounded-xl border border-border bg-card p-3">
			<Link href={`/show/${show.showId}` as const} asChild>
				<Pressable className="overflow-hidden rounded-lg border border-border bg-background-subtle">
					<PosterImage url={posterUrl(show.posterPath)} className="h-32 w-22" />
				</Pressable>
			</Link>

			<View className="min-w-0 flex-1 justify-between">
				<View className="gap-0.5">
					<View className="flex-row items-start justify-between gap-2">
						<Text
							className="flex-1 font-semibold text-foreground text-sm"
							numberOfLines={1}
						>
							{show.title}
						</Text>
						<View className="rounded-full bg-primary px-2 py-0.5">
							<Text className="font-medium text-primary-foreground text-xs">
								S{ep.seasonNumber}E{ep.episodeNumber}
							</Text>
						</View>
					</View>
					<Text className="text-muted-foreground text-sm" numberOfLines={1}>
						{ep.name || `Episode ${ep.episodeNumber}`}
					</Text>
					{airDate ? (
						<View className="mt-0.5 flex-row items-center gap-1.5">
							<Calendar color="#94a3b8" size={13} />
							<Text className="text-muted-foreground text-xs">{airDate}</Text>
						</View>
					) : null}
				</View>

				<View className="mt-2 gap-2">
					<View className="flex-row items-center gap-2">
						<View className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-subtle">
							<View
								className="h-full rounded-full bg-primary"
								style={{ width: `${progress}%` }}
							/>
						</View>
						<Text className="text-muted-foreground text-xs">
							{item.episodesWatched}/{item.totalEpisodes}
						</Text>
					</View>
					<Pressable
						onPress={() =>
							onMarkWatched(item.showId, ep.seasonNumber, ep.episodeNumber)
						}
						disabled={isMarking}
						className="flex-row items-center justify-center gap-1.5 rounded-lg bg-primary py-2"
						style={{ opacity: isMarking ? 0.6 : 1 }}
					>
						<Check color="#3f2e00" size={20} strokeWidth={3} />
						<Text className="font-semibold text-primary-foreground text-sm">
							Mark watched
						</Text>
					</Pressable>
				</View>
			</View>
		</View>
	);
}
