import type { FollowedActivityItemDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Clock, MoreHorizontal } from "lucide-react";
import FeedItemActions from "#/components/FeedItemActions";
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
		<article className="card p-5 transition-shadow hover:shadow-md">
			<div className="flex gap-4">
				{/* Poster on the left */}
				{(activity.posterPath || activity.backdropPath) && (
					<div className="shrink-0">
						{activity.type === "movie" ? (
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
				<div className="flex-1 min-w-0 flex flex-col gap-2">
					{/* Profile + action header */}
					<div className="flex items-start gap-2">
						<UserAvatar
							src={activity.actor.avatar}
							alt={String(activity.actor.displayName) || activity.actor.handle}
							size="sm"
						/>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-1.5 flex-wrap text-sm">
								<Link
									to={"/following" as const}
									className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
								>
									{String(activity.actor.displayName) || activity.actor.handle}
								</Link>
								<span className="text-[var(--foreground-muted)]">
									{activity.type === "movie" ? "watched" : "watched episode"}
								</span>
								{activity.type === "movie" ? (
									<Link
										to="/movies/$movieId/$movieName"
										params={{
											movieId: String(activity.movieId),
											movieName: toSlug(activity.title || ""),
										}}
										className="font-medium text-[var(--foreground)] hover:text-[var(--accent)]"
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
										className="font-medium text-[var(--foreground)] hover:text-[var(--accent)]"
									>
										{activity.showTitle}
									</Link>
								)}
							</div>
							<div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--foreground-muted)]">
								<Clock className="h-3 w-3" />
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
						<button
							type="button"
							className="btn btn-ghost h-8 w-8 p-0 text-[var(--foreground-muted)] shrink-0"
							aria-label="More options"
						>
							<MoreHorizontal className="h-4 w-4" />
						</button>
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
								className="text-base font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
							>
								{activity.seasonNumber && activity.episodeNumber
									? `S${activity.seasonNumber}E${activity.episodeNumber}`
									: ""}
								{activity.episodeName
									? `${activity.seasonNumber && activity.episodeNumber ? " - " : ""}${activity.episodeName}`
									: ""}
							</Link>
						)}

					{/* Description */}
					{(activity.type === "episode"
						? activity.episodeOverview
						: activity.overview) && (
						<p className="text-[var(--foreground-muted)] text-sm line-clamp-3">
							{activity.type === "episode"
								? activity.episodeOverview
								: activity.overview}
						</p>
					)}

					{/* Actions */}
					<div className="flex items-center gap-4 pt-1">
						{activity.type === "movie" ? (
							<FeedItemActions
								type="movie"
								mediaId={String(activity.movieId)}
							/>
						) : (
							<FeedItemActions
								type="show"
								mediaId={String(activity.showId)}
								seasonNumber={Number(activity.seasonNumber || 0)}
								episodeNumber={Number(activity.episodeNumber || 0)}
							/>
						)}
					</div>
				</div>
			</div>
		</article>
	);
}
