import { Bookmark, Check, Heart, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { useListActions, useListItemStatus } from "#/lib/hooks";

interface MediaActionsBarProps {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export default function MediaActionsBar({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: MediaActionsBarProps) {
	const [shareSuccess, setShareSuccess] = useState(false);
	const { isInWatchlist, isInFavorites } = useListItemStatus({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	const { toggleWatchlist, toggleFavorites, activeListAction, isPending } =
		useListActions({ mediaType, mediaId, seasonNumber, episodeNumber });

	const handleShare = async () => {
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({
					title: document.title,
					url,
				});
			} catch {
				// User cancelled or share failed
			}
		} else if (navigator.clipboard) {
			try {
				await navigator.clipboard.writeText(url);
				setShareSuccess(true);
				setTimeout(() => setShareSuccess(false), 2000);
			} catch {
				// Clipboard write failed
			}
		}
	};

	return (
		<>
			{/* Watchlist Button */}
			<button
				type="button"
				onClick={() => toggleWatchlist(isInWatchlist)}
				disabled={isPending}
				className="btn btn-secondary gap-2"
			>
				{activeListAction === "watchlist" ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading
					</>
				) : isInWatchlist ? (
					<>
						<Bookmark className="h-4 w-4 fill-current" />
						In Watchlist
					</>
				) : (
					<>
						<Bookmark className="h-4 w-4" />
						Add to Watchlist
					</>
				)}
			</button>

			{/* Favorites Button */}
			<button
				type="button"
				onClick={() => toggleFavorites(isInFavorites)}
				disabled={isPending}
				className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 ${
					isInFavorites
						? "border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20"
						: "border-(--border) bg-(--background-elevated) text-(--foreground) hover:border-(--border-strong) hover:bg-(--background-subtle)"
				}`}
				aria-label={
					isInFavorites ? "Remove from Favorites" : "Add to Favorites"
				}
			>
				{activeListAction === "favorites" ? (
					<Loader2 className="h-5 w-5 animate-spin" />
				) : (
					<Heart className={`h-5 w-5 ${isInFavorites ? "fill-current" : ""}`} />
				)}
			</button>

			{/* Share Button */}
			<button
				type="button"
				onClick={handleShare}
				className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-(--border) bg-(--background-elevated) text-(--foreground) transition-all duration-150 hover:border-(--border-strong) hover:bg-(--background-subtle)"
				aria-label={shareSuccess ? "Copied to clipboard" : "Share"}
			>
				{shareSuccess ? (
					<Check className="h-5 w-5 text-green-500" />
				) : (
					<Share2 className="h-5 w-5" />
				)}
			</button>
		</>
	);
}
