import {
	type FollowedActivityItemDto,
	formatRelativeTime,
} from "@opnshelf/api";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Clock, User } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { StarRating } from "@/components/detail/StarRating";
import { PosterImage } from "@/components/media/PosterImage";
import { SpoilerShield } from "@/components/reviews/SpoilerShield";
import {
	activityMediaHref,
	formatActivityDate,
} from "@/components/social/ActivityRow";
import { MediaActionBar } from "@/components/social/MediaActionBar";
import { Text } from "@/components/ui/text";
import { backdropUrl, posterUrl } from "@/lib/tmdb";
import { useTwStyle } from "@/lib/use-tw-style";
import { useThemeColors } from "@/theme/colors";

/**
 * Rich activity card for the Activity tab (the dashboard preview keeps the
 * compact `ActivityRow`). Mirrors the web "following" `ActivityCard`: poster
 * art on the left, actor + action header, episode line, a review rating +
 * excerpt or a synopsis excerpt, timestamp, and inline actions (one-tap
 * add-to-shelf + ⋯ quick actions) for watch items.
 */
export function ActivityCard({
	activity,
	episodes = [],
	userTimezone,
	userTimeFormat,
}: {
	activity: FollowedActivityItemDto;
	episodes?: FollowedActivityItemDto[];
	userTimezone?: string;
	userTimeFormat?: "12h" | "24h";
}) {
	const colors = useThemeColors();
	const [expanded, setExpanded] = useState(false);
	const bundled = episodes.length > 1;
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

	const isMovieish = !!activity.movieId;
	const isReview = activity.type === "review";
	const mediaHref = activityMediaHref(
		bundled
			? { ...activity, seasonNumber: undefined, episodeNumber: undefined }
			: activity,
	);

	const verb = isReview
		? "reviewed"
		: activity.type === "movie"
			? "watched"
			: bundled
				? `watched ${episodes.length} episodes of`
				: "watched episode";
	const mediaTitle =
		activity.type === "episode" ? activity.showTitle : activity.title;

	const poster =
		posterUrl(activity.posterPath) ?? backdropUrl(activity.backdropPath);

	const episodeLabel =
		!bundled && activity.type === "episode"
			? [
					activity.seasonNumber && activity.episodeNumber
						? `S${activity.seasonNumber}E${activity.episodeNumber}`
						: undefined,
					activity.episodeName,
				]
					.filter(Boolean)
					.join(" - ")
			: undefined;

	const excerpt = bundled
		? activity.overview
		: isReview
			? activity.reviewContent
			: activity.type === "episode"
				? activity.episodeOverview
				: activity.overview;

	return (
		<View className="gap-3 overflow-hidden rounded-xl border border-border bg-card p-4">
			{/* Whole card taps through to the media page. Nested pressables (the
		// actor avatar/name → profile, and the action bar buttons) win their own
		// touch region via RN's responder system, so they don't trigger this. */}
			<Link href={mediaHref} asChild>
				<Pressable accessible={!bundled} className="gap-3">
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
									<User color={colors.mutedForeground} size={16} />
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
								<Clock color={colors.mutedForeground} size={12} />
								<Text className="text-muted-foreground text-xs">
									{bundled
										? `Latest · ${formatRelativeTime(activity.activityAt)} · `
										: ""}
									{formatActivityDate(
										activity.activityAt,
										userTimezone,
										userTimeFormat,
									)}
								</Text>
							</View>
						</View>
						<View className="shrink-0 rounded-full bg-background-subtle px-2 py-0.5">
							<Text className="font-medium text-muted-foreground text-xs">
								{isMovieish ? "Movie" : "TV"}
							</Text>
						</View>
					</View>

					{/* Poster + media details */}
					<View className="flex-row gap-3">
						<View className="overflow-hidden rounded-lg border border-border bg-background-subtle">
							<PosterImage url={poster} className="h-32 w-20" />
						</View>

						<View className="min-w-0 flex-1 gap-1.5">
							{bundled && (
								<Pressable
									accessibilityRole="button"
									accessibilityState={{ expanded }}
									onPress={(event) => {
										event.stopPropagation();
										setExpanded(!expanded);
									}}
									className="self-start rounded-lg border border-border px-3 py-2.5"
								>
									<Text className="font-semibold text-primary text-sm">
										{expanded ? "Hide episodes" : "Show episodes"}
									</Text>
								</Pressable>
							)}
							{/* Episode identifier */}
							{episodeLabel ? (
								<Text
									className="font-semibold text-foreground text-sm"
									numberOfLines={1}
								>
									{episodeLabel}
								</Text>
							) : null}

							{/* Review rating */}
							{isReview && activity.rating ? (
								<StarRating rating={activity.rating} size={14} />
							) : null}

							{/* Excerpt: review content or synopsis. Review excerpts carry the
						author's Spoiler Flag, so they're wrapped in a Shield; synopses
						never have `reviewSpoiler` set and pass straight through. */}
							{excerpt ? (
								<SpoilerShield
									spoiler={!!activity.reviewSpoiler}
									authorDid={activity.actor.did}
								>
									<Text
										className="text-muted-foreground text-sm"
										numberOfLines={3}
									>
										{excerpt}
									</Text>
								</SpoilerShield>
							) : null}

							{/* Inline actions for watch items (reviews stay read-only, as on web) */}
							{!bundled && !isReview ? (
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
				</Pressable>
			</Link>
			{bundled && expanded && (
				<View className="gap-3">
					{episodes.map((episode) => (
						<Link key={episode.id} href={activityMediaHref(episode)} asChild>
							<Pressable className="gap-1 border-border border-t py-3">
								<Text className="font-semibold text-foreground text-sm">
									S{episode.seasonNumber}E{episode.episodeNumber}
									{episode.episodeName ? ` · ${episode.episodeName}` : ""}
								</Text>
								<Text className="text-muted-foreground text-xs">
									{formatActivityDate(
										episode.activityAt,
										userTimezone,
										userTimeFormat,
									)}
								</Text>
							</Pressable>
						</Link>
					))}
				</View>
			)}
		</View>
	);
}
