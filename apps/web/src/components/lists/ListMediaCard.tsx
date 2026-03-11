import type { MediaInListDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { getTmdbPosterUrl, parseScopedShowMediaId } from "@/lib/utils";

interface ListMediaCardProps {
	item: MediaInListDto;
	readOnly?: boolean;
	onWatch?: () => void;
	onRemove?: (item: { mediaType: "movie" | "show"; mediaId: string }) => void;
	isWatching?: boolean;
	isRemoving?: boolean;
}

export function ListMediaCard({
	item,
	readOnly = false,
	onWatch,
	onRemove,
	isWatching = false,
	isRemoving = false,
}: ListMediaCardProps) {
	const media = item.media as {
		title?: string;
		posterPath?: string | null;
		releaseYear?: number | null;
		showId?: string;
	};
	const mediaType: "movie" | "show" =
		item.mediaType === "show" ? "show" : "movie";
	const scopedShow =
		mediaType === "show" ? parseScopedShowMediaId(item.mediaId) : null;
	const showIdForNav = media.showId ?? scopedShow?.showId ?? item.mediaId;
	const seasonNumber = scopedShow?.seasonNumber;
	const episodeNumber = scopedShow?.episodeNumber;
	const mediaTitle = media.title ?? "Untitled";
	const mediaSlug = mediaTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	const isMovie = mediaType === "movie";
	const listContext =
		typeof seasonNumber === "number" && typeof episodeNumber === "number"
			? `S${seasonNumber} E${episodeNumber}`
			: typeof seasonNumber === "number"
				? `Season ${seasonNumber}`
				: null;
	const linkTo = isMovie
		? "/movies/$movieId/$title"
		: typeof seasonNumber === "number" && typeof episodeNumber === "number"
			? "/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
			: typeof seasonNumber === "number"
				? "/shows/$showId/$title/seasons/$seasonNumber"
				: "/shows/$showId/$title";
	const linkParams = isMovie
		? { movieId: item.mediaId, title: mediaSlug }
		: typeof seasonNumber === "number" && typeof episodeNumber === "number"
			? {
					showId: showIdForNav,
					title: mediaSlug,
					seasonNumber: String(seasonNumber),
					episodeNumber: String(episodeNumber),
				}
			: typeof seasonNumber === "number"
				? {
						showId: showIdForNav,
						title: mediaSlug,
						seasonNumber: String(seasonNumber),
					}
				: { showId: showIdForNav, title: mediaSlug };
	const posterUrl = getTmdbPosterUrl(media.posterPath ?? null);
	const releaseYear = media.releaseYear;
	const { seedColor } = useTheme();

	return (
		<div className="group">
			<Link
				to={linkTo as never}
				params={linkParams as never}
				className="block relative aspect-2/3 rounded-lg overflow-hidden mb-2"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-highest)",
				}}
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={mediaTitle}
						className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
				) : (
					<div
						className="w-full h-full flex items-center justify-center"
						style={{ color: "var(--md-sys-color-outline)" }}
					>
						No poster
					</div>
				)}
				{!readOnly && onWatch && onRemove ? (
					<div className="absolute top-2 right-2 z-10 flex items-center gap-2">
						<Button
							type="button"
							size="icon-sm"
							variant="default"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								onWatch();
							}}
							disabled={isWatching}
							className="bg-primary hover:bg-primary/80 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100"
							title="Mark as watched"
						>
							{isWatching ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<Check className="w-4 h-4" />
							)}
						</Button>
						<Button
							type="button"
							size="icon-sm"
							variant="destructive"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								onRemove({ mediaType, mediaId: item.mediaId });
							}}
							disabled={isRemoving}
							className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100"
							title="Remove from list"
						>
							{isRemoving ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<X className="w-4 h-4" />
							)}
						</Button>
					</div>
				) : null}
			</Link>
			<Link to={linkTo as never} params={linkParams as never} className="block">
				<h3
					className="font-semibold text-sm line-clamp-2 mb-1 transition-colors"
					style={{ color: "var(--md-sys-color-on-surface)" }}
					onMouseEnter={(e) => {
						e.currentTarget.style.color = seedColor;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.color = "var(--md-sys-color-on-surface)";
					}}
				>
					{mediaTitle}
				</h3>
				{releaseYear ? (
					<p
						className="text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{releaseYear}
					</p>
				) : null}
				{listContext ? (
					<p
						className="text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{listContext}
					</p>
				) : null}
			</Link>
		</div>
	);
}
