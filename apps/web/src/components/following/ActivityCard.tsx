import type { FollowedActivityItemDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import FeedItemActions from "#/components/FeedItemActions";
import { SpoilerShield } from "#/components/SpoilerShield";
import StarRating from "#/components/StarRating";
import { toSlug } from "#/lib/slug";
import { UserAvatar } from "./UserAvatar";

interface ActivityCardProps {
	activity: FollowedActivityItemDto;
	userTimezone?: string;
	userTimeFormat?: "12h" | "24h";
}

export function ActivityCard({
	activity,
	userTimezone,
	userTimeFormat,
}: ActivityCardProps) {
	return (
		<article className="card w-full p-5 transition-shadow hover:shadow-md">
			<div className="flex gap-4">
				{/* Poster on the left */}
				{(activity.posterPath || activity.backdropPath) && (
					<div className="shrink-0">
						{activity.type === "movie" || activity.type === "review" ? (
							<Link
								to="/movies/$movieId/$movieName"
								params={{
									movieId: String(activity.movieId),
									movieName: toSlug(activity.title || ""),
								}}
							>
								<img
									src={
										activity.posterPath
											? `https://image.tmdb.org/t/p/w300${activity.posterPath}`
											: `https://image.tmdb.org/t/p/w300${activity.backdropPath}`
									}
									alt={activity.title || activity.showTitle || ""}
									className="h-32 w-20 rounded-lg object-cover"
								/>
							</Link>
						) : (
							<Link
								to="/shows/$showId/$showName"
								params={{
									showId: String(activity.showId),
									showName: toSlug(activity.showTitle || ""),
								}}
							>
								<img
									src={
										activity.posterPath
											? `https://image.tmdb.org/t/p/w300${activity.posterPath}`
											: `https://image.tmdb.org/t/p/w300${activity.backdropPath}`
									}
									alt={activity.title || activity.showTitle || ""}
									className="h-32 w-20 rounded-lg object-cover"
								/>
							</Link>
						)}
					</div>
				)}

				{/* Content next to poster */}
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					{/* Profile + action header */}
					<div className="flex items-start gap-2">
						<Link
							to="/profile/$handle"
							params={{ handle: activity.actor.handle }}
						>
							<UserAvatar
								src={activity.actor.avatar}
								alt={
									String(activity.actor.displayName) || activity.actor.handle
								}
								size="sm"
							/>
						</Link>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-1.5 text-sm">
								<Link
									to="/profile/$handle"
									params={{ handle: activity.actor.handle }}
									className="font-semibold text-(--foreground) hover:text-(--accent)"
								>
									{String(activity.actor.displayName) || activity.actor.handle}
								</Link>
								<span className="text-(--foreground-muted)">
									{activity.type === "movie"
										? "watched"
										: activity.type === "review"
											? "reviewed"
											: "watched episode"}
								</span>
								{activity.type === "movie" || activity.type === "review" ? (
									<Link
										to="/movies/$movieId/$movieName"
										params={{
											movieId: String(activity.movieId),
											movieName: toSlug(activity.title || ""),
										}}
										className="font-medium text-(--foreground) hover:text-(--accent)"
									>
										{activity.title}
									</Link>
								) : (
									<Link
										to="/shows/$showId/$showName"
										params={{
											showId: String(activity.showId),
											showName: toSlug(activity.showTitle || ""),
										}}
										className="font-medium text-(--foreground) hover:text-(--accent)"
									>
										{activity.showTitle}
									</Link>
								)}
							</div>
							<div className="mt-0.5 flex items-center gap-1.5 text-(--foreground-muted) text-xs">
								<Clock className="size-3" />
								{new Date(activity.activityAt).toLocaleString("en-US", {
									month: "short",
									day: "numeric",
									hour: "numeric",
									minute: "2-digit",
									timeZone: userTimezone,
									hour12: userTimeFormat === "12h",
								})}
							</div>
						</div>
					</div>

					{/* Episode identifier */}
					{activity.type === "episode" &&
						(activity.seasonNumber ||
							activity.episodeNumber ||
							activity.episodeName) && (
							<Link
								to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
								params={{
									showId: String(activity.showId),
									showName: toSlug(activity.showTitle || ""),
									seasonNumber: String(activity.seasonNumber || 0),
									episodeNumber: String(activity.episodeNumber || 0),
								}}
								className="font-semibold text-(--foreground) text-base hover:text-(--accent)"
							>
								{activity.seasonNumber && activity.episodeNumber
									? `S${activity.seasonNumber}E${activity.episodeNumber}`
									: ""}
								{activity.episodeName
									? `${activity.seasonNumber && activity.episodeNumber ? " - " : ""}${activity.episodeName}`
									: ""}
							</Link>
						)}

					{/* Review rating and content */}
					{activity.type === "review" && activity.rating && (
						<div className="space-y-2">
							<StarRating
								value={activity.rating}
								readOnly
								size="md"
								showValue
							/>
							{activity.reviewContent && (
								<SpoilerShield
									spoiler={!!activity.reviewSpoiler}
									authorDid={activity.actor.did}
								>
									<p className="line-clamp-3 text-(--foreground-muted) text-sm">
										{activity.reviewContent}
									</p>
								</SpoilerShield>
							)}
						</div>
					)}

					{/* Description */}
					{activity.type !== "review" &&
						(activity.type === "episode"
							? activity.episodeOverview
							: activity.overview) && (
							<p className="line-clamp-3 text-(--foreground-muted) text-sm">
								{activity.type === "episode"
									? activity.episodeOverview
									: activity.overview}
							</p>
						)}

					{/* Actions */}
					{activity.type !== "review" && (
						<div className="flex flex-wrap items-center gap-4 pt-1">
							{activity.type === "movie" ? (
								<FeedItemActions
									type="movie"
									mediaId={String(activity.movieId)}
									title={activity.title || ""}
								/>
							) : (
								<FeedItemActions
									type="show"
									mediaId={String(activity.showId)}
									seasonNumber={Number(activity.seasonNumber || 0)}
									episodeNumber={Number(activity.episodeNumber || 0)}
									title={activity.showTitle || ""}
								/>
							)}
						</div>
					)}
				</div>
			</div>
		</article>
	);
}
