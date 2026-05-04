import {
	Bookmark,
	BookmarkCheck,
	Library,
	ListChecks,
	Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import ConfirmRemoveDialog from "#/components/ConfirmRemoveDialog";
import ManageListsDialog from "#/components/ManageListsDialog";
import {
	useListItemStatus,
	useMediaWatchStatus,
	useWatchActions,
} from "#/lib/hooks";

interface FeedItemActionsMovieProps {
	type: "movie";
	mediaId: string;
	title?: string;
}

interface FeedItemActionsShowProps {
	type: "show";
	mediaId: string;
	seasonNumber: number;
	episodeNumber: number;
	title?: string;
}

type FeedItemActionsProps =
	| FeedItemActionsMovieProps
	| FeedItemActionsShowProps;

export default function FeedItemActions(props: FeedItemActionsProps) {
	const [listDialogOpen, setListDialogOpen] = useState(false);
	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

	const isShow = props.type === "show";
	const { mediaId, title } = props;

	// For list operations, use episode-scoped mediaId so we add/remove
	// the specific episode, not the entire show.
	const listMediaId =
		isShow && props.seasonNumber > 0 && props.episodeNumber > 0
			? `${mediaId}:season:${props.seasonNumber}:episode:${props.episodeNumber}`
			: mediaId;

	const watchStatusOptions = isShow
		? ({ mediaType: "show", showId: mediaId } as const)
		: ({ mediaType: "movie", movieId: mediaId } as const);

	const { isWatched, isEpisodeWatched, movieWatchHistory, watchHistory } =
		useMediaWatchStatus(watchStatusOptions);

	const watchActions = useWatchActions(watchStatusOptions);

	const episodeWatchHistory = useMemo(() => {
		if (!isShow || !watchHistory || !Array.isArray(watchHistory)) return [];
		const { seasonNumber, episodeNumber } = props as FeedItemActionsShowProps;
		return watchHistory.filter(
			(ep: { seasonNumber: number; episodeNumber: number }) =>
				ep.seasonNumber === seasonNumber && ep.episodeNumber === episodeNumber,
		);
	}, [isShow, watchHistory, props]);

	const { otherLists, userLists, listsForItem } = useListItemStatus({
		mediaType: props.type,
		mediaId: listMediaId,
	});

	const isListsLoading =
		!userLists || !listsForItem || otherLists === undefined;

	// Determine if this specific item is in the user's shelf
	let isInShelf: boolean;
	let isShelfPending: boolean;
	let handleToggleShelf: () => void;
	let confirmEntryCount = 0;
	let confirmTitle = title || "";
	let handleConfirmRemove: () => void;

	if (isShow) {
		const { seasonNumber, episodeNumber } = props;
		const episodeWatched = isEpisodeWatched
			? isEpisodeWatched(seasonNumber, episodeNumber)
			: false;
		isInShelf = episodeWatched;
		isShelfPending =
			watchActions.isMarkEpisodePending || watchActions.isUnmarkEpisodePending;
		handleToggleShelf = () => {
			if (episodeWatched) {
				if (episodeWatchHistory.length > 1) {
					setConfirmRemoveOpen(true);
				} else {
					watchActions.unmarkEpisodeWatched(seasonNumber, episodeNumber);
				}
			} else {
				watchActions.markEpisodeWatched(seasonNumber, episodeNumber);
			}
		};
		confirmEntryCount = episodeWatchHistory.length;
		confirmTitle = title
			? `${title} S${seasonNumber}E${episodeNumber}`
			: `S${seasonNumber}E${episodeNumber}`;
		handleConfirmRemove = () => {
			watchActions.unmarkEpisodeWatched(seasonNumber, episodeNumber, "all");
			setConfirmRemoveOpen(false);
		};
	} else {
		isInShelf = !!isWatched;
		isShelfPending =
			watchActions.isMarkMoviePending || watchActions.isUnmarkMoviePending;
		handleToggleShelf = () => {
			if (isWatched) {
				if (movieWatchHistory && movieWatchHistory.length > 1) {
					setConfirmRemoveOpen(true);
				} else {
					watchActions.unmarkMovieWatched();
				}
			} else {
				watchActions.markMovieWatched();
			}
		};
		confirmEntryCount = movieWatchHistory?.length || 0;
		handleConfirmRemove = () => {
			watchActions.unmarkMovieWatched();
			setConfirmRemoveOpen(false);
		};
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{/* Shelf Toggle */}
			<button
				type="button"
				onClick={handleToggleShelf}
				disabled={isShelfPending}
				className={`btn btn-sm gap-1.5 ${
					isInShelf
						? "border-green-500/20 bg-green-500/10 text-green-600 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600"
						: "btn-secondary"
				}`}
			>
				{(() => {
					if (isShelfPending) {
						return (
							<>
								<Loader2 className="size-3.5 animate-spin" />
								Loading
							</>
						);
					}
					if (isInShelf) {
						return (
							<>
								<BookmarkCheck className="size-3.5" />
								Remove from shelf
							</>
						);
					}
					return (
						<>
							<Bookmark className="size-3.5" />
							Add to shelf
						</>
					);
				})()}
			</button>

			{/* Lists Toggle / Dialog */}
			<button
				type="button"
				onClick={() => setListDialogOpen(true)}
				disabled={isListsLoading}
				className="btn btn-secondary btn-sm gap-1.5"
			>
				{isListsLoading ? (
					<Loader2 className="size-3.5 animate-spin" />
				) : otherLists.length > 0 ? (
					<ListChecks className="size-3.5" />
				) : (
					<Library className="size-3.5" />
				)}
				{otherLists.length > 0 ? "Manage lists" : "Add to list"}
			</button>

			<ManageListsDialog
				mediaType={props.type}
				mediaId={listMediaId}
				open={listDialogOpen}
				onOpenChange={setListDialogOpen}
			/>

			<ConfirmRemoveDialog
				open={confirmRemoveOpen}
				onOpenChange={setConfirmRemoveOpen}
				title={confirmTitle}
				entryCount={confirmEntryCount}
				onConfirm={handleConfirmRemove}
				isPending={isShelfPending}
			/>
		</div>
	);
}
