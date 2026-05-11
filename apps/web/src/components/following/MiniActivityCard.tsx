import type { FollowedActivityItemDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import StarRating from "#/components/StarRating";
import { toSlug } from "#/lib/slug";
import { UserAvatar } from "./UserAvatar";

interface MiniActivityCardProps {
	activity: FollowedActivityItemDto;
	userTimezone?: string;
	userTimeFormat?: "12h" | "24h";
}

export function MiniActivityCard({
	activity,
	userTimezone,
	userTimeFormat,
}: MiniActivityCardProps) {
	return (
		<div className="flex items-start gap-3 p-4 first:pt-5 last:pb-5">
			<UserAvatar
				src={activity.actor.avatar}
				alt={String(activity.actor.displayName) || activity.actor.handle}
			/>
			<div className="min-w-0 flex-1">
				{/* Header */}
				<p className="text-sm">
					<Link
						to={"/following" as const}
						className="font-semibold hover:text-(--accent)"
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
					{activity.type === "movie" || activity.type === "review" ? (
						<Link
							to="/movies/$movieId/$movieName"
							params={{
								movieId: String(activity.movieId),
								movieName: toSlug(activity.title || ""),
							}}
							className="font-medium hover:text-(--accent)"
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
							className="font-medium hover:text-(--accent)"
						>
							{activity.showTitle}
						</Link>
					)}
				</p>

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
							className="mt-0.5 block font-semibold text-(--foreground) text-sm hover:text-(--accent)"
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
				className={`badge shrink-0 ${activity.type === "movie" || activity.type === "review" ? "badge-subtle" : "badge-accent"}`}
			>
				{activity.type === "movie" || activity.type === "review"
					? "Movie"
					: "TV"}
			</span>
		</div>
	);
}
