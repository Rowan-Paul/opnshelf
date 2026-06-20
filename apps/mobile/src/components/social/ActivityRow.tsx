import type { FollowedActivityItemDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { type Href, Link } from "expo-router";
import { Clock, User } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { StarRating } from "@/components/detail/StarRating";
import { Text } from "@/components/ui/text";
import { useTwStyle } from "@/lib/use-tw-style";

/** Format an ISO timestamp as a short relative string ("2h ago", "3d ago"). */
export function relativeTime(iso: string): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "";
	const diffMs = Date.now() - then;
	const diffMins = Math.round(diffMs / 60000);
	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	const diffHours = Math.round(diffMins / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.round(diffHours / 24);
	if (diffDays < 7) return `${diffDays}d ago`;
	const diffWeeks = Math.round(diffDays / 7);
	if (diffWeeks < 4) return `${diffWeeks}w ago`;
	const diffMonths = Math.round(diffDays / 30);
	return `${diffMonths}mo ago`;
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
						{relativeTime(activity.activityAt)}
					</Text>
				</View>
			</View>

			<View
				className={`shrink-0 rounded-full px-2 py-0.5 ${isMovieish ? "bg-background-subtle" : "bg-primary"}`}
			>
				<Text
					className={`font-medium text-xs ${isMovieish ? "text-muted-foreground" : "text-primary-foreground"}`}
				>
					{isMovieish ? "Movie" : "TV"}
				</Text>
			</View>
		</View>
	);
}
