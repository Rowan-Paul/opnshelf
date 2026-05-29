import {
	Bookmark,
	Check,
	Heart,
	Loader2,
	Share2,
	Star,
	StickyNote,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { useListActions, useListItemStatus } from "#/lib/hooks";
import { useNote } from "#/lib/hooks/useNotes";
import { useRating } from "#/lib/hooks/useRatings";
import { NoteDialog } from "./NoteDialog";
import { ReviewDialog } from "./ReviewDialog";

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
	const { user } = useAuth();
	const userDid = user?.did ?? "";

	const [shareSuccess, setShareSuccess] = useState(false);
	const [noteDialogOpen, setNoteDialogOpen] = useState(false);
	const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

	const { isInWatchlist, isInFavorites } = useListItemStatus({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	const { toggleWatchlist, toggleFavorites, activeListAction, isPending } =
		useListActions({ mediaType, mediaId, seasonNumber, episodeNumber });

	const { data: note } = useNote({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	const { data: ratingRecord } = useRating({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const handleShare = async () => {
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({ title: document.title, url });
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
						<Loader2 className="size-4 animate-spin" />
						Loading
					</>
				) : isInWatchlist ? (
					<>
						<Bookmark className="size-4 fill-current" />
						In Watchlist
					</>
				) : (
					<>
						<Bookmark className="size-4" />
						Add to Watchlist
					</>
				)}
			</button>

			{/* Icon-only buttons — wrap to next line on mobile */}
			<div className="flex w-full flex-wrap gap-3 sm:w-auto">
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
						<Loader2 className="size-5 animate-spin" />
					) : (
						<Heart
							className={`size-5 ${isInFavorites ? "fill-current" : ""}`}
						/>
					)}
				</button>

				{/* Note Button */}
				<button
					type="button"
					onClick={() => setNoteDialogOpen(true)}
					className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 ${
						note?.content
							? "border-(--accent)/20 bg-(--accent)/10 text-(--accent) hover:bg-(--accent)/20"
							: "border-(--border) bg-(--background-elevated) text-(--foreground) hover:border-(--border-strong) hover:bg-(--background-subtle)"
					}`}
					aria-label={note?.content ? "Edit note" : "Add note"}
				>
					<StickyNote
						className={`size-5 ${note?.content ? "fill-current" : ""}`}
					/>
				</button>

				{/* Review Button */}
				<button
					type="button"
					onClick={() => setReviewDialogOpen(true)}
					className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 ${
						ratingRecord?.rating
							? "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
							: "border-(--border) bg-(--background-elevated) text-(--foreground) hover:border-(--border-strong) hover:bg-(--background-subtle)"
					}`}
					aria-label={ratingRecord?.rating ? "Edit review" : "Add review"}
				>
					<Star
						className={`size-5 ${ratingRecord?.rating ? "fill-current" : ""}`}
					/>
				</button>

				{/* Share Button */}
				<button
					type="button"
					onClick={handleShare}
					className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-(--border) bg-(--background-elevated) text-(--foreground) transition-all duration-150 hover:border-(--border-strong) hover:bg-(--background-subtle)"
					aria-label={shareSuccess ? "Copied to clipboard" : "Share"}
				>
					{shareSuccess ? (
						<Check className="size-5 text-green-500" />
					) : (
						<Share2 className="size-5" />
					)}
				</button>
			</div>

			<NoteDialog
				open={noteDialogOpen}
				onOpenChange={setNoteDialogOpen}
				mediaType={mediaType}
				mediaId={mediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
			/>
			<ReviewDialog
				open={reviewDialogOpen}
				onOpenChange={setReviewDialogOpen}
				mediaType={mediaType}
				mediaId={mediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
			/>
		</>
	);
}
