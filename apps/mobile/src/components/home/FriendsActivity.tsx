import type { FollowedActivityItemDto } from "@opnshelf/api";
import { socialControllerGetFeedOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { type Href, Link } from "expo-router";
import { Clock, MessageCircle, User, Users } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { StarRating } from "@/components/detail/StarRating";
import { SectionHeader } from "@/components/home/SectionHeader";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useTwStyle } from "@/lib/use-tw-style";

const MAX_AGE_DAYS = 30;
const PREVIEW_COUNT = 5;

/**
 * Friends Activity feed for the home dashboard (issue #144). Mirrors the web
 * dashboard `FriendsActivitySection`: friends' recent watches and reviews,
 * filtered to the last 30 days, each tappable to the media detail and to the
 * actor's profile. Reads from the same shared `socialControllerGetFeed`
 * procedure the web dashboard uses so the two surfaces stay in sync.
 *
 * Rendered inside the dashboard ScrollView, so it shows a fixed preview slice
 * rather than owning its own scrolling list; "View all" links to the Friends
 * screen.
 */
export function FriendsActivity() {
	const { data, isLoading } = useQuery({
		...socialControllerGetFeedOptions({ query: { pageSize: PREVIEW_COUNT } }),
	});

	const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
	const recentItems = (data?.items ?? [])
		.filter((item) => new Date(item.activityAt).getTime() >= cutoff)
		.slice(0, PREVIEW_COUNT);

	return (
		<View>
			<SectionHeader icon={Users} title="Friend Activity" href="/friends" />
			{isLoading ? (
				<LoadingState label="Loading activity…" />
			) : recentItems.length === 0 ? (
				<EmptyState
					icon={MessageCircle}
					title="No recent activity"
					message="Activity from people you follow will appear here."
				/>
			) : (
				<View className="overflow-hidden rounded-xl border border-border bg-card">
					{recentItems.map((item, index) => (
						<ActivityRow
							key={item.id}
							activity={item}
							isLast={index === recentItems.length - 1}
						/>
					))}
				</View>
			)}
		</View>
	);
}

/** Format an ISO timestamp as a short relative string ("2h ago", "3d ago"). */
function relativeTime(iso: string): string {
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
function mediaHref(activity: FollowedActivityItemDto): Href {
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
 * A single activity entry: actor avatar (taps to profile), an action sentence
 * with the media title (taps to the media detail), an optional episode line and
 * review rating, and a relative timestamp.
 */
function ActivityRow({
	activity,
	isLast,
}: {
	activity: FollowedActivityItemDto;
	isLast: boolean;
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
		<View
			className={`flex-row items-start gap-3 p-4 ${isLast ? "" : "border-border border-b"}`}
		>
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
					<Link href={mediaHref(activity)}>
						<Text className="font-medium text-foreground text-sm">
							{mediaTitle}
						</Text>
					</Link>
				</Text>

				{episodeLabel ? (
					<Link href={mediaHref(activity)} asChild>
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
