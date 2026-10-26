import type { FollowedActivityItemDto } from "@opnshelf/api";
import { formatRelativeTime, slugifyName } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Clock, Film } from "lucide-react";
import { useState } from "react";
import FeedItemActions from "#/components/FeedItemActions";
import { SpoilerShield } from "#/components/SpoilerShield";
import StarRating from "#/components/StarRating";
import { UserAvatar } from "./UserAvatar";

interface ActivityCardProps {
	activity: FollowedActivityItemDto;
	episodes?: FollowedActivityItemDto[];
	userTimezone?: string;
	userTimeFormat?: "12h" | "24h";
}

export function ActivityCard({
	activity,
	episodes = [],
	userTimezone,
	userTimeFormat,
}: ActivityCardProps) {
	const [expanded, setExpanded] = useState(false);
	const bundled = episodes.length > 1;
	const isReview = activity.type === "review";
	const posterSrc = activity.posterPath
		? `https://image.tmdb.org/t/p/w300${activity.posterPath}`
		: activity.backdropPath
			? `https://image.tmdb.org/t/p/w300${activity.backdropPath}`
			: undefined;
	// Bundles show the show's synopsis, single Watches the episode's or movie's.
	// Reviews show their own text instead (below).
	const overview = bundled
		? activity.overview
		: isReview
			? undefined
			: activity.type === "episode"
				? activity.episodeOverview
				: activity.overview;
	return (
		// Whole card is clickable through the stretched title link below (an ::after
		// overlay covering the card), so this is the positioning context. Secondary
		// targets (actor, episode, actions, spoiler reveal) sit above it with z-10.
		<article className="card relative flex w-full flex-col gap-3 p-5 transition-shadow hover:shadow-md">
			{/* Actor + action header: full width on top so the poster doesn't
			    leave a gap beside a short content column. */}
			<div className="flex items-start gap-2">
				<Link
					to="/profile/$handle"
					params={{ handle: activity.actor.handle }}
					className="relative z-10"
				>
					<UserAvatar
						src={activity.actor.avatar}
						alt={String(activity.actor.displayName) || activity.actor.handle}
						size="sm"
					/>
				</Link>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-1.5 text-sm">
						<Link
							to="/profile/$handle"
							params={{ handle: activity.actor.handle }}
							className="relative z-10 font-semibold text-(--foreground) hover:text-(--accent)"
						>
							{String(activity.actor.displayName) || activity.actor.handle}
						</Link>
						<span className="text-(--foreground-muted)">
							{activity.type === "movie"
								? "watched"
								: isReview
									? "reviewed"
									: bundled
										? `watched ${episodes.length} episodes of`
										: "watched episode"}
						</span>
						{activity.movieId ? (
							<Link
								to="/movies/$movieId/$movieName"
								hash={
									activity.reviewId ? `review-${activity.reviewId}` : undefined
								}
								params={{
									movieId: String(activity.movieId),
									movieName: slugifyName(activity.title || ""),
								}}
								className="font-medium text-(--foreground) after:absolute after:inset-0 hover:text-(--accent)"
							>
								{activity.title}
							</Link>
						) : (
							<Link
								to="/shows/$showId/$showName"
								hash={
									activity.reviewId ? `review-${activity.reviewId}` : undefined
								}
								params={{
									showId: String(activity.showId),
									showName: slugifyName(activity.showTitle || ""),
								}}
								className="font-medium text-(--foreground) after:absolute after:inset-0 hover:text-(--accent)"
							>
								{activity.showTitle}
							</Link>
						)}
					</div>
					<div className="mt-0.5 flex items-center gap-1.5 text-(--foreground-muted) text-xs">
						<Clock className="size-3" />
						{bundled
							? `Latest · ${formatRelativeTime(activity.activityAt)} · `
							: ""}
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
				<span className="shrink-0 rounded-full bg-(--background-subtle) px-2 py-0.5 font-medium text-(--foreground-muted) text-xs">
					{activity.movieId ? "Movie" : "TV"}
				</span>
			</div>

			{/* Poster + media details */}
			<div className="flex gap-4">
				{/* Always rendered so cards keep one shape; a placeholder stands
				    in when TMDB has no image. */}
				<div className="shrink-0 overflow-hidden rounded-lg border border-(--border) bg-(--background-subtle)">
					{posterSrc ? (
						<img src={posterSrc} alt="" className="h-32 w-20 object-cover" />
					) : (
						<div
							aria-hidden
							className="flex h-32 w-20 items-center justify-center text-(--foreground-muted)"
						>
							<Film className="size-6" />
						</div>
					)}
				</div>

				<div className="flex min-w-0 flex-1 flex-col gap-2">
					{bundled && (
						<div className="relative z-10">
							<button
								type="button"
								className="btn btn-secondary"
								aria-expanded={expanded}
								onClick={() => setExpanded(!expanded)}
							>
								{expanded ? "Hide episodes" : "Show episodes"}
							</button>
						</div>
					)}
					{/* Episode identifier */}
					{!bundled &&
						activity.type === "episode" &&
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
								className="relative z-10 font-semibold text-(--foreground) text-sm hover:text-(--accent)"
							>
								{activity.seasonNumber && activity.episodeNumber
									? `S${activity.seasonNumber}E${activity.episodeNumber}`
									: ""}
								{activity.episodeName
									? `${activity.seasonNumber && activity.episodeNumber ? " - " : ""}${activity.episodeName}`
									: ""}
							</Link>
						)}

					{/* Review rating and content. A Review can exist without a
					    Rating, so the text must not depend on one. */}
					{isReview && activity.rating ? (
						<StarRating value={activity.rating} readOnly size="md" showValue />
					) : null}
					{isReview && activity.reviewContent ? (
						<div className="relative z-10">
							<SpoilerShield
								spoiler={!!activity.reviewSpoiler}
								authorDid={activity.actor.did}
							>
								<p className="line-clamp-3 text-(--foreground-muted) text-sm">
									{activity.reviewContent}
								</p>
							</SpoilerShield>
						</div>
					) : null}

					{overview ? (
						<p className="line-clamp-3 text-(--foreground-muted) text-sm">
							{overview}
						</p>
					) : null}

					{/* Actions for watch items (Reviews stay read-only) */}
					{!bundled && !isReview && (
						<div className="relative z-10 flex flex-wrap items-center gap-4 pt-1">
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

			{/* Expanded bundle: full width under the poster row, as on Mobile */}
			{bundled && expanded && (
				<div className="relative z-10 space-y-3">
					{episodes.map((episode) => (
						<Link
							key={episode.id}
							to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
							params={{
								showId: String(episode.showId),
								showName: slugifyName(episode.showTitle || ""),
								seasonNumber: String(episode.seasonNumber),
								episodeNumber: String(episode.episodeNumber),
							}}
							className="block border-(--border) border-t py-2 text-sm hover:text-(--accent)"
						>
							<span className="font-semibold">
								S{episode.seasonNumber}E{episode.episodeNumber}
								{episode.episodeName ? ` · ${episode.episodeName}` : ""}
							</span>
							<span className="mt-1 block text-(--foreground-muted) text-xs">
								{new Date(episode.activityAt).toLocaleString("en-US", {
									timeZone: userTimezone,
									hour12: userTimeFormat === "12h",
								})}
							</span>
						</Link>
					))}
				</div>
			)}
		</article>
	);
}
