import type { FollowedActivityItemDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { type Href, Link } from "expo-router";
import { Clock, User } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { StarRating } from "@/components/detail/StarRating";
import { Text } from "@/components/ui/text";
import { useTwStyle } from "@/lib/use-tw-style";

/** Absolute date + time, mirroring web ("Jun 18, 3:42 PM"). */
export function formatActivityDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

/** Route to the media detail for an activity item. */
export function activityMediaHref(activity: FollowedActivityItemDto): Href {
	if (activity.type === "movie" || activity.type === "review") {
		return `/movie/${activity.movieId}` as Href;
	}
	if (
		activity.showId &&
		activity.seasonNumber !== undefined &&
		activity.episodeNumber !== undefined
	) {
		return `/show/${activity.showId}/season/${activity.seasonNumber}/episode/${activity.episodeNumber}` as Href;
	}
	return `/show/${activity.showId}` as Href;
}

/**
 * A single activity entry shared by the home dashboard preview and the dedicated
 * Activity tab: actor avatar (taps to profile), an action sentence with the
 * media title (taps to the media detail), an optional episode line and review
 * rating, and a relative timestamp. The container styling is supplied by the
 * caller so the same row reads either as a divider-separated list (dashboard) or
 * a standalone card (Activity tab).
 */
export function ActivityRow({
	activity,
	containerClassName = "flex-row items-start gap-3 p-4",
}: {
	activity: FollowedActivityItemDto;
	containerClassName?: string;
}) {
	const avatarStyle = useTwStyle("size-10");
	const displayName =
		typeof activity.actor.displayName === "string"
			? activity.actor.displayName
			: undefined;
	const avatar =
		typeof activity.actor.avatar === "string"
			? activity.actor.avatar
			: undefined;
	const name = displayName || activity.actor.handle;

	const verb =
		activity.type === "movie"
			? "watched"
			: activity.type === "review"
				? "reviewed"
				: "watched episode";
	const mediaTitle =
		activity.type === "episode" ? activity.showTitle : activity.title;
	const isMovieish = activity.type === "movie" || activity.type === "review";

	const episodeLabel =
		activity.type === "episode"
			? [
					activity.seasonNumber && activity.episodeNumber
						? `S${activity.seasonNumber}E${activity.episodeNumber}`
						: undefined,
					activity.episodeName,
				]
					.filter(Boolean)
					.join(" - ")
			: undefined;

	return (
		<View className={containerClassName}>
			<Link href={`/profile/${activity.actor.handle}` as const} asChild>
				<Pressable className="size-10 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
					{avatar ? (
						<Image
							source={{ uri: avatar }}
							style={avatarStyle}
							contentFit="cover"
						/>
					) : (
						<User color="#94a3b8" size={18} />
					)}
				</Pressable>
			</Link>

			<View className="min-w-0 flex-1">
				<Text className="text-foreground text-sm">
					<Link href={`/profile/${activity.actor.handle}` as const}>
						<Text className="font-semibold text-foreground text-sm">
							{name}
						</Text>
					</Link>
					<Text className="text-muted-foreground text-sm"> {verb} </Text>
					<Link href={activityMediaHref(activity)}>
						<Text className="font-medium text-foreground text-sm">
							{mediaTitle}
						</Text>
					</Link>
				</Text>

				{episodeLabel ? (
					<Link href={activityMediaHref(activity)} asChild>
						<Pressable>
							<Text
								className="mt-0.5 font-semibold text-foreground text-sm"
								numberOfLines={1}
							>
								{episodeLabel}
							</Text>
						</Pressable>
					</Link>
				) : null}

				{activity.type === "review" && activity.rating ? (
					<View className="mt-1">
						<StarRating rating={activity.rating} size={14} />
					</View>
				) : null}

				<View className="mt-1 flex-row items-center gap-1.5">
					<Clock color="#94a3b8" size={12} />
					<Text className="text-muted-foreground text-xs">
						{formatActivityDate(activity.activityAt)}
					</Text>
				</View>
			</View>

			<View className="shrink-0 rounded-full bg-background-subtle px-2 py-0.5">
				<Text className="font-medium text-muted-foreground text-xs">
					{isMovieish ? "Movie" : "TV"}
				</Text>
			</View>
		</View>
	);
}
