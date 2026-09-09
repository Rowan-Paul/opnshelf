import { Link } from "expo-router";
import { Check, ChevronRight, Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { posterUrl } from "@/lib/tmdb";
import { useWatchActions } from "@/lib/use-watch-actions";

export type SeasonCardData = {
	showId: number;
	/** The show's URL slug, so this row links to the same URL the web serves. */
	showSlug: string;
	seasonNumber: number;
	name: string;
	posterPath?: string | null;
	episodeCount?: number;
	year?: string;
	progress?: {
		episodesWatched: number;
		episodesTotal: number;
		state: "unwatched" | "partial" | "complete" | "unavailable";
	};
};

/**
 * Season list row used on the show detail screen. Links to the season detail
 * route. Shows a poster thumbnail, name, year, and episode count.
 *
 * Pass `actions` to surface an inline add/remove-to-shelf toggle (marks or
 * removes the whole season). It's off by default so read-only usages stay free
 * of the watch data hooks.
 */
export function SeasonCard({
	season,
	actions = false,
}: {
	season: SeasonCardData;
	actions?: boolean;
}) {
	if (actions) return <SeasonCardWithActions season={season} />;
	return <SeasonCardBase season={season} />;
}

function SeasonCardBase({
	season,
	toggle,
}: {
	season: SeasonCardData;
	toggle?: ReactNode;
}) {
	const meta = [
		season.year,
		season.progress
			? `${season.progress.episodesWatched} of ${season.progress.episodesTotal} episodes watched`
			: season.episodeCount
				? `${season.episodeCount} episodes`
				: undefined,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<Link
			href={`/shows/${season.showId}/${season.showSlug}/seasons/${season.seasonNumber}`}
			asChild
		>
			<Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-2">
				<View className="aspect-2/3 w-14 overflow-hidden rounded-md bg-background-subtle">
					<PosterImage
						url={posterUrl(season.posterPath, "w185")}
						className="aspect-2/3 w-14"
					/>
				</View>
				<View className="flex-1">
					<Text
						className="font-medium text-foreground text-sm"
						numberOfLines={1}
					>
						{season.name}
					</Text>
					{meta ? (
						<Text className="mt-0.5 text-muted-foreground text-xs">{meta}</Text>
					) : null}
				</View>
				{toggle}
				<ChevronRight color="#94a3b8" size={20} />
			</Pressable>
		</Link>
	);
}

/** Season row with an inline add/remove-to-shelf toggle for the whole season. */
function SeasonCardWithActions({ season }: { season: SeasonCardData }) {
	const { isAuthenticated } = useAuth();
	const showId = String(season.showId);
	const episodeCount =
		season.progress?.episodesTotal ?? season.episodeCount ?? 0;

	const actions = useWatchActions({ mediaType: "show", showId });

	const onShelf = season.progress?.state === "complete";
	const isPartial = season.progress?.state === "partial";
	const pending = actions.isMarkSeasonPending || actions.isUnmarkSeasonPending;

	const toggleShelf = () => {
		if (onShelf) actions.unmarkSeasonWatched(season.seasonNumber);
		else
			actions.markSeasonWatched(season.seasonNumber, undefined, episodeCount);
	};

	const toggle =
		isAuthenticated && episodeCount > 0 ? (
			<Pressable
				hitSlop={8}
				onPress={(e) => {
					e.stopPropagation();
					toggleShelf();
				}}
				disabled={pending}
				className={
					onShelf
						? "size-8 items-center justify-center rounded-full bg-primary"
						: "size-8 items-center justify-center rounded-full border border-border bg-background-subtle"
				}
				style={{ opacity: pending ? 0.6 : 1 }}
			>
				{onShelf ? (
					<Check color="#3f2e00" size={16} strokeWidth={3} />
				) : isPartial ? (
					<Text className="font-bold text-primary-foreground text-xs">
						{season.progress?.episodesWatched}/{season.progress?.episodesTotal}
					</Text>
				) : (
					<Plus color="#94a3b8" size={16} strokeWidth={2.5} />
				)}
			</Pressable>
		) : undefined;

	return <SeasonCardBase season={season} toggle={toggle} />;
}
