import type { UpNextShowDto } from "@opnshelf/api";
import { Link } from "expo-router";
import { Calendar, Plus } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { showHref } from "@/lib/media-href";
import { posterUrl } from "@/lib/tmdb";
import { useMarkUpNextEpisode } from "@/lib/use-up-next";

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
 * progress and a one-tap "mark watched" action that advances the queue. Shared
 * by the dashboard preview, the self-profile preview, and the full Up Next
 * screen. `isOwner` (default true) gates the action so other users' queues are
 * read-only.
 *
 * The card owns its mark-watched mutation, so marking several episodes at once
 * only spins the cards being marked.
 */
export function UpNextCard({
	item,
	isOwner = true,
}: {
	item: UpNextShowDto;
	isOwner?: boolean;
}) {
	const markEpisode = useMarkUpNextEpisode();
	const { show, nextEpisode: ep } = item;
	const progress =
		item.totalEpisodes > 0
			? Math.round((item.episodesWatched / item.totalEpisodes) * 100)
			: 0;
	const airDate = formatAirDate(ep.airDate);

	return (
		<Link
			href={showHref(
				show.showId,
				show.title,
				ep.seasonNumber,
				ep.episodeNumber,
			)}
			asChild
		>
			<Pressable className="flex-row gap-3 rounded-xl border border-border bg-card p-3">
				{/* Fixed width + self-stretch wrapper with an absolutely-filled
				    image: the poster covers the card's full height without ever
				    driving row layout (h-full/aspect on the image itself makes RN
				    inflate the row to the image's natural size). */}
				<View className="min-h-32 w-24 self-stretch overflow-hidden rounded-lg border border-border bg-background-subtle">
					<PosterImage
						url={posterUrl(show.posterPath)}
						className="absolute inset-0"
					/>
				</View>

				<View className="min-w-0 flex-1 justify-between">
					<View className="gap-0.5">
						<View className="flex-row items-start justify-between gap-2">
							<Text
								className="flex-1 font-semibold text-foreground text-sm"
								numberOfLines={2}
							>
								{show.title}
							</Text>
							<View className="rounded-full bg-background-subtle px-2 py-0.5">
								<Text className="font-medium text-muted-foreground text-xs">
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
						{isOwner ? (
							<Pressable
								onPress={(e) => {
									e.stopPropagation();
									markEpisode.mutate({
										body: {
											showId: item.showId,
											seasonNumber: ep.seasonNumber,
											episodeNumber: ep.episodeNumber,
										},
									});
								}}
								disabled={markEpisode.isPending}
								accessibilityState={{ busy: markEpisode.isPending }}
								className="flex-row items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5"
								style={{ opacity: markEpisode.isPending ? 0.6 : 1 }}
							>
								{markEpisode.isPending ? (
									<ActivityIndicator size="small" color="#3f2e00" />
								) : (
									<Plus color="#3f2e00" size={16} strokeWidth={3} />
								)}
								<Text className="font-semibold text-primary-foreground text-sm">
									Add to shelf
								</Text>
							</Pressable>
						) : null}
					</View>
				</View>
			</Pressable>
		</Link>
	);
}
