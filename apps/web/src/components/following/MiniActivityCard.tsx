import type { FollowedActivityItemDto } from "@opnshelf/api";
import { slugifyName } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Clock, Film } from "lucide-react";
import StarRating from "#/components/StarRating";
import { UserAvatar } from "./UserAvatar";

interface MiniActivityCardProps {
	activity: FollowedActivityItemDto;
	userTimezone?: string;
	userTimeFormat?: "12h" | "24h";
}

/**
 * Compact row for the Home preview of the Activity Feed. Same anatomy as the
 * Social page's `ActivityCard` (poster, actor + action sentence, timestamp)
 * without the synopsis and inline actions.
 */
export function MiniActivityCard({
	activity,
	userTimezone,
	userTimeFormat,
}: MiniActivityCardProps) {
	const posterSrc = activity.posterPath
		? `https://image.tmdb.org/t/p/w185${activity.posterPath}`
		: activity.backdropPath
			? `https://image.tmdb.org/t/p/w185${activity.backdropPath}`
			: undefined;
	const mediaLink = activity.movieId
		? {
				to: "/movies/$movieId/$movieName" as const,
				params: {
					movieId: String(activity.movieId),
					movieName: slugifyName(activity.title || ""),
				},
			}
		: {
				to: "/shows/$showId/$showName" as const,
				params: {
					showId: String(activity.showId),
					showName: slugifyName(activity.showTitle || ""),
				},
			};
	const hash = activity.reviewId ? `review-${activity.reviewId}` : undefined;

	return (
		// Whole row is clickable through the stretched title link (an ::after
		// overlay), so this is the positioning context; actor links sit above it.
		<div className="relative flex items-start gap-3 p-4 transition-colors first:pt-5 last:pb-5 hover:bg-(--background-subtle)/50">
			<div className="shrink-0">
				{posterSrc ? (
					<img
						src={posterSrc}
						alt=""
						className="h-16 w-11 rounded-md object-cover"
					/>
				) : (
					<div
						aria-hidden
						className="flex h-16 w-11 items-center justify-center rounded-md bg-(--background-subtle) text-(--foreground-muted)"
					>
						<Film className="size-4" />
					</div>
				)}
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<Link
						to="/profile/$handle"
						params={{ handle: activity.actor.handle }}
						className="relative z-10 shrink-0"
					>
						<UserAvatar
							src={activity.actor.avatar}
							alt={String(activity.actor.displayName) || activity.actor.handle}
							size="sm"
						/>
					</Link>
					<p className="min-w-0 text-sm">
						<Link
							to="/profile/$handle"
							params={{ handle: activity.actor.handle }}
							className="relative z-10 font-semibold hover:text-(--accent)"
						>
							{String(activity.actor.displayName) || activity.actor.handle}
						</Link>
						<span className="text-(--foreground-muted)">
							{" "}
							{activity.type === "movie"
								? "watched"
								: activity.type === "review"
									? "reviewed"
									: "watched episode"}{" "}
						</span>
						<Link
							{...mediaLink}
							hash={hash}
							className="font-medium after:absolute after:inset-0 hover:text-(--accent)"
						>
							{activity.movieId ? activity.title : activity.showTitle}
						</Link>
					</p>
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
								showName: slugifyName(activity.showTitle || ""),
								seasonNumber: String(activity.seasonNumber || 0),
								episodeNumber: String(activity.episodeNumber || 0),
							}}
							className="relative z-10 mt-1 block font-semibold text-(--foreground) text-sm hover:text-(--accent)"
						>
							{activity.seasonNumber && activity.episodeNumber
								? `S${activity.seasonNumber}E${activity.episodeNumber}`
								: ""}
							{activity.episodeName
								? `${activity.seasonNumber && activity.episodeNumber ? " - " : ""}${activity.episodeName}`
								: ""}
						</Link>
					)}

				{/* Review rating */}
				{activity.type === "review" && activity.rating && (
					<div className="mt-1">
						<StarRating value={activity.rating} readOnly size="sm" />
					</div>
				)}

				{/* Timestamp */}
				<div className="mt-1 flex items-center gap-1.5 text-(--foreground-muted) text-xs">
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

			{/* Content Type Badge */}
			<span
				className={`badge shrink-0 ${activity.movieId ? "badge-subtle" : "badge-accent"}`}
			>
				{activity.movieId ? "Movie" : "TV"}
			</span>
		</div>
	);
}
