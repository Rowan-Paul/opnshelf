import { Link } from "expo-router";
import { Check, Plus, Star } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { stillUrl } from "@/lib/tmdb";
import { useWatchActions } from "@/lib/use-watch-actions";
import { useWatchStatus } from "@/lib/use-watch-status";

export type EpisodeCardData = {
	showId: number;
	seasonNumber: number;
	episodeNumber: number;
	name: string;
	overview?: string;
	stillPath?: string | null;
	airDate?: string;
	rating?: number;
};

/**
 * Episode list row: still thumbnail, number + title, air date/rating, and a
 * truncated overview. Links to the episode detail route. Reused by the season
 * detail screen and any future "up next" surfaces.
 *
 * Pass `actions` to overlay a corner add/remove-to-shelf toggle on the still.
 * It's off by default so read-only usages stay free of the watch data hooks.
 */
export function EpisodeCard({
	episode,
	actions = false,
}: {
	episode: EpisodeCardData;
	actions?: boolean;
}) {
	if (actions) return <EpisodeCardWithActions episode={episode} />;
	return <EpisodeCardBase episode={episode} />;
}

function EpisodeCardBase({
	episode,
	overlay,
}: {
	episode: EpisodeCardData;
	overlay?: ReactNode;
}) {
	return (
		<Link
			href={`/show/${episode.showId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
			asChild
		>
			<Pressable className="flex-row gap-3 rounded-lg border border-border bg-card p-2">
				<View className="aspect-video w-28 overflow-hidden rounded-md bg-background-subtle">
					<PosterImage
						url={stillUrl(episode.stillPath)}
						className="aspect-video w-28"
					/>
					{overlay}
				</View>
				<View className="flex-1 justify-center">
					<Text
						className="font-medium text-foreground text-sm"
						numberOfLines={2}
					>
						{episode.episodeNumber}. {episode.name}
					</Text>
					<View className="mt-0.5 flex-row items-center gap-2">
						{episode.airDate ? (
							<Text className="text-muted-foreground text-xs">
								{episode.airDate}
							</Text>
						) : null}
						{episode.rating && episode.rating > 0 ? (
							<View className="flex-row items-center gap-0.5">
								<Star color="#f3bc00" fill="#f3bc00" size={11} />
								<Text className="text-muted-foreground text-xs">
									{episode.rating.toFixed(1)}
								</Text>
							</View>
						) : null}
					</View>
					{episode.overview ? (
						<Text
							className="mt-1 text-muted-foreground text-xs leading-4"
							numberOfLines={2}
						>
							{episode.overview}
						</Text>
					) : null}
				</View>
			</Pressable>
		</Link>
	);
}

/** Episode row with a corner add/remove-to-shelf toggle for the episode. */
function EpisodeCardWithActions({ episode }: { episode: EpisodeCardData }) {
	const { isAuthenticated } = useAuth();
	const showId = String(episode.showId);

	const status = useWatchStatus({ mediaType: "show", showId });
	const actions = useWatchActions({ mediaType: "show", showId });

	const onShelf =
		status.isEpisodeWatched?.(episode.seasonNumber, episode.episodeNumber) ??
		false;
	const pending =
		actions.isMarkEpisodePending || actions.isUnmarkEpisodePending;

	const toggleShelf = () => {
		if (onShelf) {
			actions.unmarkEpisodeWatched(
				episode.seasonNumber,
				episode.episodeNumber,
				"all",
			);
		} else {
			actions.markEpisodeWatched(episode.seasonNumber, episode.episodeNumber);
		}
	};

	const overlay = isAuthenticated ? (
		<Pressable
			hitSlop={8}
			onPress={(e) => {
				e.stopPropagation();
				toggleShelf();
			}}
			disabled={pending}
			className={
				onShelf
					? "absolute top-1.5 right-1.5 size-7 items-center justify-center rounded-full bg-primary"
					: "absolute top-1.5 right-1.5 size-7 items-center justify-center rounded-full bg-black/55"
			}
			style={{ opacity: pending ? 0.6 : 1 }}
		>
			{onShelf ? (
				<Check color="#3f2e00" size={15} strokeWidth={3} />
			) : (
				<Plus color="#ffffff" size={15} strokeWidth={2.5} />
			)}
		</Pressable>
	) : undefined;

	return <EpisodeCardBase episode={episode} overlay={overlay} />;
}
