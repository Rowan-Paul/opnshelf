import { Link } from "expo-router";
import { Check, Plus, Star } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { formatRuntime, stillUrl } from "@/lib/tmdb";
import { useConfirmRemoveWatches } from "@/lib/use-confirm-remove-watches";
import { useWatchActions } from "@/lib/use-watch-actions";
import { useWatchStatus } from "@/lib/use-watch-status";

export type EpisodeCardData = {
	showId: number;
	/** The show's URL slug, so this row links to the same URL the web serves. */
	showSlug: string;
	seasonNumber: number;
	episodeNumber: number;
	name: string;
	overview?: string;
	stillPath?: string | null;
	airDate?: string;
	rating?: number;
	runtime?: number;
};

/**
 * Episode list row: still thumbnail, number + title, air date/runtime/rating,
 * and a truncated overview. Links to the episode detail route. Reused by the
 * season detail screen and any future "up next" surfaces.
 *
 * Pass `actions` to add an add/remove-to-shelf button below the row. It's off
 * by default so read-only usages stay free of the watch data hooks. Pass
 * `upNext` to flag the show's next unwatched episode with a badge.
 */
export function EpisodeCard({
	episode,
	actions = false,
	upNext = false,
}: {
	episode: EpisodeCardData;
	actions?: boolean;
	upNext?: boolean;
}) {
	if (actions)
		return <EpisodeCardWithActions episode={episode} upNext={upNext} />;
	return <EpisodeCardBase episode={episode} upNext={upNext} />;
}

function EpisodeCardBase({
	episode,
	action,
	upNext = false,
}: {
	episode: EpisodeCardData;
	action?: ReactNode;
	upNext?: boolean;
}) {
	return (
		<Link
			href={`/shows/${episode.showId}/${episode.showSlug}/seasons/${episode.seasonNumber}/episodes/${episode.episodeNumber}`}
			asChild
		>
			<Pressable className="rounded-lg border border-border bg-card p-2">
				<View className="flex-row gap-3">
					<View className="aspect-video w-28 overflow-hidden rounded-md bg-background-subtle">
						<PosterImage
							url={stillUrl(episode.stillPath)}
							className="aspect-video w-28"
						/>
					</View>
					<View className="flex-1 justify-center">
						{upNext ? (
							<View className="mb-1 self-start rounded-full bg-primary px-2 py-0.5">
								<Text className="font-semibold text-[10px] text-primary-foreground uppercase tracking-wide">
									Up Next
								</Text>
							</View>
						) : null}
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
							{episode.runtime ? (
								<Text className="text-muted-foreground text-xs">
									{formatRuntime(episode.runtime)}
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
				</View>
				{action ? <View className="mt-2">{action}</View> : null}
			</Pressable>
		</Link>
	);
}

/** Episode row with an add/remove-to-shelf button for the episode. */
function EpisodeCardWithActions({
	episode,
	upNext = false,
}: {
	episode: EpisodeCardData;
	upNext?: boolean;
}) {
	const { isAuthenticated } = useAuth();
	const confirmRemoveWatches = useConfirmRemoveWatches();
	const showId = String(episode.showId);

	const status = useWatchStatus({ mediaType: "show", showId });
	const actions = useWatchActions({ mediaType: "show", showId });

	const onShelf =
		status.isEpisodeWatched?.(episode.seasonNumber, episode.episodeNumber) ??
		false;
	const pending =
		actions.isMarkEpisodePending || actions.isUnmarkEpisodePending;

	// Removal always takes every Watch of this episode, so a rewatch confirms
	// first (same guard as the Web episode row).
	const watchEntryCount =
		status.showWatchHistory?.filter(
			(entry) =>
				entry.seasonNumber === episode.seasonNumber &&
				entry.episodeNumber === episode.episodeNumber,
		).length ?? 0;

	const toggleShelf = () => {
		if (onShelf) {
			confirmRemoveWatches({
				title: `${episode.name} S${episode.seasonNumber}E${episode.episodeNumber}`,
				entryCount: watchEntryCount,
				onConfirm: () =>
					actions.unmarkEpisodeWatched(
						episode.seasonNumber,
						episode.episodeNumber,
						"all",
					),
			});
		} else {
			actions.markEpisodeWatched(episode.seasonNumber, episode.episodeNumber);
		}
	};

	const action = isAuthenticated ? (
		<Pressable
			onPress={(e) => {
				e.stopPropagation();
				toggleShelf();
			}}
			disabled={pending}
			className={
				onShelf
					? "flex-row items-center justify-center gap-1.5 rounded-lg bg-primary py-2"
					: "flex-row items-center justify-center gap-1.5 rounded-lg border border-border py-2"
			}
			style={{ opacity: pending ? 0.6 : 1 }}
		>
			{onShelf ? (
				<>
					<Check color="#3f2e00" size={16} strokeWidth={3} />
					<Text className="font-semibold text-primary-foreground text-sm">
						On shelf
					</Text>
				</>
			) : (
				<>
					<Plus color="#94a3b8" size={16} strokeWidth={2.5} />
					<Text className="font-semibold text-foreground text-sm">
						Add to shelf
					</Text>
				</>
			)}
		</Pressable>
	) : undefined;

	return <EpisodeCardBase episode={episode} action={action} upNext={upNext} />;
}
