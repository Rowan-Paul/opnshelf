import { Link } from "@tanstack/react-router";
import {
	Check,
	Clock,
	ListPlus,
	Loader2,
	Play,
	Plus,
	Star,
	X,
} from "lucide-react";
import { useState } from "react";
import { posthog } from "#/integrations/posthog/provider";
import {
	buildEpisodeUrl,
	buildMovieUrl,
	buildSeasonUrl,
	buildShowUrl,
} from "#/lib/url-utils";
import StarRating, { ratingToStars } from "./StarRating";
import { WatchCountBadge } from "./WatchCountBadge";

export interface MediaCardProps {
	id: string | number;
	title: string;
	displayTitle?: string;
	seasonNumber?: number;
	episodeNumber?: number;
	posterUrl: string;
	backdropUrl?: string;
	type: "movie" | "show";
	tmdbRating?: number;
	globalRating?: number;
	userRating?: number;
	duration?: string;
	episodeInfo?: string;
	progress?: number;
	isWatched?: boolean;
	/** Viewer-relative Watches represented by this card. */
	watchCount?: number;
	/** Distinct aired episode completion, used only for whole-show cards. */
	episodeProgress?: { watched: number; total: number; percentage: number };
	isProgressLoading?: boolean;
	isProgressUnavailable?: boolean;
	isInWatchlist?: boolean;
	isInAnyList?: boolean;
	watchedDate?: string;
	role?: string;
	year?: string | number;
	size?: "sm" | "md" | "lg";
	/** Stretch to fill the parent grid cell instead of using a fixed width. */
	fill?: boolean;
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
	globalRating,
	tmdbRating,
	userRating,
	duration,
	episodeInfo,
	progress,
	isWatched = false,
	watchCount,
	episodeProgress,
	isProgressLoading = false,
	isProgressUnavailable = false,
	watchedDate,
	role,
	year,
	size = "md",
	fill = false,
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
	isInAnyList = false,
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
	const episodeProgressPercent = episodeProgress?.percentage;
	const displayedProgress = episodeProgressPercent ?? progress;

	return (
		<article
			className={`group relative ${fill ? "w-full" : `${sizeClasses[size][layout]} shrink-0`}`}
			aria-label={`${title} ${type === "movie" ? "movie" : "TV show"}`}
		>
			<Link
				to={linkHref}
				className="block"
				onClick={() =>
					posthog.capture("discover_item_opened", {
						surface: "media_card",
						result_type: type,
					})
				}
			>
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
										<Play className="size-5 text-(--foreground-muted)" />
									) : (
										<Clock className="size-5 text-(--foreground-muted)" />
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

					{/* Remove-from-list — top-LEFT dark X, matching the mobile app
					    (the watched toggle owns the top-right corner there too). */}
					{onRemove && (
						<button
							type="button"
							onClick={(e) => {
								e.preventDefault();
								onRemove();
							}}
							disabled={isRemoving}
							className="absolute top-2 left-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70 disabled:opacity-50 sm:h-7 sm:w-7"
							aria-label="Remove from list"
							title="Remove from list"
						>
							{isRemoving ? (
								<Loader2 className="size-4 animate-spin sm:size-3.5" />
							) : (
								<X className="size-4 sm:size-3.5" />
							)}
						</button>
					)}

					{/* Actions — top-right corner */}
					{(isWatched ||
						onManageLists ||
						((onMarkWatched || onUnmarkWatched) && !isProgressUnavailable)) && (
						<div className="absolute top-2 right-2 flex flex-col gap-2 sm:gap-1.5">
							<div className="flex items-center gap-2 sm:gap-1.5">
								{(onMarkWatched || onUnmarkWatched) &&
									!isProgressUnavailable && (
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
											disabled={
												isMarkWatchedPending ||
												isUnmarkWatchedPending ||
												isProgressLoading
											}
											className={`flex h-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 sm:h-7 ${
												episodeProgress
													? "min-w-12 bg-(--accent) px-2 text-[#3f2e00] hover:brightness-95 sm:min-w-10 sm:px-1.5"
													: isWatched
														? `bg-(--accent) text-[#3f2e00] hover:brightness-95 ${watchCount && watchCount > 1 ? "gap-1 px-2.5 sm:px-2" : "w-9 sm:w-7"}`
														: "w-9 bg-white/20 text-white backdrop-blur-sm hover:bg-white/40 sm:w-7"
											}`}
											aria-label={
												episodeProgress
													? `${episodeProgress.watched} of ${episodeProgress.total} episodes watched. Mark remaining watched`
													: isWatched && watchCount
														? `${watchCount} ${watchCount === 1 ? "watch" : "watches"} logged. Remove from shelf`
														: isWatched
															? "Remove from shelf"
															: "Add to shelf"
											}
											title={
												episodeProgress
													? "Mark remaining watched"
													: isWatched
														? "Remove from shelf"
														: "Add to shelf"
											}
										>
											{isProgressLoading ? (
												<span className="h-4 w-6 animate-pulse rounded-full bg-white/35 sm:h-3.5" />
											) : isMarkWatchedPending || isUnmarkWatchedPending ? (
												<Loader2 className="size-4 animate-spin sm:size-3.5" />
											) : episodeProgress ? (
												<span className="font-bold text-xs tabular-nums sm:text-[11px]">
													{episodeProgressPercent}%
												</span>
											) : isWatched ? (
												<>
													<Check className="size-4 sm:size-3.5" />
													{watchCount && watchCount > 1 ? (
														<span className="font-bold text-xs tabular-nums">
															{watchCount}
														</span>
													) : null}
												</>
											) : (
												<Plus className="size-4 sm:size-3.5" />
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
										className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors sm:h-7 sm:w-7 ${
											isInAnyList
												? "bg-(--accent) text-[#3f2e00] hover:brightness-95"
												: "bg-white/20 text-white backdrop-blur-sm hover:bg-white/40"
										}`}
										aria-label={isInAnyList ? "Manage lists" : "Add to list"}
										title={isInAnyList ? "Manage list" : "Add to list"}
									>
										<ListPlus className="size-4 sm:size-3.5" />
									</button>
								)}
							</div>
							{/* Static watched indicator (no interactive callback) */}
							{isWatched && !onMarkWatched && !onUnmarkWatched && (
								<WatchCountBadge
									watchCount={watchCount}
									className={`h-8 self-end sm:h-6 ${watchCount && watchCount > 1 ? "" : "w-8 sm:w-6"}`}
								/>
							)}
						</div>
					)}

					{/* Progress bar */}
					{displayedProgress !== undefined && displayedProgress > 0 && (
						<div className="absolute right-0 bottom-0 left-0 h-1 bg-black/30">
							<div
								className="h-full bg-(--accent)"
								style={{ width: `${displayedProgress}%` }}
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
								<Play className="size-5 fill-current" />
							</button>
						</div>
					)}

					{/* Backdrop layout content */}
					{layout === "backdrop" && (
						<div className="absolute right-0 bottom-0 left-0 p-4">
							<h3 className="line-clamp-2 font-semibold text-white">
								{displayName}
							</h3>
							{episodeInfo && (
								<p className="mt-1 text-sm text-white/70">{episodeInfo}</p>
							)}
							{watchedDate && (
								<p className="mt-1 flex items-center gap-1 text-white/50 text-xs">
									<Clock className="size-3" />
									{watchedDate}
								</p>
							)}
						</div>
					)}
				</div>

				{/* Poster layout content below image */}
				{layout === "poster" && (
					<div className="mt-2 flex flex-col gap-1">
						{watchedDate && (
							<p className="flex items-center gap-1 text-(--foreground-muted) text-xs">
								<Clock className="size-3" />
								{watchedDate}
							</p>
						)}
						{episodeInfo ? (
							<>
								<h3 className="line-clamp-2 font-medium text-(--foreground) text-sm">
									{episodeInfo}
								</h3>
								<p className="line-clamp-1 text-(--foreground-muted) text-xs">
									{displayName}
								</p>
							</>
						) : (
							<h3 className="line-clamp-2 font-medium text-(--foreground) text-sm">
								{displayName}
							</h3>
						)}
						{role && (
							<p className="line-clamp-1 text-(--foreground-muted) text-xs italic">
								{role}
							</p>
						)}
						<div className="flex flex-wrap items-center gap-2 text-(--foreground-muted) text-xs">
							{(() => {
								const parts: { key: string; node: React.ReactNode }[] = [];
								if (year)
									parts.push({ key: "year", node: <span>{year}</span> });
								if (
									typeof seasonNumber === "number" &&
									type === "show" &&
									!episodeInfo
								) {
									parts.push({
										key: "season",
										node: (
											<span>
												{typeof episodeNumber === "number"
													? `S${seasonNumber}E${episodeNumber}`
													: `Season ${seasonNumber}`}
											</span>
										),
									});
								}
								if (globalRating) {
									parts.push({
										key: "globalRating",
										node: (
											<span className="flex items-center gap-1">
												<Star className="size-3 fill-current text-yellow-500" />
												{ratingToStars(globalRating).toFixed(1)}
											</span>
										),
									});
								} else if (tmdbRating) {
									parts.push({
										key: "tmdbRating",
										node: (
											<span className="flex items-center gap-1">
												<Star className="size-3 fill-current text-yellow-500/60" />
												{(tmdbRating / 2).toFixed(1)}
											</span>
										),
									});
								}
								if (duration)
									parts.push({
										key: "duration",
										node: <span>{duration}</span>,
									});
								return parts.map((part, i) => (
									<span key={part.key} className="flex items-center gap-2">
										{i > 0 && <span>•</span>}
										{part.node}
									</span>
								));
							})()}
						</div>
						{userRating ? (
							<div className="mt-0.5">
								<StarRating value={userRating} readOnly size="sm" />
							</div>
						) : null}
					</div>
				)}
			</Link>
		</article>
	);
}
