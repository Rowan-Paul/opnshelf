import {
	Bookmark,
	Check,
	Disc,
	Ellipsis,
	Heart,
	ListPlus,
	Loader2,
	MessageSquarePlus,
	Share2,
	Star,
	StickyNote,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";
import {
	useLibraryForItem,
	useListActions,
	useListItemStatus,
} from "#/lib/hooks";
import { useNote } from "#/lib/hooks/useNotes";
import { useRating } from "#/lib/hooks/useRatings";
import { useMediaReviews } from "#/lib/hooks/useReviews";
import AddToLibraryDialog from "./AddToLibraryDialog";
import ManageListsDialog from "./ManageListsDialog";
import { NoteDialog } from "./NoteDialog";
import { ReviewDialog } from "./ReviewDialog";
import { ratingToStars } from "./StarRating";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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
	const [rateReviewDialogOpen, setRateReviewDialogOpen] = useState(false);
	const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
	const [listsDialogOpen, setListsDialogOpen] = useState(false);

	const { data: ownedFormats } = useLibraryForItem({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	const ownedCount = ownedFormats?.length ?? 0;

	const { isInWatchlist, isInFavorites, customListsWithStatus } =
		useListItemStatus({
			mediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		});
	const customListCount = (customListsWithStatus ?? []).filter(
		(list) => list.isInList,
	).length;
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
	const rating = ratingRecord?.rating ?? 0;
	const { data: reviews } = useMediaReviews({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	// A user may write several Reviews per title; the button always opens a fresh
	// one. The active state reflects whether they have *reviewed* this title —
	// independent of any Rating (those are separate entities).
	const hasReviewed = (reviews?.items ?? []).some(
		(review) => review.userDid === userDid,
	);

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
			{/*
				Compact desktop hierarchy: immediate tracking actions stay in the hero;
				less frequent editorial and organisation actions live under More.
			*/}
			<div className="contents lg:flex lg:shrink-0 lg:flex-nowrap lg:items-center lg:gap-2">
				<button
					type="button"
					onClick={() => toggleWatchlist(isInWatchlist)}
					disabled={isPending}
					className="btn btn-secondary h-10 w-10 justify-center p-0 lg:w-auto lg:gap-2 lg:px-3"
				>
					{activeListAction === "watchlist" ? (
						<>
							<Loader2 className="size-5 animate-spin lg:size-4" />
							<span className="hidden lg:inline">Loading</span>
						</>
					) : isInWatchlist ? (
						<>
							<Bookmark className="size-5 fill-current lg:size-4" />
							<span className="hidden lg:inline">In Watchlist</span>
						</>
					) : (
						<>
							<Bookmark className="size-5 lg:size-4" />
							<span className="hidden lg:inline">Watchlist</span>
						</>
					)}
				</button>
				<button
					type="button"
					onClick={() => toggleFavorites(isInFavorites)}
					disabled={isPending}
					className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 ${isInFavorites ? "border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20" : "border-(--border) bg-(--background-elevated) text-(--foreground) hover:border-(--border-strong) hover:bg-(--background-subtle)"}`}
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
				<button
					type="button"
					onClick={() => setRateReviewDialogOpen(true)}
					className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 ${hasReviewed ? "border-(--accent)/20 bg-(--accent)/10 text-(--accent) hover:bg-(--accent)/20" : "border-(--border) bg-(--background-elevated) text-(--foreground) hover:border-(--border-strong) hover:bg-(--background-subtle)"}`}
					aria-label="Rate and review"
				>
					<MessageSquarePlus className="size-5" />
				</button>
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
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="btn btn-secondary h-10 w-10 justify-center p-0 lg:w-auto lg:px-3"
							aria-label="More media actions"
						>
							<Ellipsis className="size-5" />
							<span className="hidden lg:inline">More</span>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-52">
						<DropdownMenuItem onSelect={() => setNoteDialogOpen(true)}>
							<StickyNote />
							{note?.content ? "Edit note" : "Add note"}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setLibraryDialogOpen(true)}>
							<Disc />
							{ownedCount > 0 ? `Owned · ${ownedCount}` : "Add to library"}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setListsDialogOpen(true)}>
							<ListPlus />
							{customListCount > 0
								? `Lists · ${customListCount}`
								: "Add to a list"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Small screens retain direct, touch-friendly access to every action. */}
			<div className="hidden">
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

				{/* Icon-only buttons wrap cleanly on small screens. */}
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

					{/* Rate Button */}
					<button
						type="button"
						onClick={() => setRateReviewDialogOpen(true)}
						className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 transition-all duration-150 ${
							rating > 0
								? "border-(--accent)/20 bg-(--accent)/10 text-(--accent) hover:bg-(--accent)/20"
								: "border-(--border) bg-(--background-elevated) text-(--foreground) hover:border-(--border-strong) hover:bg-(--background-subtle)"
						}`}
						aria-label={rating > 0 ? "Edit your rating" : "Rate this"}
					>
						<Star className={`size-5 ${rating > 0 ? "fill-current" : ""}`} />
						{rating > 0 ? (
							<span className="text-sm">
								{ratingToStars(rating).toFixed(1)}
							</span>
						) : null}
					</button>

					{/* Library ("I own this") Button */}
					<button
						type="button"
						onClick={() => setLibraryDialogOpen(true)}
						className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 transition-all duration-150 ${
							ownedCount > 0
								? "border-(--accent)/20 bg-(--accent)/10 text-(--accent) hover:bg-(--accent)/20"
								: "border-(--border) bg-(--background-elevated) text-(--foreground) hover:border-(--border-strong) hover:bg-(--background-subtle)"
						}`}
						aria-label={
							ownedCount > 0 ? "Edit owned formats" : "Add to library"
						}
					>
						<Disc className="size-5" />
						{ownedCount > 0 ? (
							<span className="text-sm">Owned · {ownedCount}</span>
						) : null}
					</button>

					{/* Review Button */}
					<button
						type="button"
						onClick={() => setRateReviewDialogOpen(true)}
						className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-150 ${
							hasReviewed
								? "border-(--accent)/20 bg-(--accent)/10 text-(--accent) hover:bg-(--accent)/20"
								: "border-(--border) bg-(--background-elevated) text-(--foreground) hover:border-(--border-strong) hover:bg-(--background-subtle)"
						}`}
						aria-label={hasReviewed ? "Write another review" : "Write a review"}
					>
						<MessageSquarePlus className="size-5" />
					</button>

					{/* Lists Button */}
					<button
						type="button"
						onClick={() => setListsDialogOpen(true)}
						className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 transition-all duration-150 ${
							customListCount > 0
								? "border-(--accent)/20 bg-(--accent)/10 text-(--accent) hover:bg-(--accent)/20"
								: "border-(--border) bg-(--background-elevated) text-(--foreground) hover:border-(--border-strong) hover:bg-(--background-subtle)"
						}`}
						aria-label={customListCount > 0 ? "Edit lists" : "Add to a list"}
					>
						<ListPlus className="size-5" />
						{customListCount > 0 ? (
							<span className="text-sm">Lists · {customListCount}</span>
						) : null}
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
				open={rateReviewDialogOpen}
				onOpenChange={setRateReviewDialogOpen}
				mediaType={mediaType}
				mediaId={mediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				includeRating
			/>
			<AddToLibraryDialog
				open={libraryDialogOpen}
				onOpenChange={setLibraryDialogOpen}
				mediaType={mediaType}
				mediaId={mediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
			/>
			<ManageListsDialog
				open={listsDialogOpen}
				onOpenChange={setListsDialogOpen}
				mediaType={mediaType}
				mediaId={mediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
			/>
		</>
	);
}
