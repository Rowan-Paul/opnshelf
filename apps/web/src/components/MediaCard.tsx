import { Link } from "@tanstack/react-router";
import { Check, Clock, MoreHorizontal, Play, Star } from "lucide-react";
import { useState } from "react";

interface MediaCardProps {
	id: string | number;
	title: string;
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
	size?: "sm" | "md" | "lg";
	layout?: "poster" | "backdrop";
	href?: string;
	onWatch?: () => void;
	onAddToList?: () => void;
	onMarkWatched?: () => void;
}

export default function MediaCard({
	id,
	title,
	posterUrl,
	backdropUrl,
	type,
	year,
	rating,
	duration,
	episodeInfo,
	progress,
	isWatched = false,
	isInWatchlist = false,
	size = "md",
	layout = "poster",
	href,
	onWatch,
	onAddToList,
	onMarkWatched,
}: MediaCardProps) {
	const [imageLoaded, setImageLoaded] = useState(false);
	const [imageError, setImageError] = useState(false);

	const sizeClasses = {
		sm: {
			poster: "w-[120px]",
			backdrop: "w-[200px]",
		},
		md: {
			poster: "w-[160px] sm:w-[180px]",
			backdrop: "w-[280px] sm:w-[320px]",
		},
		lg: {
			poster: "w-[200px] sm:w-[220px]",
			backdrop: "w-[340px] sm:w-[400px]",
		},
	};

	const aspectClasses = {
		poster: "aspect-[2/3]",
		backdrop: "aspect-video",
	};

	const imageUrl =
		layout === "backdrop" && backdropUrl ? backdropUrl : posterUrl;
	const linkHref = href || (type === "movie" ? `/movie/${id}` : `/show/${id}`);

	return (
		<article
			className={`group relative ${sizeClasses[size][layout]} flex-shrink-0`}
			aria-label={`${title} ${type === "movie" ? "movie" : "TV show"}`}
		>
			<Link to={linkHref} className="block">
				{/* Image Container */}
				<div
					className={`relative ${aspectClasses[layout]} overflow-hidden rounded-lg bg-[var(--background-subtle)]`}
				>
					{/* Skeleton loader */}
					{!imageLoaded && !imageError && (
						<div className="absolute inset-0 animate-pulse bg-[var(--background-strong)]" />
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
						<div className="absolute inset-0 flex items-center justify-center bg-[var(--background-subtle)]">
							<div className="text-center">
								<div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background-strong)]">
									{type === "movie" ? (
										<Play className="h-5 w-5 text-[var(--foreground-muted)]" />
									) : (
										<Clock className="h-5 w-5 text-[var(--foreground-muted)]" />
									)}
								</div>
								<p className="px-2 text-xs text-[var(--foreground-muted)]">
									{title}
								</p>
							</div>
						</div>
					)}

					{/* Gradient overlay for backdrop layout */}
					{layout === "backdrop" && (
						<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
					)}

					{/* Type badge */}
					<div className="absolute left-2 top-2">
						<span
							className={`badge ${
								type === "movie" ? "badge-subtle" : "badge-accent"
							}`}
						>
							{type === "movie" ? "Movie" : "TV"}
						</span>
					</div>

					{/* Watched indicator */}
					{isWatched && (
						<div className="absolute right-2 top-2">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
								<Check className="h-3.5 w-3.5" />
							</div>
						</div>
					)}

					{/* Progress bar */}
					{progress !== undefined && progress > 0 && (
						<div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
							<div
								className="h-full bg-[var(--accent)]"
								style={{ width: `${progress}%` }}
							/>
						</div>
					)}

					{/* Hover actions */}
					{(onWatch || onMarkWatched) && (
						<div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
							{onWatch && (
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
							)}
							{onMarkWatched && !isWatched && (
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										onMarkWatched();
									}}
									className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-110"
									aria-label="Mark as watched"
								>
									<Check className="h-5 w-5" />
								</button>
							)}
						</div>
					)}

					{/* Backdrop layout content */}
					{layout === "backdrop" && (
						<div className="absolute bottom-0 left-0 right-0 p-4">
							<h3 className="font-semibold text-white line-clamp-1">{title}</h3>
							{episodeInfo && (
								<p className="mt-1 text-sm text-white/70">{episodeInfo}</p>
							)}
						</div>
					)}
				</div>

				{/* Poster layout content below image */}
				{layout === "poster" && (
					<div className="mt-2 space-y-1">
						<h3 className="font-medium text-sm text-[var(--foreground)] line-clamp-1">
							{title}
						</h3>
						<div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
							{year && <span>{year}</span>}
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

			{/* Actions menu */}
			{(onAddToList || onMarkWatched) && (
				<div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
					<div className="relative">
						<button
							type="button"
							className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
							aria-label="More options"
						>
							<MoreHorizontal className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}
		</article>
	);
}
