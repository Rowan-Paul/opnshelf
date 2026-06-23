import type { FollowedActivityItemDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Clock, User } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { StarRating } from "@/components/detail/StarRating";
import { PosterImage } from "@/components/media/PosterImage";
import {
	activityMediaHref,
	relativeTime,
} from "@/components/social/ActivityRow";
import { MediaActionBar } from "@/components/social/MediaActionBar";
import { Text } from "@/components/ui/text";
import { backdropUrl, posterUrl } from "@/lib/tmdb";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Rich activity card for the Activity tab (the dashboard preview keeps the
 * compact `ActivityRow`). Mirrors the web "following" `ActivityCard`: poster
 * art on the left, actor + action header, episode line, a review rating +
 * excerpt or a synopsis excerpt, timestamp, and inline actions (one-tap
 * add-to-shelf + ⋯ quick actions) for watch items. A subtle left accent uses
 * the media's own colour palette when present, falling back to the border.
 */
export function ActivityCard({
	activity,
}: {
	activity: FollowedActivityItemDto;
}) {
	const avatarStyle = useTwStyle("size-9");

	const displayName =
		typeof activity.actor.displayName === "string"
			? activity.actor.displayName
			: undefined;
	const avatar =
		typeof activity.actor.avatar === "string"
			? activity.actor.avatar
			: undefined;
	const name = displayName || activity.actor.handle;

	const isMovieish = activity.type === "movie" || activity.type === "review";
	const isReview = activity.type === "review";
	const mediaHref = activityMediaHref(activity);

	const verb = isReview
		? "reviewed"
		: activity.type === "movie"
			? "watched"
			: "watched episode";
	const mediaTitle =
		activity.type === "episode" ? activity.showTitle : activity.title;

	const poster =
		posterUrl(activity.posterPath) ?? backdropUrl(activity.backdropPath);

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

	const excerpt = isReview
		? activity.reviewContent
		: activity.type === "episode"
			? activity.episodeOverview
			: activity.overview;

	const accent =
		typeof activity.colors?.primary === "string"
			? activity.colors.primary
			: undefined;

	return (
		<View
			className="gap-3 overflow-hidden rounded-xl border border-border bg-card p-4"
			style={
				accent ? { borderLeftWidth: 3, borderLeftColor: accent } : undefined
			}
		>
			{/* Actor + action header — full width on top so the poster doesn't leave
			    a gap beside a short content column. */}
			<View className="flex-row items-start gap-2">
				<Link href={`/profile/${activity.actor.handle}` as const} asChild>
					<Pressable className="size-9 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
						{avatar ? (
							<Image
								source={{ uri: avatar }}
								style={avatarStyle}
								contentFit="cover"
							/>
						) : (
							<User color="#94a3b8" size={16} />
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
						<Link href={mediaHref}>
							<Text className="font-medium text-foreground text-sm">
								{mediaTitle}
							</Text>
						</Link>
					</Text>
					<View className="mt-0.5 flex-row items-center gap-1.5">
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

			{/* Poster + media details */}
			<View className="flex-row gap-3">
				<Link href={mediaHref} asChild>
					<Pressable className="overflow-hidden rounded-lg border border-border bg-background-subtle">
						<PosterImage url={poster} className="h-32 w-20" />
					</Pressable>
				</Link>

				<View className="min-w-0 flex-1 gap-1.5">
					{/* Episode identifier */}
					{episodeLabel ? (
						<Link href={mediaHref} asChild>
							<Pressable>
								<Text
									className="font-semibold text-foreground text-sm"
									numberOfLines={1}
								>
									{episodeLabel}
								</Text>
							</Pressable>
						</Link>
					) : null}

					{/* Review rating */}
					{isReview && activity.rating ? (
						<StarRating rating={activity.rating} size={14} />
					) : null}

					{/* Excerpt: review content or synopsis */}
					{excerpt ? (
						<Text className="text-muted-foreground text-sm" numberOfLines={3}>
							{excerpt}
						</Text>
					) : null}

					{/* Inline actions for watch items (reviews stay read-only, as on web) */}
					{!isReview ? (
						isMovieish ? (
							<MediaActionBar
								type="movie"
								id={String(activity.movieId)}
								title={activity.title || ""}
							/>
						) : activity.showId ? (
							<MediaActionBar
								type="show"
								id={String(activity.showId)}
								title={activity.showTitle || ""}
								episode={
									activity.seasonNumber && activity.episodeNumber
										? {
												seasonNumber: activity.seasonNumber,
												episodeNumber: activity.episodeNumber,
											}
										: undefined
								}
							/>
						) : null
					) : null}
				</View>
			</View>
		</View>
	);
}
