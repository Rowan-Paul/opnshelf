import { Link } from "@tanstack/react-router";
import { Check, Clock, Library, Loader2, Play, Star, X } from "lucide-react";
import { useState } from "react";
import {
	buildEpisodeUrl,
	buildMovieUrl,
	buildSeasonUrl,
	buildShowUrl,
} from "#/lib/url-utils";

export interface MediaCardProps {
	id: string | number;
	title: string;
	displayTitle?: string; // Optional different title for display (e.g., episode name)
	// Episode-specific props for linking to episode detail page
	seasonNumber?: number;
	episodeNumber?: number;
	posterUrl: string;
	backdropUrl?: string;
	type: "movie" | "show";
	year?: number;
	rating?: number;
	duration?: string;
	episodeInfo?: string;
	progress?: number;
	isWatched?: boolean;
	isInWatchlist?: boolean;
	watchedDate?: string;
	size?: "sm" | "md" | "lg";
	layout?: "poster" | "backdrop";
	href?: string;
	onWatch?: () => void;
	onManageLists?: () => void;
	onMarkWatched?: () => void;
	onUnmarkWatched?: () => void;
	onRemove?: () => void;
	isRemoving?: boolean;
	isMarkWatchedPending?: boolean;
	isUnmarkWatchedPending?: boolean;
}

export default function MediaCard({
	id,
	title,
	displayTitle,
	seasonNumber,
	episodeNumber,
	posterUrl,
	backdropUrl,
	type,
	year,
	rating,
	duration,
	episodeInfo,
	progress,
	isWatched = false,
	watchedDate,
	size = "md",
	layout = "poster",
	href,
	onWatch,
	onManageLists,
	onMarkWatched,
	onUnmarkWatched,
	onRemove,
	isRemoving = false,
	isMarkWatchedPending = false,
	isUnmarkWatchedPending = false,
}: MediaCardProps) {
	const [imageLoaded, setImageLoaded] = useState(false);
	const [imageError, setImageError] = useState(false);

	const sizeClasses = {
		sm: {
			poster: "w-[120px]",
			backdrop: "w-full max-w-[200px]",
		},
		md: {
			poster: "w-[160px] sm:w-[180px]",
			backdrop: "w-full",
		},
		lg: {
			poster: "w-[200px] sm:w-[220px]",
			backdrop: "w-full",
		},
	};

	const aspectClasses = {
		poster: "aspect-2/3",
		backdrop: "aspect-video",
	};

	const imageUrl =
		layout === "backdrop" && backdropUrl ? backdropUrl : posterUrl;

	// Build URL - scoped show items go to season/episode detail pages
	const linkHref = (() => {
		if (href) return href;
		if (type === "movie") {
			return buildMovieUrl(id, title);
		}
		if (type === "show" && seasonNumber !== undefined) {
			if (episodeNumber !== undefined) {
				return buildEpisodeUrl(id, title, seasonNumber, episodeNumber);
			}
			return buildSeasonUrl(id, title, seasonNumber);
		}
		return buildShowUrl(id, title);
	})();

	const displayName = displayTitle || title;

	return (
		<article
			className={`group relative ${sizeClasses[size][layout]} shrink-0`}
			aria-label={`${title} ${type === "movie" ? "movie" : "TV show"}`}
		>
			<Link to={linkHref} className="block">
				{/* Image Container */}
				<div
					className={`relative ${aspectClasses[layout]} overflow-hidden rounded-lg bg-(--background-subtle)`}
				>
					{/* Skeleton loader */}
					{!imageLoaded && !imageError && (
						<div className="absolute inset-0 animate-pulse bg-(--background-strong)" />
					)}

					{/* Main image */}
					<img
						src={imageUrl}
						alt={title}
						className={`h-full w-full object-cover transition-all duration-300 ${
							imageLoaded ? "opacity-100" : "opacity-0"
						} group-hover:scale-105`}
						onLoad={() => setImageLoaded(true)}
						onError={() => setImageError(true)}
					/>

					{/* Error fallback */}
					{imageError && (
						<div className="absolute inset-0 flex items-center justify-center bg-(--background-subtle)">
							<div className="text-center">
								<div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-(--background-strong)">
									{type === "movie" ? (
										<Play className="h-5 w-5 text-(--foreground-muted)" />
									) : (
										<Clock className="h-5 w-5 text-(--foreground-muted)" />
									)}
								</div>
								<p className="px-2 text-(--foreground-muted) text-xs">
									{displayName}
								</p>
							</div>
						</div>
					)}

					{/* Gradient overlay for backdrop layout */}
					{layout === "backdrop" && (
						<div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
					)}

					{/* Type badge */}
					<div className="absolute top-2 left-2">
						<span
							className={`badge ${
								type === "movie" ? "badge-subtle" : "badge-accent"
							}`}
						>
							{type === "movie" ? "Movie" : "TV"}
						</span>
					</div>

					{/* Shelf toggle + lists button — always visible in top-right corner */}
					{(onMarkWatched || onUnmarkWatched || onManageLists) && (
						<div className="absolute top-2 right-2 flex items-center gap-1.5">
							{(onMarkWatched || onUnmarkWatched) && (
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										if (isWatched && onUnmarkWatched) {
											onUnmarkWatched();
										} else if (onMarkWatched) {
											onMarkWatched();
										}
									}}
									disabled={isMarkWatchedPending || isUnmarkWatchedPending}
									className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
										isWatched
											? "bg-green-500 text-white hover:bg-green-600"
											: "bg-white/20 text-white backdrop-blur-sm hover:bg-white/40"
									}`}
									aria-label={
										isWatched ? "Remove from shelf" : "Mark as watched"
									}
									title={isWatched ? "Remove from shelf" : "Add to shelf"}
								>
									{isMarkWatchedPending || isUnmarkWatchedPending ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
									) : (
										<Check className="h-3.5 w-3.5" />
									)}
								</button>
							)}
							{onManageLists && (
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										onManageLists();
									}}
									className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/40"
									aria-label="Manage lists"
									title="Add to list"
								>
									<Library className="h-3.5 w-3.5" />
								</button>
							)}
						</div>
					)}

					{/* Static watched indicator (no interactive callback) */}
					{isWatched && !onMarkWatched && !onUnmarkWatched && (
						<div className="absolute top-2 right-2">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
								<Check className="h-3.5 w-3.5" />
							</div>
						</div>
					)}

					{/* Progress bar */}
					{progress !== undefined && progress > 0 && (
						<div className="absolute right-0 bottom-0 left-0 h-1 bg-black/30">
							<div
								className="h-full bg-(--accent)"
								style={{ width: `${progress}%` }}
							/>
						</div>
					)}

					{/* Hover actions */}
					{onWatch && (
						<div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault();
									onWatch();
								}}
								className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-110"
								aria-label="Watch"
							>
								<Play className="h-5 w-5 fill-current" />
							</button>
						</div>
					)}

					{/* Backdrop layout content */}
					{layout === "backdrop" && (
						<div className="absolute right-0 bottom-0 left-0 p-4">
							<h3 className="line-clamp-1 font-semibold text-white">
								{displayName}
							</h3>
							{episodeInfo && (
								<p className="mt-1 text-sm text-white/70">{episodeInfo}</p>
							)}
							{watchedDate && (
								<p className="mt-1 flex items-center gap-1 text-white/50 text-xs">
									<Clock className="h-3 w-3" />
									{watchedDate}
								</p>
							)}
						</div>
					)}
				</div>

				{/* Poster layout content below image */}
				{layout === "poster" && (
					<div className="mt-2 space-y-1">
						<h3 className="line-clamp-1 font-medium text-(--foreground) text-sm">
							{displayName}
						</h3>
						<div className="flex items-center gap-2 text-(--foreground-muted) text-xs">
							{year && <span>{year}</span>}
							{typeof seasonNumber === "number" && type === "show" && (
								<>
									<span>•</span>
									<span>
										{typeof episodeNumber === "number"
											? `S${seasonNumber}E${episodeNumber}`
											: `Season ${seasonNumber}`}
									</span>
								</>
							)}
							{rating && (
								<>
									<span>•</span>
									<span className="flex items-center gap-1">
										<Star className="h-3 w-3 fill-current text-yellow-500" />
										{rating.toFixed(1)}
									</span>
								</>
							)}
							{duration && (
								<>
									<span>•</span>
									<span>{duration}</span>
								</>
							)}
						</div>
					</div>
				)}
			</Link>

			{/* Actions menu — visible on mobile, hover-only on desktop */}
			{onRemove && (
				<div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
					<button
						type="button"
						onClick={(e) => {
							e.preventDefault();
							onRemove();
						}}
						disabled={isRemoving}
						className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/80 text-white backdrop-blur-sm transition-colors hover:bg-red-600 disabled:opacity-50"
						aria-label="Remove from list"
					>
						{isRemoving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<X className="h-4 w-4" />
						)}
					</button>
				</div>
			)}
		</article>
	);
}
